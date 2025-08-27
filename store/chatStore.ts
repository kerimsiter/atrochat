import { create } from 'zustand';
import { ChatSession, Message, Role, FileContent, UrlContextMetadata, Attachment } from '../types';

// Types
interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  isHydrating: boolean;
  isSyncing: boolean;
}

interface ChatActions {
  hydrate: () => void;
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
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

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

  // Actions
  hydrate: () => {
    try {
      const savedSessions = localStorage.getItem('chatSessions');
      if (savedSessions) {
        const parsed = JSON.parse(savedSessions) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ sessions: parsed, activeSessionId: localStorage.getItem('activeSessionId') || parsed[0].id });
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

  // Placeholders to be fully implemented by migrating logic from useChatManager
  sendMessage: async () => {
    console.warn('sendMessage() is not yet implemented in chatStore.');
  },
  stopGeneration: async () => {
    console.warn('stopGeneration() is not yet implemented in chatStore.');
  },
  syncRepo: async () => {
    console.warn('syncRepo() is not yet implemented in chatStore.');
  },
  deleteMessage: () => {
    console.warn('deleteMessage() is not yet implemented in chatStore.');
  },
  editMessage: () => {
    console.warn('editMessage() is not yet implemented in chatStore.');
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
  } catch {}
});
