import { create } from 'zustand';
import { ChatSession, Message, Role, FileContent, UrlContextMetadata, Attachment } from '../types';
import { getGeminiChatStream } from '../services/geminiService';
import { syncRepoChanges } from '../services/githubService';
import { TOKEN_ESTIMATE_FACTOR, COST_PER_MILLION_TOKENS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';
import type { Content, Part } from '@google/genai';

// Module-scope controllers/state for streaming
let currentStream: AsyncIterable<any> | null = null;
let currentAbort: AbortController | null = null;
let currentModelMessageId: string | null = null;

// Types
interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  isHydrating: boolean;
  isSyncing: boolean;
  geminiApiKey: string;
  githubToken: string;
  selectedModel?: string;
  systemInstruction: string;
}

interface ChatActions {
  hydrate: () => void;
  setApiKeys: (keys: { gemini: string; github: string }) => void;
  setSelectedModel: (model?: string) => void;
  setSystemInstruction: (instruction: string) => void;
  startNewChat: () => void;
  selectChat: (sessionId: string) => void;
  deleteChat: (sessionId: string) => void;
  addFilesToContext: (files: FileContent[], sourceName: string, repoUrl: string, commitSha: string) => void;
  sendMessage: (content: string, attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean) => Promise<void>;
  stopGeneration: () => Promise<void>;
  syncRepo: () => Promise<void>;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, newContent: string) => void;
}

export type ChatStore = ChatState & ChatActions;

// Helpers
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

export const useChatStore = create<ChatStore>((set, get) => ({
  // State
  sessions: [],
  activeSessionId: null,
  isLoading: false,
  isHydrating: true,
  isSyncing: false,
  geminiApiKey: localStorage.getItem('geminiApiKey') || '',
  githubToken: localStorage.getItem('githubToken') || '',
  selectedModel: localStorage.getItem('selectedModel') || undefined,
  systemInstruction: localStorage.getItem('systemInstruction') || DEFAULT_SYSTEM_INSTRUCTION,

  // Actions
  hydrate: () => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({
            sessions: parsed,
            activeSessionId: localStorage.getItem('activeSessionId') || parsed[0].id,
            geminiApiKey: localStorage.getItem('geminiApiKey') || get().geminiApiKey,
            githubToken: localStorage.getItem('githubToken') || get().githubToken,
            selectedModel: localStorage.getItem('selectedModel') || get().selectedModel,
            systemInstruction: localStorage.getItem('systemInstruction') || get().systemInstruction,
          });
        } else {
          const s = createInitialSession();
          set({ sessions: [s], activeSessionId: s.id });
        }
      } else {
        const s = createInitialSession();
        set({ sessions: [s], activeSessionId: s.id });
      }
    } catch (e) {
      const s = createInitialSession();
      set({ sessions: [s], activeSessionId: s.id });
    } finally {
      set({ isHydrating: false });
    }
  },

  setApiKeys: ({ gemini, github }) => {
    set({ geminiApiKey: gemini, githubToken: github });
    try {
      localStorage.setItem('geminiApiKey', gemini);
      localStorage.setItem('githubToken', github);
    } catch {}
  },

  setSelectedModel: (model) => {
    set({ selectedModel: model });
    try { localStorage.setItem('selectedModel', model || ''); } catch {}
  },

  setSystemInstruction: (instruction) => {
    set({ systemInstruction: instruction });
    try { localStorage.setItem('systemInstruction', instruction); } catch {}
  },

  startNewChat: () => {
    const s = createInitialSession();
    set((state) => ({ sessions: [s, ...state.sessions], activeSessionId: s.id }));
  },

  selectChat: (sessionId) => set({ activeSessionId: sessionId }),

  deleteChat: (sessionId) => {
    const { sessions, activeSessionId } = get();
    const remaining = sessions.filter((s) => s.id !== sessionId);
    let nextActive = activeSessionId;
    if (activeSessionId === sessionId) {
      nextActive = remaining[0]?.id ?? null;
      if (!nextActive) {
        const s = createInitialSession();
        set({ sessions: [s], activeSessionId: s.id });
        return;
      }
    }
    set({ sessions: remaining, activeSessionId: nextActive });
  },

  addFilesToContext: (files, sourceName, repoUrl, commitSha) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;
    const current = sessions.find((s) => s.id === activeSessionId);
    if (!current) return;

    const projectTokenCount = files.reduce((acc, f) => acc + estimateTokens(f.content), 0);
    const systemMessage: Message = {
      id: `msg-${Date.now()}`,
      role: Role.SYSTEM,
      content: `${files.length} dosya (${sourceName}) analize eklendi (~${projectTokenCount.toLocaleString()} token). İçerikleri bir sonraki mesajınızla birlikte gönderilecek.`,
      timestamp: new Date().toISOString(),
    };

    set({
      sessions: sessions.map((s) => (s.id === activeSessionId ? {
        ...s,
        files: [],
        projectFiles: files,
        projectTokenCount,
        projectRepoUrl: repoUrl,
        projectCommitSha: commitSha,
        isContextStale: true,
        messages: [...s.messages, systemMessage],
      } : s)),
    });
  },

  // Implemented actions migrated from useChatManager
  sendMessage: async (messageContent, attachments, useUrlAnalysis, useGoogleSearch) => {
    const state = get();
    const { activeSessionId, sessions, geminiApiKey } = state;
    if (!activeSessionId) return;
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) return;

    if (!geminiApiKey) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.MODEL,
        content: 'Gemini API anahtarı ayarlanmamış. Lütfen Ayarlar menüsünden anahtarınızı girin.',
        timestamp: new Date().toISOString(),
      };
      set({ sessions: sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s) });
      return;
    }

    set({ isLoading: true });

    let apiMessageContent = messageContent;
    const isSendingFullContext = currentSession.isContextStale && (currentSession.projectFiles || []).length > 0;
    const pendingUpdate = (currentSession as any).pendingContextUpdate;
    const projectFiles = currentSession.projectFiles || [];

    if (isSendingFullContext) {
      apiMessageContent = `Aşağıdaki proje dosyalarını analiz et. Bu dosyalardaki bilgilere dayanarak yanıt ver:\n\n${projectFiles.map(f => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n\n--- SORU ---\n${messageContent}`;
    } else if (pendingUpdate) {
      let preamble = 'PROJE BAĞLAMI GÜNCELLEMESİ:\nMevcut proje bilgine ek olarak aşağıdaki değişiklikleri dikkate al.\n\n';
      if (pendingUpdate.added.length > 0) preamble += `- EKLENEN DOSYALAR: ${pendingUpdate.added.map((f: any) => f.path).join(', ')}\n`;
      if (pendingUpdate.modified.length > 0) preamble += `- DEĞİŞTİRİLEN DOSYALAR: ${pendingUpdate.modified.map((f: any) => f.path).join(', ')}\n`;
      if (pendingUpdate.removed.length > 0) preamble += `- SİLİNEN DOSYALAR: ${pendingUpdate.removed.join(', ')}\n`;
      const changedFiles = [...pendingUpdate.added, ...pendingUpdate.modified];
      if (changedFiles.length > 0) {
        preamble += '\nİşte eklenen ve değiştirilen dosyaların YENİ içerikleri:\n\n';
        preamble += changedFiles.map((f: any) => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n');
      }
      preamble += `\n\nBu güncellemelere dayanarak aşağıdaki soruma yanıt ver:\n--- SORU ---\n${messageContent}`;
      apiMessageContent = preamble;
    }

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
      attachments,
      timestamp: new Date().toISOString(),
    };

    const modelMessageId = `msg-${Date.now() + 1}`;
    currentModelMessageId = modelMessageId;
    const initialModelMessage: Message = {
      id: modelMessageId,
      role: Role.MODEL,
      content: '',
      timestamp: new Date().toISOString(),
      isThinking: true,
      thinkingSteps: [],
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    set({
      sessions: sessions.map(s => s.id === activeSessionId ? {
        ...s,
        messages: [...updatedMessages, initialModelMessage],
        files: [],
        isContextStale: false,
        pendingContextUpdate: undefined,
      } : s),
    });

    const messagesForHistory = updatedMessages.filter(m => m.role === Role.USER || m.role === Role.MODEL);
    const lastMessageForApi = messagesForHistory.pop();
    if (!lastMessageForApi) {
      set({ isLoading: false });
      return;
    }

    const history: Content[] = messagesForHistory.map(msg => {
      const msgParts: Part[] = [{ text: (msg as any).apiContent || msg.content }];
      if (msg.role === Role.USER && msg.attachments) {
        msg.attachments.forEach(att => {
          if (att.type.startsWith('image/')) {
            msgParts.push({ inlineData: { mimeType: att.type, data: att.data.split(',')[1] } } as any);
          }
        });
      }
      return { role: msg.role === Role.USER ? 'user' : 'model', parts: msgParts } as Content;
    });

    const finalPartsForApi: Part[] = [{ text: (lastMessageForApi as any).apiContent || lastMessageForApi.content }];
    if (lastMessageForApi.attachments) {
      lastMessageForApi.attachments.forEach(att => {
        if (att.type.startsWith('image/')) {
          finalPartsForApi.push({ inlineData: { mimeType: att.type, data: att.data.split(',')[1] } } as any);
        }
      });
    }

    const inputTokens = estimateTokens(finalPartsForApi.map(p => 'text' in p ? (p as any).text : '').join(''));
    const inputCost = (inputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.INPUT;
    set({
      sessions: get().sessions.map(s => s.id === activeSessionId ? {
        ...s,
        billedTokenCount: s.billedTokenCount + inputTokens,
        historyTokenCount: s.historyTokenCount + inputTokens,
        cost: s.cost + inputCost,
      } : s),
    });

    let modelResponse = '';
    let accumulatedThoughts = '';
    let groundingMetadata: any | undefined = undefined;
    let urlContextMetadata: UrlContextMetadata | undefined = undefined;

    try {
      const controller = new AbortController();
      currentAbort = controller;

      const systemInstruction = get().systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
      const stream = await getGeminiChatStream(
        get().geminiApiKey,
        history,
        finalPartsForApi,
        useGoogleSearch,
        useUrlAnalysis,
        systemInstruction,
        get().selectedModel,
        controller.signal
      );
      currentStream = stream as any;

      for await (const chunk of stream as any) {
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
          groundingMetadata = { ...(groundingMetadata || {}), ...candidate.groundingMetadata };
        }
        if ((candidate as any)?.urlContextMetadata) {
          urlContextMetadata = (candidate as any).urlContextMetadata as UrlContextMetadata;
        }

        set({
          sessions: get().sessions.map(s => {
            if (s.id !== activeSessionId) return s;
            const updatedThinkingSteps = accumulatedThoughts
              .split('\n')
              .map(step => step.trim())
              .filter(step => step !== '');
            return {
              ...s,
              messages: s.messages.map(m => m.id === modelMessageId ? { ...m, content: modelResponse, thinkingSteps: updatedThinkingSteps } : m),
            };
          })
        });
      }
    } catch (error: any) {
      console.error('Gemini API error:', error);
      let errorText = 'Üzgünüm, bir hata oluştu. Lütfen daha sonra tekrar deneyin.';
      if (error instanceof Error && (error.message.includes('API key') || error.message.includes('400'))) {
        errorText = 'API anahtarı geçersiz veya hatalı. Lütfen Ayarlar menüsünden kontrol edin.';
      } else if (error instanceof Error) {
        errorText = `Bir hata oluştu: ${error.message}`;
      }
      set({
        sessions: get().sessions.map(s => s.id === activeSessionId ? {
          ...s,
          messages: s.messages.map(m => m.id === modelMessageId ? { ...m, content: errorText, isThinking: false } : m),
        } : s)
      });
    } finally {
      currentStream = null;
      currentAbort = null;
      const outputTokens = estimateTokens(modelResponse);
      const outputCost = (outputTokens / 1_000_000) * COST_PER_MILLION_TOKENS.OUTPUT;
      set({
        sessions: get().sessions.map(s => s.id === activeSessionId ? {
          ...s,
          billedTokenCount: s.billedTokenCount + outputTokens,
          historyTokenCount: s.historyTokenCount + outputTokens,
          cost: s.cost + outputCost,
          title: (s.messages.filter(m => m.role !== Role.SYSTEM).length <= 2 && s.title === 'Yeni Sohbet') ? (messageContent.substring(0, 30) + '...') : s.title,
          messages: s.messages.map(m => m.id === (currentModelMessageId || '') ? { ...m, isThinking: false, groundingMetadata, urlContextMetadata } : m),
        } : s),
        isLoading: false,
      });
    }
  },

  stopGeneration: async () => {
    const { activeSessionId } = get();
    if (!activeSessionId) return;
    const gen: any = currentStream;
    if (gen && typeof gen.return === 'function') {
      try { await gen.return(undefined); } catch { /* ignore */ }
    }
    currentStream = null;
    try { currentAbort?.abort(); } catch {}
    currentAbort = null;
    set({ isLoading: false });
    const modelId = currentModelMessageId;
    if (!modelId) return;
    set({
      sessions: get().sessions.map(s => s.id === activeSessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === modelId ? { ...m, isThinking: false } : m),
      } : s)
    });
  },

  syncRepo: async () => {
    const { activeSessionId, isSyncing, sessions, githubToken } = get();
    if (!activeSessionId || isSyncing) return;
    const currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession?.projectRepoUrl || !currentSession.projectCommitSha) {
      console.warn('Sync attempted without repo URL or commit SHA.');
      return;
    }
    set({ isSyncing: true });
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
          content: 'Proje zaten güncel. Değişiklik bulunamadı.',
          timestamp: new Date().toISOString(),
        };
        set({ sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, systemMessage] } : s) });
        return;
      }

      set({ sessions: get().sessions.map(s => {
        if (s.id !== activeSessionId) return s;
        const oldProjectTokenCount = s.projectTokenCount;
        let updatedFiles = s.projectFiles ? [...s.projectFiles] : [];
        const removedPathsSet = new Set(removedPaths);
        updatedFiles = updatedFiles.filter(f => !removedPathsSet.has(f.path));
        const modifiedPathsSet = new Set(modifiedFiles.map(f => f.path));
        updatedFiles = updatedFiles.filter(f => !modifiedPathsSet.has(f.path));
        updatedFiles.push(...modifiedFiles);
        updatedFiles.push(...addedFiles);
        const newProjectTokenCount = updatedFiles.reduce((acc, f) => acc + estimateTokens(f.content), 0);
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
          ...s,
          projectFiles: updatedFiles,
          projectCommitSha: newCommitSha,
          projectTokenCount: newProjectTokenCount,
          pendingContextUpdate: {
            added: addedFiles,
            modified: modifiedFiles,
            removed: removedPaths,
          },
          messages: [...s.messages, systemMessage],
        } as ChatSession;
      }) });
    } catch (error) {
      console.error('Error syncing repository:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: `Depo senkronize edilirken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
        timestamp: new Date().toISOString(),
      };
      set({ sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s) });
    } finally {
      set({ isSyncing: false });
    }
  },

  deleteMessage: (messageId: string) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || session.messages[messageIndex].role !== Role.USER) return;
    const idsToRemove = new Set<string>([messageId]);
    const nextMessage = session.messages[messageIndex + 1];
    if (nextMessage && nextMessage.role === Role.MODEL) idsToRemove.add(nextMessage.id);
    const messagesToKeep = session.messages.filter(m => !idsToRemove.has(m.id));
    let newHistoryTokenCount = 0;
    messagesToKeep.forEach(msg => {
      if (msg.role === Role.SYSTEM) return;
      newHistoryTokenCount += estimateTokens((msg as any).apiContent || msg.content);
    });
    set({ sessions: sessions.map(s => s.id === activeSessionId ? { ...s, messages: messagesToKeep, historyTokenCount: newHistoryTokenCount } : s) });
  },

  editMessage: (messageId: string, newContent: string) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const messageIndex = session.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || session.messages[messageIndex].role !== Role.USER) return;
    const originalAttachments = session.messages[messageIndex].attachments || [];
    const truncatedMessages = session.messages.slice(0, messageIndex);
    let newHistoryTokenCount = 0;
    truncatedMessages.forEach(msg => {
      if (msg.role === Role.SYSTEM) return;
      newHistoryTokenCount += estimateTokens((msg as any).apiContent || msg.content);
    });
    set({ sessions: sessions.map(s => s.id === activeSessionId ? { ...s, messages: truncatedMessages, historyTokenCount: newHistoryTokenCount } : s) });
    // defer resend via a minimal flag in state if needed; for now this action truncates history.
    // A follow-up UI action should call sendMessage(newContent, originalAttachments, false, false)
    // to resend the edited input.
  },
}));

// Persist basic parts on change (lightweight; will be revisited when migrating fully)
useChatStore.subscribe((state) => {
  try {
    if (state.sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(state.sessions));
    }
    if (state.activeSessionId) {
      localStorage.setItem('activeSessionId', state.activeSessionId);
    }
    localStorage.setItem('geminiApiKey', state.geminiApiKey || '');
    localStorage.setItem('githubToken', state.githubToken || '');
    localStorage.setItem('selectedModel', state.selectedModel || '');
    localStorage.setItem('systemInstruction', state.systemInstruction || '');
  } catch {}
});
