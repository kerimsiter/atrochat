import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatSession, Message, Role, FileContent, UrlContextMetadata, Attachment } from '../types';
import { getGeminiChatStream } from '../services/geminiService';
import { syncRepoChanges } from '../services/githubService';
import { TOKEN_ESTIMATE_FACTOR, COST_PER_MILLION_TOKENS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';
import { Content, Part } from "@google/genai";

const estimateTokens = (text: string) => Math.ceil(text.length / TOKEN_ESTIMATE_FACTOR);

const createInitialSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'Yeni Sohbet',
  messages: [],
  createdAt: new Date().toISOString(),
  billedTokenCount: 0,
  cost: 0,
  files: [],
  projectFiles: [],
  projectTokenCount: 0,
  historyTokenCount: 0,
  isContextStale: false,
});

export const useChatManager = (geminiApiKey: string | null, githubToken: string | null, selectedModel?: string) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resendPayload, setResendPayload] = useState<{ content: string; attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean } | null>(null);
  
  const sessionsRef = useRef(sessions);
  const currentStreamRef = useRef<AsyncGenerator<any, any, unknown> | null>(null);
  const currentModelMessageIdRef = useRef<string | null>(null);
  const currentAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Stop generation: defined after updateSession to avoid use-before-declaration

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions).map((s: any) => ({
          ...createInitialSession(),
          ...s,
          billedTokenCount: s.billedTokenCount ?? s.tokenCount ?? 0,
        }));
        if (Array.isArray(parsedSessions) && parsedSessions.length > 0) {
          setSessions(parsedSessions);
          const lastSessionId = localStorage.getItem('activeSessionId') || parsedSessions[0].id;
          setActiveSessionId(lastSessionId);
        } else {
          startNewChat();
        }
      } else {
        startNewChat();
      }
    } catch (error) {
      console.error("Failed to load sessions from localStorage:", error);
      startNewChat();
    } finally {
      setIsHydrating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(sessions));
    }
    if (activeSessionId) {
      localStorage.setItem('activeSessionId', activeSessionId);
    }
  }, [sessions, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const updateSession = useCallback((sessionId: string, updates: Partial<ChatSession> | ((session: ChatSession) => Partial<ChatSession>)) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id === sessionId) {
          const newUpdates = typeof updates === 'function' ? updates(s) : updates;
          return { ...s, ...newUpdates };
        }
        return s;
      })
    );
  }, []);

  // Stop generation: abort current stream and finalize UI state
  const stopGeneration = useCallback(async () => {
    if (!activeSessionId) return;
    const gen = currentStreamRef.current;
    if (gen && typeof gen.return === 'function') {
      try { await gen.return(undefined); } catch { /* ignore */ }
    }
    currentStreamRef.current = null;
    // Abort any ongoing network request
    try { currentAbortRef.current?.abort(); } catch { /* ignore */ }
    currentAbortRef.current = null;
    setIsLoading(false);

    const modelId = currentModelMessageIdRef.current;
    if (!modelId) return;

    updateSession(activeSessionId, (s) => ({
      ...s,
      messages: s.messages.map(m => (
        m.id === modelId ? { ...m, isThinking: false } : m
      )),
    }));
  }, [activeSessionId, updateSession]);

  const startNewChat = useCallback(() => {
    const newSession = createInitialSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  const selectChat = (sessionId: string) => {
    setActiveSessionId(sessionId);
  };
  
  const deleteChat = (sessionId: string) => {
    const remainingSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(remainingSessions);
    if (activeSessionId === sessionId) {
      if (remainingSessions.length > 0) {
        setActiveSessionId(remainingSessions[0].id);
      } else {
        startNewChat();
      }
    }
  };

  const addFilesToContext = (files: FileContent[], sourceName: string, repoUrl: string, commitSha: string) => {
    if (!activeSessionId) return;

    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;
    
    const projectTokenCount = files.reduce((acc, file) => acc + estimateTokens(file.content), 0);

    const systemMessage: Message = {
      id: `msg-${Date.now()}`,
      role: Role.SYSTEM,
      content: `${files.length} dosya (${sourceName}) analize eklendi (~${projectTokenCount.toLocaleString()} token). İçerikleri bir sonraki mesajınızla birlikte gönderilecek.`,
      timestamp: new Date().toISOString(),
    };
    
    updateSession(activeSessionId, { 
      files: [], // Clear any temporary files
      projectFiles: files,
      projectTokenCount,
      projectRepoUrl: repoUrl,
      projectCommitSha: commitSha,
      isContextStale: true, // Mark context as stale for the INITIAL load
      messages: [...currentSession.messages, systemMessage]
    });
  };

  const syncRepo = useCallback(async () => {
    if (!activeSessionId || isSyncing) return;
  
    const currentSession = sessionsRef.current.find(s => s.id === activeSessionId);
    if (!currentSession?.projectRepoUrl || !currentSession.projectCommitSha) {
      console.warn("Sync attempted without repo URL or commit SHA.");
      return;
    }
  
    setIsSyncing(true);
    try {
      const { newCommitSha, addedFiles, modifiedFiles, removedPaths, hasChanges } = await syncRepoChanges(
        currentSession.projectRepoUrl,
        currentSession.projectCommitSha,
        githubToken
      );
  
      if (!hasChanges) {
        const systemMessage: Message = {
          id: `msg-${Date.now()}`,
          role: Role.SYSTEM,
          content: "Proje zaten güncel. Değişiklik bulunamadı.",
          // FIX: Corrected 'new new Date()' to 'new Date()'.
          timestamp: new Date().toISOString(),
        };
        updateSession(activeSessionId, s => ({ messages: [...s.messages, systemMessage] }));
        return;
      }
  
      updateSession(activeSessionId, session => {
        const oldProjectTokenCount = session.projectTokenCount;
        let updatedFiles = session.projectFiles ? [...session.projectFiles] : [];
  
        // Handle removals
        const removedPathsSet = new Set(removedPaths);
        updatedFiles = updatedFiles.filter(file => !removedPathsSet.has(file.path));
  
        // Handle modifications (remove old, add new)
        const modifiedPathsSet = new Set(modifiedFiles.map(f => f.path));
        updatedFiles = updatedFiles.filter(file => !modifiedPathsSet.has(file.path));
        updatedFiles.push(...modifiedFiles);
  
        // Handle additions
        updatedFiles.push(...addedFiles);
  
        const newProjectTokenCount = updatedFiles.reduce((acc, file) => acc + estimateTokens(file.content), 0);
        const tokenDiff = newProjectTokenCount - oldProjectTokenCount;
        const diffSign = tokenDiff >= 0 ? '+' : '';
  
        const summary = [
          addedFiles.length > 0 ? `${addedFiles.length} dosya eklendi` : '',
          modifiedFiles.length > 0 ? `${modifiedFiles.length} dosya değiştirildi` : '',
          removedPaths.length > 0 ? `${removedPaths.length} dosya silindi` : ''
        ].filter(Boolean).join(', ');
  
        const systemMessage: Message = {
          id: `msg-${Date.now()}`,
          role: Role.SYSTEM,
          content: `Proje güncellendi: ${summary}. Bağlam güncellendi (${diffSign}${tokenDiff.toLocaleString()} token).`,
          timestamp: new Date().toISOString(),
        };
  
        return {
          projectFiles: updatedFiles,
          projectCommitSha: newCommitSha,
          projectTokenCount: newProjectTokenCount,
          pendingContextUpdate: {
            added: addedFiles,
            modified: modifiedFiles,
            removed: removedPaths,
          },
          messages: [...session.messages, systemMessage],
        };
      });
  
    } catch (error) {
      console.error("Error syncing repository:", error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: `Depo senkronize edilirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        timestamp: new Date().toISOString(),
      };
      updateSession(activeSessionId, s => ({ messages: [...s.messages, errorMessage] }));
    } finally {
      setIsSyncing(false);
    }
  }, [activeSessionId, githubToken, isSyncing, updateSession]);

  const deleteMessage = useCallback((messageId: string) => {
    if (!activeSessionId) return;

    updateSession(activeSessionId, (session) => {
        const messageIndex = session.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1 || session.messages[messageIndex].role !== Role.USER) {
            return session; // Return original session if not found or not a user message
        }

        const idsToRemove = new Set<string>();
        idsToRemove.add(messageId);

        const nextMessage = session.messages[messageIndex + 1];
        // If the next message is a model's response, remove it too.
        if (nextMessage && nextMessage.role === Role.MODEL) {
            idsToRemove.add(nextMessage.id);
        }

        const messagesToKeep = session.messages.filter(m => !idsToRemove.has(m.id));

        // Recalculate only historyTokenCount. Billed tokens and cost are final.
        let newHistoryTokenCount = 0;
        messagesToKeep.forEach(msg => {
            if (msg.role === Role.SYSTEM) return;
            newHistoryTokenCount += estimateTokens(msg.apiContent || msg.content);
        });

        return {
            messages: messagesToKeep,
            historyTokenCount: newHistoryTokenCount,
        };
    });
  }, [activeSessionId, updateSession]);
  
  const sendMessage = useCallback(async (messageContent: string, attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean) => {
    if (!activeSessionId) return;
    const currentSession = sessionsRef.current.find(s => s.id === activeSessionId);
    if(!currentSession) return;
    
    if (!geminiApiKey) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.MODEL,
        content: "Gemini API anahtarı ayarlanmamış. Lütfen Ayarlar menüsünden anahtarınızı girin.",
        timestamp: new Date().toISOString(),
      };
      updateSession(activeSessionId, s => ({ messages: [...s.messages, errorMessage] }));
      return;
    }

    setIsLoading(true);
    
    let apiMessageContent = messageContent;
    const isSendingFullContext = currentSession.isContextStale && (currentSession.projectFiles || []).length > 0;
    const pendingUpdate = currentSession.pendingContextUpdate;
    const projectFiles = currentSession.projectFiles || [];

    // Append project files context if needed
    if (isSendingFullContext) {
        apiMessageContent = `Aşağıdaki proje dosyalarını analiz et. Bu dosyalardaki bilgilere dayanarak yanıt ver:\n\n${projectFiles.map(f => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n\n--- SORU ---\n${messageContent}`;
    } else if (pendingUpdate) {
        let preamble = "PROJE BAĞLAMI GÜNCELLEMESİ:\nMevcut proje bilgine ek olarak aşağıdaki değişiklikleri dikkate al.\n\n";
        if (pendingUpdate.added.length > 0) preamble += `- EKLENEN DOSYALAR: ${pendingUpdate.added.map(f => f.path).join(', ')}\n`;
        if (pendingUpdate.modified.length > 0) preamble += `- DEĞİŞTİRİLEN DOSYALAR: ${pendingUpdate.modified.map(f => f.path).join(', ')}\n`;
        if (pendingUpdate.removed.length > 0) preamble += `- SİLİNEN DOSYALAR: ${pendingUpdate.removed.join(', ')}\n`;

        const changedFiles = [...pendingUpdate.added, ...pendingUpdate.modified];
        if (changedFiles.length > 0) {
            preamble += "\nİşte eklenen ve değiştirilen dosyaların YENİ içerikleri:\n\n";
            preamble += changedFiles.map(f => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
        }
        preamble += `\n\nBu güncellemelere dayanarak aşağıdaki soruma yanıt ver:\n--- SORU ---\n${messageContent}`;
        apiMessageContent = preamble;
    }

    // Append text-based attachments to the API message
    attachments.forEach(att => {
        if (!att.type.startsWith('image/')) {
            apiMessageContent += `\n\n--- EKLENEN DOSYA: ${att.name} ---\n\`\`\`\n${att.data}\n\`\`\``;
        }
    });

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: Role.USER,
      content: messageContent,
      apiContent: apiMessageContent,
      attachments: attachments,
      timestamp: new Date().toISOString(),
    };

    const modelMessageId = `msg-${Date.now() + 1}`;
    currentModelMessageIdRef.current = modelMessageId;
    const initialModelMessage: Message = {
      id: modelMessageId,
      role: Role.MODEL,
      content: "",
      timestamp: new Date().toISOString(),
      isThinking: true,
      thinkingSteps: [],
    };
    
    const updatedMessages = [...currentSession.messages, userMessage];

    updateSession(activeSessionId, s => ({
        ...s,
        messages: [...updatedMessages, initialModelMessage],
        files: [],
        isContextStale: false,
        pendingContextUpdate: undefined,
    }));
    
    const messagesForHistory = updatedMessages
      .filter(msg => msg.role === Role.USER || msg.role === Role.MODEL);

    const lastMessageForApi = messagesForHistory.pop();
    if (!lastMessageForApi) {
      setIsLoading(false);
      return;
    }
    
    const history: Content[] = messagesForHistory.map(msg => {
        const msgParts: Part[] = [{ text: msg.apiContent || msg.content }];
        if (msg.role === Role.USER && msg.attachments) {
            msg.attachments.forEach(att => {
                if (att.type.startsWith('image/')) {
                    msgParts.push({
                        inlineData: { mimeType: att.type, data: att.data.split(',')[1] }
                    });
                }
            });
        }
        return {
            role: msg.role === Role.USER ? 'user' : 'model',
            parts: msgParts,
        };
    });

    const finalPartsForApi: Part[] = [{ text: lastMessageForApi.apiContent || lastMessageForApi.content }];
    if(lastMessageForApi.attachments) {
        lastMessageForApi.attachments.forEach(att => {
            if (att.type.startsWith('image/')) {
                finalPartsForApi.push({
                    inlineData: { mimeType: att.type, data: att.data.split(',')[1] }
                });
            }
        });
    }

    const inputTokens = estimateTokens(finalPartsForApi.map(p => 'text' in p ? p.text : '').join(''));
    const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.INPUT;
    
    updateSession(activeSessionId, (s) => ({
      billedTokenCount: s.billedTokenCount + inputTokens,
      historyTokenCount: s.historyTokenCount + inputTokens,
      cost: s.cost + inputCost,
    }));
    
    let modelResponse = '';
    let accumulatedThoughts = '';
    let groundingMetadata: any | undefined = undefined;
    let urlContextMetadata: UrlContextMetadata | undefined = undefined;
    
    try {
      // Create a new abort controller for this request
      const controller = new AbortController();
      currentAbortRef.current = controller;

      const systemInstruction = localStorage.getItem('systemInstruction') || DEFAULT_SYSTEM_INSTRUCTION;

      const stream = await getGeminiChatStream(
        geminiApiKey,
        history,
        finalPartsForApi,
        useGoogleSearch,
        useUrlAnalysis,
        systemInstruction,
        selectedModel,
        controller.signal
      );
      currentStreamRef.current = stream;
      
      for await (const chunk of stream) {
        let chunkAnswer = '';

        const candidate = chunk?.candidates?.[0];
        if (!candidate) continue;

        const parts = (candidate as any)?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            const part: any = p as any;
            if (part?.thought && typeof part.text === 'string') {
              accumulatedThoughts += part.text;
            } else if (typeof part?.text === 'string') {
              chunkAnswer += part.text;
            } else if (part?.functionCall || part?.toolCall || part?.executable || part?.inlineData || part?.fileData) {
              const name = part?.functionCall?.name || part?.toolCall?.name || part?.executable?.name || 'bir araç';
              accumulatedThoughts += `\n[${name}] kullanılıyor...`;
            }
          }
        }
        
        modelResponse += chunkAnswer;

        if (candidate?.groundingMetadata) {
            groundingMetadata = {
                ...(groundingMetadata || {}),
                ...candidate.groundingMetadata
            };
        }

        if ((candidate as any)?.urlContextMetadata) {
            urlContextMetadata = (candidate as any).urlContextMetadata as UrlContextMetadata;
        }

        updateSession(activeSessionId, s => {
            const currentModelMessage = s.messages.find(m => m.id === modelMessageId);
            if (!currentModelMessage) return s;

            const updatedThinkingSteps = accumulatedThoughts
                .split('\n')
                .map(step => step.trim())
                .filter(step => step !== '');

            return {
                ...s,
                messages: s.messages.map(m =>
                    m.id === modelMessageId
                    ? { ...m, content: modelResponse, thinkingSteps: updatedThinkingSteps }
                    : m
                ),
            }
        });
      }
    } catch (error) {
      console.error("Gemini API error:", error);
      let errorText = "Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.";
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('400'))) {
          errorText = "API anahtarı geçersiz veya hatalı. Lütfen Ayarlar menüsünden kontrol edin.";
      } else if (error instanceof Error) {
        errorText = `Bir hata oluştu: ${error.message}`;
      }
       updateSession(activeSessionId, s => ({ 
           ...s,
           messages: s.messages.map(m => 
               m.id === modelMessageId 
               ? { ...m, content: errorText, isThinking: false }
               : m
           )
       }));
    } finally {
        // Ensure current stream is cleared
        currentStreamRef.current = null;
        // Ensure abort controller is cleared
        currentAbortRef.current = null;
        const outputTokens = estimateTokens(modelResponse);
        const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.OUTPUT;

        updateSession(activeSessionId, (s) => {
            let finalTitle = s.title;
            if (s.messages.filter(m => m.role !== Role.SYSTEM).length <= 2 && finalTitle === 'Yeni Sohbet') {
                finalTitle = messageContent.substring(0, 30) + '...';
            }
            
            const finalMessages = s.messages.map(m => {
                if (m.id === modelMessageId) {
                    return { 
                        ...m, 
                        isThinking: false, 
                        groundingMetadata: groundingMetadata, 
                        urlContextMetadata: urlContextMetadata 
                    };
                }
                return m;
            });

            return {
                billedTokenCount: s.billedTokenCount + outputTokens,
                historyTokenCount: s.historyTokenCount + outputTokens,
                cost: s.cost + outputCost,
                title: finalTitle,
                messages: finalMessages,
            };
        });

      setIsLoading(false);
    }
  }, [activeSessionId, updateSession, geminiApiKey, githubToken]);


  useEffect(() => {
    if (resendPayload && !isLoading) {
      sendMessage(
        resendPayload.content,
        resendPayload.attachments,
        resendPayload.useUrlAnalysis,
        resendPayload.useGoogleSearch
      );
      setResendPayload(null);
    }
  }, [resendPayload, isLoading, sendMessage]);


  const editMessage = useCallback((messageId: string, newContent: string) => {
    if (!activeSessionId) return;

    const session = sessionsRef.current.find(s => s.id === activeSessionId);
    if (!session) return;

    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || session.messages[messageIndex].role !== Role.USER) {
      return;
    }
    
    const originalAttachments = session.messages[messageIndex].attachments || [];
    const truncatedMessages = session.messages.slice(0, messageIndex);

    let newHistoryTokenCount = 0;
    truncatedMessages.forEach(msg => {
      if (msg.role === Role.SYSTEM) return;
      newHistoryTokenCount += estimateTokens(msg.apiContent || msg.content);
    });

    updateSession(activeSessionId, {
      messages: truncatedMessages,
      historyTokenCount: newHistoryTokenCount,
    });

    setResendPayload({
        content: newContent, 
        attachments: originalAttachments, 
        useUrlAnalysis: false,
        useGoogleSearch: false,
    });
  }, [activeSessionId, updateSession]);


  return {
    sessions,
    activeSession,
    isLoading,
    isSyncing,
    isHydrating,
    sendMessage,
    stopGeneration,
    startNewChat,
    selectChat,
    deleteChat,
    addFilesToContext,
    syncRepo,
    deleteMessage,
    editMessage,
  };
};
