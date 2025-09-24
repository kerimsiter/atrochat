import { create } from 'zustand';
import { ChatSession, Message, Role, FileContent, UrlContextMetadata, Attachment } from '../types';
import { getGeminiChatStream, generateSingleResponse, countTokens } from '../services/geminiService';
import { parseFigmaUrl, getFigmaFile, summarizeFigmaFile, getFigmaNode, getFigmaImages, summarizeFigmaNode } from '../services/figmaService';
import { syncRepoChanges } from '../services/githubService';
import { TOKEN_ESTIMATE_FACTOR, COST_PER_MILLION_TOKENS, DEFAULT_SYSTEM_INSTRUCTION } from '../constants';
import type { Content, Part } from '@google/genai';

// Module-scope controllers/state for streaming
let currentStream: AsyncIterable<any> | null = null;
let currentAbort: AbortController | null = null;
let currentModelMessageId: string | null = null;

// Build-time injected by Vite define in vite.config.ts
const BUILD_TIME_GEMINI_API_KEY: string | undefined = (process as any)?.env?.GEMINI_API_KEY;

// Types
interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  isHydrating: boolean;
  isSyncing: boolean;
  isGeneratingInstruction: boolean;
  isSummarizing: boolean;
  geminiApiKey: string;
  githubToken: string;
  figmaToken: string;
  selectedModel?: string;
  systemInstruction: string;
  viewingFile: FileContent | null;
  isFileViewerOpen: boolean;
}

interface ChatActions {
  hydrate: () => void;
  setApiKeys: (keys: { gemini: string; github: string; figma: string }) => void;
  setSelectedModel: (model?: string) => void;
  setSystemInstruction: (instruction: string) => void;
  generateSystemInstruction: () => Promise<void>;
  summarizeAndContinueChat: () => Promise<void>;
  startNewChat: () => void;
  selectChat: (sessionId: string) => void;
  deleteChat: (sessionId: string) => void;
  addFilesToContext: (files: FileContent[], sourceName: string, repoUrl: string, commitSha: string) => void;
  sendMessage: (content: string, attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean) => Promise<void>;
  stopGeneration: () => Promise<void>;
  syncRepo: () => Promise<void>;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, newContent: string) => void;
  openFileViewer: (filePath: string) => void;
  closeFileViewer: () => void;
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
  isGeneratingInstruction: false,
  isSummarizing: false,
  // Prefer localStorage; fallback to build-time env injected via Vite define
  geminiApiKey: localStorage.getItem('geminiApiKey')
    || ((process as any)?.env?.GEMINI_API_KEY || ''),
  githubToken: localStorage.getItem('githubToken') || localStorage.getItem('githubPat') || '',
  figmaToken: localStorage.getItem('figmaToken') || '',
  selectedModel: localStorage.getItem('selectedModel') || localStorage.getItem('selectedGeminiModel') || undefined,
  systemInstruction: localStorage.getItem('systemInstruction') || DEFAULT_SYSTEM_INSTRUCTION,
  viewingFile: null,
  isFileViewerOpen: false,

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
            geminiApiKey:
              localStorage.getItem('geminiApiKey')
              || get().geminiApiKey
              || ((process as any)?.env?.GEMINI_API_KEY || ''),
            githubToken: localStorage.getItem('githubToken') || localStorage.getItem('githubPat') || get().githubToken,
            figmaToken: localStorage.getItem('figmaToken') || get().figmaToken,
            selectedModel: localStorage.getItem('selectedModel') || localStorage.getItem('selectedGeminiModel') || get().selectedModel,
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

  summarizeAndContinueChat: async () => {
    const { activeSessionId, sessions, geminiApiKey, selectedModel } = get();
    if (!activeSessionId) return;
    const current = sessions.find(s => s.id === activeSessionId);
    if (!current) return;
    if (!geminiApiKey) {
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: 'Özetleme için Gemini API anahtarı gerekli. Lütfen Ayarlar’dan ekleyin.',
        timestamp: new Date().toISOString(),
      };
      set({ sessions: sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s) });
      return;
    }
    set({ isSummarizing: true });
    try {
      // 1) Sohbeti transkripte çevir (yalnızca USER/MODEL)
      const transcript = current.messages
        .filter(m => m.role === Role.USER || m.role === Role.MODEL)
        .map(m => `${m.role === Role.USER ? 'Kullanıcı' : 'Asistan'}: ${((m as any).apiContent || m.content).trim()}`)
        .join('\n');

      // 2) Özetleme prompt'u
      const prompt = `Aşağıdaki uzun sohbet geçmişini, mevcut teknik konu ve alınan kararları kaybetmeden kısa ve eyleme dönük bir özete dönüştür.

İstekler:
- Türkçe yaz.
- 6-12 madde arasında, net ve başlık/alt başlıklarla düzenli bir özet oluştur.
- Son konuşulan konu, açık kalan sorular, alınmış kararlar ve bir sonraki adımlar mutlaka yer alsın.
- Gerekirse kod bloklarıyla çok kısa örnek ver; gereksiz ayrıntıya girme.

Sohbet Geçmişi (özetle):
"""
${transcript}
"""

Çıktı:
- Sadece özet metnini döndür. Kullanıcıya gösterilecek SYSTEM mesajı şeklinde, kısa bir giriş cümlesiyle başla (örn. "Önceki sohbetin özeti ve devam bağlamı") ve ardından maddeleri listele.`;

      // 3) Model çağrısı
      const summary = await generateSingleResponse(geminiApiKey, prompt, selectedModel);
      const summaryText = (summary || '').trim();

      // 4) Yeni oturum oluştur ve bağlamı taşı
      const newSession = createInitialSession();
      newSession.title = (current.title || 'Sohbet') + ' (Devamı)';
      newSession.projectFiles = current.projectFiles ? [...current.projectFiles] : [];
      newSession.projectTokenCount = current.projectTokenCount || 0;
      (newSession as any).projectRepoUrl = (current as any).projectRepoUrl;
      (newSession as any).projectCommitSha = (current as any).projectCommitSha;
      newSession.isContextStale = true; // İlk mesajla proje bağlamını yeniden taşıyabilmek için

      // 5) Özeti yeni oturuma SYSTEM mesajı olarak ekle
      const systemSummary: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: summaryText.length > 0 ? summaryText : 'Özet oluşturulamadı. Mevcut sohbetten devam edebilirsiniz.',
        timestamp: new Date().toISOString(),
      };
      newSession.messages = [systemSummary];

      // 6) State güncelle
      set((state) => ({ sessions: [newSession, ...state.sessions], activeSessionId: newSession.id }));
    } catch (error) {
      console.error('Özetleme hatası:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: 'Sohbet özetlenirken bir hata oluştu.',
        timestamp: new Date().toISOString(),
      };
      set({ sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s) });
    } finally {
      set({ isSummarizing: false });
    }
  },

  setApiKeys: ({ gemini, github, figma }) => {
    set({ geminiApiKey: gemini, githubToken: github, figmaToken: figma });
    try {
      localStorage.setItem('geminiApiKey', gemini);
      localStorage.setItem('githubToken', github);
      localStorage.setItem('figmaToken', figma);
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

  generateSystemInstruction: async () => {
    const { activeSessionId, sessions, geminiApiKey, selectedModel } = get();
    if (!activeSessionId) return;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return;
    const projectFiles = session.projectFiles || [];
    if (!geminiApiKey) {
      console.warn('Gemini API anahtarı eksik.');
      return;
    }
    if (projectFiles.length === 0) {
      console.warn('Proje dosyaları yok.');
      return;
    }
    set({ isGeneratingInstruction: true });
    try {
      const filesBrief = projectFiles
        .slice(0, 20) // aşırı uzunluk riskini azaltmak için sınırla
        .map(f => `- ${f.path} (${Math.ceil(f.content.length/ TOKEN_ESTIMATE_FACTOR)} ~tokens)`)
        .join('\n');

      const sampleContent = projectFiles
        .slice(0, 6)
        .map(f => `--- DOSYA: ${f.path} ---\n\u0060\u0060\u0060\n${f.content.substring(0, 2000)}\n\u0060\u0060\u0060`)
        .join('\n\n');

      const prompt = `Bir sohbet asistanı için proje-özgü ve kısa bir Sistem Talimatı yaz.\n\nHedefler:\n- Projenin kod yapısını ve teknolojilerini anla.\n- Yanıtlarda kısa ve eyleme dönük ol.\n- Karmaşık görevlerde önce 2-5 maddelik mini plan yaz, sonra cevabı ver.\n- Kod yanıtlarda uygun dil ve stil kurallarını uygula.\n- Gereksiz jargondan kaçın, Türkçe yanıt ver.\n\nKısıtlar:\n- 250-500 kelime arası tut.\n- Gerektiğinde few-shot tarzı küçük bir örnek ekleyebilirsin.\n- Güvenlik ve gizlilik: gizli anahtarları asla isteme veya loglama.\n\nProje Dosya Özeti:\n${filesBrief}\n\nÖrnek İçerikler:\n${sampleContent}\n\nÇıktı: Sadece sistem talimatı metnini döndür.`;

      const result = await generateSingleResponse(geminiApiKey, prompt, selectedModel);
      if (result && result.trim().length > 0) {
        set({ systemInstruction: result.trim() });
        try { localStorage.setItem('systemInstruction', result.trim()); } catch {}
      }
    } catch (error) {
      console.error('Sistem talimatı oluşturulamadı:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now()}`,
        role: Role.SYSTEM,
        content: 'AI ile sistem talimatı oluşturulurken bir hata oluştu.',
        timestamp: new Date().toISOString(),
      };
      set({ sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s) });
    } finally {
      set({ isGeneratingInstruction: false });
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

    // Hızlı gösterim için tahmini token sayımı
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

    // Arka planda kesin token sayımı (tek çağrı için içerikleri birleştir)
    (async () => {
      try {
        const apiKey = get().geminiApiKey;
        const model = get().selectedModel;
        if (!apiKey) return;
        const joined = files.map(f => f.content).join('\n');
        const precise = await countTokens(apiKey, joined, model);
        set({
          sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, projectTokenCount: precise } : s)
        });
      } catch {}
    })();
  },

  // Implemented actions migrated from useChatManager
  sendMessage: async (messageContent, attachments, useUrlAnalysis, useGoogleSearch) => {
    const state = get();
    const { activeSessionId, sessions, geminiApiKey, figmaToken } = state;
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
    let imageAttachment: Attachment | null = null;
    const pendingUpdate = (currentSession as any).pendingContextUpdate;
    const projectFiles = currentSession.projectFiles || [];
    const isSendingFullContext = currentSession.isContextStale && projectFiles.length > 0;

    // 1) Öncelik: Kullanıcının açık referansları (@dosya veya @klasör/)
    const refRegex = /@([A-Za-z0-9_\/.\-]+\/?)/g;
    const matches = [...messageContent.matchAll(refRegex)].map(m => m[1]);
    if (matches.length > 0 && projectFiles.length > 0) {
      const uniqueRefs = Array.from(new Set(matches));
      const selectedFiles: FileContent[] = [];
      for (const ref of uniqueRefs) {
        const isFolder = ref.endsWith('/');
        const normalized = ref.replace(/^\/?/, ''); // baştaki / kaldır
        for (const f of projectFiles) {
          if ((isFolder && f.path.startsWith(normalized)) || (!isFolder && f.path === normalized)) {
            if (!selectedFiles.find(sf => sf.path === f.path)) selectedFiles.push(f);
          }
        }
      }
      if (selectedFiles.length > 0) {
        const contextPreamble = `Aşağıdaki dosya/klasör referanslarını dikkate alarak yanıt ver:\n\n${selectedFiles
          .map(f => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``)
          .join('\n\n')}\n\n--- SORU ---\n`;
        const stripped = messageContent.replace(refRegex, '').replace(/\s+/g, ' ').trim();
        apiMessageContent = contextPreamble + (stripped.length > 0 ? stripped : 'Yukarıdaki bağlama göre devam et.');
      }
    }

    // 2) Referans yoksa ve bağlam bayrağı açıksa tüm proje bağlamını ekle
    if (apiMessageContent === messageContent && isSendingFullContext) {
      apiMessageContent = `Aşağıdaki proje dosyalarını analiz et. Bu dosyalardaki bilgilere dayanarak yanıt ver:\n\n${projectFiles.map(f => `--- DOSYA: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``).join('\n\n')}\n\n--- SORU ---\n${messageContent}`;
    } else if (apiMessageContent === messageContent && pendingUpdate) {
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

    // 3) Figma link detection and processing
    if (useUrlAnalysis && figmaToken) {
      const figmaLinkData = parseFigmaUrl(messageContent);

      if (figmaLinkData && figmaLinkData.fileKey) {
        const { fileKey, nodeId } = figmaLinkData;

        // Kullanıcıya analiz başladığını bildiren bir sistem mesajı ekleyelim
        const systemMessage: Message = {
          id: `msg-${Date.now()}`,
          role: Role.SYSTEM,
          content: `Figma linki algılandı. Tasarım verileri analiz ediliyor: ${fileKey}${nodeId ? ` (Node: ${nodeId})` : ''}`,
          timestamp: new Date().toISOString(),
        };
        set({ sessions: sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, systemMessage] } : s) });

        try {
          const [nodeData, images] = await Promise.all([
            nodeId ? getFigmaNode(fileKey, nodeId, figmaToken) : getFigmaFile(fileKey, figmaToken),
            nodeId ? getFigmaImages(fileKey, [nodeId], figmaToken) : Promise.resolve(null),
          ]);

          if (!nodeData) {
            throw new Error('Figma node data could not be fetched. Node may not exist or you may not have access to it.');
          }

          const summary = summarizeFigmaNode(nodeId ? nodeData : nodeData.document.children[0]);
          const jsonData = JSON.stringify(nodeData, null, 2);
          const truncatedJson = jsonData.length > 8000 ? jsonData.substring(0, 8000) + '\n...' : jsonData;

          apiMessageContent = `Bir Figma tasarım bileşeni/ekranı hakkında soru soruluyor. Yanıtını aşağıdaki özet ve JSON verilerine dayandır. JSON'daki children hiyerarşisini, fills, strokes, effects gibi stil özelliklerini ve characters (metin) içeriğini kullanarak spesifik soruları yanıtla.\n\n--- TASARIM ÖZETİ ---\n${summary}\n\n--- DETAYLI JSON VERİSİ ---\n\`\`\`json\n${truncatedJson}\n\`\`\`\n\n--- KULLANICI SORUSU ---\n${messageContent.replace(/https?:\/\/www\.figma\.com\/[^\s]+/g, '').trim()}`;

          if (images && nodeId && images[nodeId]) {
            imageAttachment = {
              name: 'Figma Preview',
              type: 'image/png',
              data: images[nodeId], // Bu bir URL
            };
          }

        } catch (error) {
          console.error('Figma analysis error:', error);
          const errorMessage: Message = {
            id: `msg-${Date.now() + 1}`,
            role: Role.SYSTEM,
            content: `Figma dosyası analiz edilirken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}. Lütfen Figma linkinin doğru olduğundan ve erişim izninizin bulunduğundan emin olun.`,
            timestamp: new Date().toISOString(),
          };
          set({
            sessions: get().sessions.map(s => s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMessage] } : s),
            isLoading: false
          });
          return; // Hata durumunda işlemi durdur
        }
      }
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: Role.USER,
      content: messageContent,
      apiContent: apiMessageContent,
      attachments: [...attachments, ...(imageAttachment ? [imageAttachment] : [])],
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
        // Commit SHA'yı, güncelleme gerçekten AI'a gönderildiği anda güncelle
        projectCommitSha: pendingUpdate?.newCommitSha ?? s.projectCommitSha,
        // pending güncellemeyi tükettik
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

    // Kesin giriş token sayımı (mümkünse)
    let inputTokens = estimateTokens(finalPartsForApi.map(p => 'text' in p ? (p as any).text : '').join(''));
    try {
      const apiKey = get().geminiApiKey;
      const model = get().selectedModel;
      if (apiKey) {
        const inputText = finalPartsForApi
          .map(p => (p as any).text)
          .filter(Boolean)
          .join('');
        if (inputText.length > 0) {
          inputTokens = await countTokens(apiKey, inputText, model);
        }
      }
    } catch {}
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

      // Batch updates to reduce re-renders during streaming
      let updateCounter = 0;
      let lastUpdateTime = Date.now();
      const UPDATE_THRESHOLD = 100; // Update every 100ms minimum
      let pendingUpdate = false;
      
      const applyUpdate = () => {
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
        pendingUpdate = false;
        lastUpdateTime = Date.now();
      };

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

        // Batch updates to improve performance
        updateCounter++;
        const timeSinceLastUpdate = Date.now() - lastUpdateTime;
        
        // Update immediately for first chunk, then batch updates
        if (updateCounter === 1 || timeSinceLastUpdate >= UPDATE_THRESHOLD) {
          applyUpdate();
        } else {
          pendingUpdate = true;
        }
      }
      
      // Apply any pending update at the end
      if (pendingUpdate) {
        applyUpdate();
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
      // Kesin çıkış token sayımı (mümkünse)
      let outputTokens = estimateTokens(modelResponse);
      try {
        const apiKey = get().geminiApiKey;
        const model = get().selectedModel;
        if (apiKey && modelResponse.trim().length > 0) {
          outputTokens = await countTokens(apiKey, modelResponse, model);
        }
      } catch {}
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
      // Eğer bekleyen bir güncelleme varsa, karşılaştırma tabanı olarak onun SHA'sını kullan
      const pending = (currentSession as any).pendingContextUpdate;
      const baseShaForCompare = pending?.newCommitSha || currentSession.projectCommitSha;
      const { newCommitSha, addedFiles, modifiedFiles, removedPaths, hasChanges } = await syncRepoChanges(
        currentSession.projectRepoUrl,
        baseShaForCompare,
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

        // Mevcut pendingContextUpdate ile yeni değişiklikleri birleştir
        const existingPending = (s as any).pendingContextUpdate || { added: [], modified: [], removed: [], newCommitSha: baseShaForCompare };
        const addedMap = new Map<string, any>();
        const modifiedMap = new Map<string, any>();
        const removedSet = new Set<string>(existingPending.removed || []);

        // Önce mevcut pending'i uygula
        (existingPending.added || []).forEach((f: any) => { addedMap.set(f.path, f); modifiedMap.delete(f.path); removedSet.delete(f.path); });
        (existingPending.modified || []).forEach((f: any) => { if (!addedMap.has(f.path)) modifiedMap.set(f.path, f); removedSet.delete(f.path); });

        // Sonra yeni değişiklikleri uygula
        addedFiles.forEach((f: any) => { addedMap.set(f.path, f); modifiedMap.delete(f.path); removedSet.delete(f.path); });
        modifiedFiles.forEach((f: any) => { if (!addedMap.has(f.path)) modifiedMap.set(f.path, f); removedSet.delete(f.path); });
        removedPaths.forEach((p: string) => { addedMap.delete(p); modifiedMap.delete(p); removedSet.add(p); });

        const mergedPending = {
          added: Array.from(addedMap.values()),
          modified: Array.from(modifiedMap.values()),
          removed: Array.from(removedSet.values()),
          newCommitSha,
        };
        return {
          ...s,
          projectFiles: updatedFiles,
          // Commit SHA'yı hemen güncelleme; bir sonraki mesajda AI'a bağlam aktarılırken güncelleyeceğiz
          projectTokenCount: newProjectTokenCount,
          pendingContextUpdate: mergedPending,
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

  openFileViewer: (filePath) => {
    const { activeSessionId, sessions } = get();
    if (!activeSessionId) return;
    const current = sessions.find(s => s.id === activeSessionId);
    if (!current || !current.projectFiles) return;
    const file = current.projectFiles.find(f => f.path === filePath) || null;
    if (file) set({ viewingFile: file, isFileViewerOpen: true });
  },

  closeFileViewer: () => {
    set({ isFileViewerOpen: false, viewingFile: null });
  },
}));

// Debounced localStorage persistence to avoid performance issues during streaming
let persistTimeoutId: NodeJS.Timeout | null = null;
let lastIsLoading = false;

const persistToLocalStorage = (state: ChatStore) => {
  try {
    if (state.sessions.length > 0) {
      localStorage.setItem('chatSessions', JSON.stringify(state.sessions));
    }
    if (state.activeSessionId) {
      localStorage.setItem('activeSessionId', state.activeSessionId);
    }
    localStorage.setItem('geminiApiKey', state.geminiApiKey || '');
    localStorage.setItem('figmaToken', state.figmaToken || '');
    localStorage.setItem('selectedModel', state.selectedModel || '');
    localStorage.setItem('systemInstruction', state.systemInstruction || '');
  } catch {}
};

useChatStore.subscribe((state) => {
  // Skip persistence during active streaming to avoid performance issues
  if (state.isLoading || state.isSummarizing || state.isSyncing || state.isGeneratingInstruction) {
    lastIsLoading = true;
    return;
  }
  
  // If we just finished loading, persist immediately
  if (lastIsLoading) {
    lastIsLoading = false;
    persistToLocalStorage(state);
    return;
  }
  
  // For other changes, debounce the persistence
  if (persistTimeoutId) {
    clearTimeout(persistTimeoutId);
  }
  
  persistTimeoutId = setTimeout(() => {
    persistToLocalStorage(state);
    persistTimeoutId = null;
  }, 500); // 500ms debounce
});
