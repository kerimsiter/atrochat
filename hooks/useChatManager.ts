import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatSession, Message, Role, FileContent, UrlContextMetadata, Attachment } from '../types';
import { getGeminiChatStream } from '../services/geminiService';
import { syncRepoChanges } from '../services/githubService';
import { TOKEN_ESTIMATE_FACTOR, COST_PER_MILLION_TOKENS } from '../constants';
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

export const useChatManager = (geminiApiKey: string | null, githubToken: string | null) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [resendPayload, setResendPayload] = useState<{ content: string; attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean } | null>(null);

  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      if (savedSessions) {
        const parsedSessions = JSON.parse(savedSessions).map((s: any) => ({
          ...createInitialSession(), // Start with defaults for new fields
          ...s,
          billedTokenCount: s.billedTokenCount ?? s.tokenCount ?? 0, // Handle legacy tokenCount
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
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if(!currentSession) return;
    
    if (!geminiApiKey) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.MODEL,
        content: "Gemini API anahtarı ayarlanmamış. Lütfen sağ üstteki Ayarlar menüsünden API anahtarınızı ekleyin.",
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

    const updatedMessages = [...currentSession.messages, userMessage];
    const historyTokenCount = updatedMessages
      .filter(msg => msg.role !== Role.SYSTEM)
      .reduce((acc, msg) => acc + estimateTokens(msg.apiContent || msg.content), 0);
      
    updateSession(activeSessionId, { 
      messages: updatedMessages, 
      files: [],
      historyTokenCount,
      isContextStale: false,
      pendingContextUpdate: undefined,
    });

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

    const inputTokens = estimateTokens(finalPartsForApi.map(p => p.text || '').join(''));
    const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.INPUT;
    
    updateSession(activeSessionId, (s) => ({
      billedTokenCount: s.billedTokenCount + inputTokens,
      cost: s.cost + inputCost,
    }));
    
    let modelResponse = '';
    const modelMessageId = `msg-${Date.now() + 1}`;
    let groundingMetadata: any | undefined = undefined;
    let urlContextMetadata: UrlContextMetadata | undefined = undefined;
    
    try {
      const stream = await getGeminiChatStream(geminiApiKey, history, finalPartsForApi, useGoogleSearch, useUrlAnalysis);
      
      for await (const chunk of stream) {
        const chunkText = chunk.text;
        modelResponse += chunkText;

        if (chunk.candidates?.[0]?.groundingMetadata) {
            groundingMetadata = {
                ...(groundingMetadata || {}),
                ...chunk.candidates[0].groundingMetadata
            };
        }

        if (chunk.candidates?.[0]?.urlContextMetadata) {
            urlContextMetadata = chunk.candidates[0].urlContextMetadata as UrlContextMetadata;
        }

        setSessions(prevSessions => {
            const currentSession = prevSessions.find(s => s.id === activeSessionId);
            if (!currentSession) return prevSessions;

            const existingModelMessage = currentSession.messages.find(m => m.id === modelMessageId);

            if (!existingModelMessage) {
                const newModelMessage: Message = {
                    id: modelMessageId,
                    role: Role.MODEL,
                    content: chunkText,
                    timestamp: new Date().toISOString(),
                };
                return prevSessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, newModelMessage] } : s);
            } else {
                const updatedModelMessage = { ...existingModelMessage, content: modelResponse };
                return prevSessions.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.map(m => m.id === modelMessageId ? updatedModelMessage : m) } : s);
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
      const errorMessage: Message = {
        id: modelMessageId,
        role: Role.MODEL,
        content: errorText,
        timestamp: new Date().toISOString(),
      };
       updateSession(activeSessionId, s => ({ messages: [...s.messages, errorMessage] }));
    } finally {
        const outputTokens = estimateTokens(modelResponse);
        const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.OUTPUT;

        updateSession(activeSessionId, (s) => {
            let finalTitle = s.title;
            if (s.messages.filter(m => m.role !== Role.SYSTEM).length <= 2 && finalTitle === 'Yeni Sohbet') {
                finalTitle = messageContent.substring(0, 30) + '...';
            }

            const finalMessages = s.messages.map(m => {
                if (m.id === modelMessageId) {
                    return { ...m, groundingMetadata: groundingMetadata, urlContextMetadata: urlContextMetadata };
                }
                return m;
            });

            return {
                billedTokenCount: s.billedTokenCount + outputTokens,
                cost: s.cost + outputCost,
                title: finalTitle,
                messages: finalMessages,
            };
        });

      setIsLoading(false);
    }
  }, [activeSessionId, sessions, updateSession, geminiApiKey]);


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

    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;

    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || session.messages[messageIndex].role !== Role.USER) {
      return;
    }
    
    const originalAttachments = session.messages[messageIndex].attachments || [];
    const truncatedMessages = session.messages.slice(0, messageIndex);

    // Recalculate only the history token count for the truncated history.
    let newHistoryTokenCount = 0;
    truncatedMessages.forEach(msg => {
      if (msg.role === Role.SYSTEM) return;
      newHistoryTokenCount += estimateTokens(msg.apiContent || msg.content);
    });

    // Update the session, but leave billedTokenCount and cost as they are.
    // The cost of the edited-away messages has already been incurred.
    updateSession(activeSessionId, {
      messages: truncatedMessages,
      historyTokenCount: newHistoryTokenCount,
    });

    setResendPayload({
        content: newContent, 
        attachments: originalAttachments, 
        useUrlAnalysis: false, // Assume false for edits, as this isn't re-configurable in the UI
        useGoogleSearch: false,
    });
  }, [activeSessionId, sessions, updateSession]);


  return {
    sessions,
    activeSession,
    isLoading,
    isSyncing,
    sendMessage,
    startNewChat,
    selectChat,
    deleteChat,
    addFilesToContext,
    syncRepo,
    deleteMessage,
    editMessage,
  };
};