import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import ChatInput, { ChatInputRef } from './components/ChatInput';
import { fetchRepoContents } from './services/githubService';
import { FileContent } from './types';
import { SettingsIcon, BotIcon, GitHubIcon, SyncIcon, MenuIcon } from './components/icons';
import SettingsModal from './components/ApiKeyModal';
import GitHubRepoModal from './components/GitHubRepoModal';
import TokenUsageDisplay from './components/TokenUsageDisplay';
import { GEMINI_MODELS, SUMMARY_THRESHOLD } from './constants';
import { useChatStore } from './store/chatStore';
import { useAutoScroll } from './hooks/useAutoScroll';
import FileContentModal from './components/FileContentModal';
import { Message } from './types';

// Virtual scrolling için MessageList bileşeni
const MessageList: React.FC<{
  messages: Message[];
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
}> = ({ messages, onDelete, onEdit, scrollContainerRef }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtual scrolling ayarları
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Ortalama mesaj yüksekliği tahmini
    overscan: 5, // Görünür alanın üstünde/altında kaç item render edilecek
    // Her bir öğenin gerçek yüksekliğini ölçerek çakışmaları önle (child marginleri dahil)
    measureElement: (element) => {
      const rect = element.getBoundingClientRect();
      let height = rect.height;
      const child = element.firstElementChild as HTMLElement | null;
      if (child) {
        const childRect = child.getBoundingClientRect();
        const style = window.getComputedStyle(child);
        const mt = parseFloat(style.marginTop || '0') || 0;
        const mb = parseFloat(style.marginBottom || '0') || 0;
        const childOuter = childRect.height + mt + mb;
        height = Math.max(height, childOuter);
      }
      return height;
    },
  });
  
  // Scroll container ref'ini parent'a bağla
  useEffect(() => {
    if (scrollContainerRef && parentRef.current) {
      (scrollContainerRef as any).current = parentRef.current;
    }
  }, [scrollContainerRef]);
  
  const items = virtualizer.getVirtualItems();
  
  return (
    <div 
      ref={parentRef} 
      className="flex-1 overflow-y-auto p-4" 
      style={{ overflowAnchor: 'none' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {items.map((virtualItem) => {
          const message = messages[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <MessageBubble
                message={message}
                onDelete={onDelete}
                onEdit={onEdit}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { 
    sessions,
    activeSessionId,
    isLoading,
    isSummarizing,
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
    summarizeAndContinueChat,
    geminiApiKey,
    githubToken,
    selectedModel,
    setSelectedModel,
    hydrate,
    viewingFile,
    isFileViewerOpen,
    openFileViewer,
    closeFileViewer,
  } = useChatStore();
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);
  const [isRepoLoading, setIsRepoLoading] = useState<boolean>(false);

  useEffect(() => {
    hydrate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!geminiApiKey) setShowSettingsModal(true);
  }, [geminiApiKey]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;
  const totalContextTokens = (activeSession?.projectTokenCount || 0) + (activeSession?.historyTokenCount || 0);
  const showSummaryButton = totalContextTokens >= SUMMARY_THRESHOLD;

  const chatInputRef = useRef<ChatInputRef>(null);
  const { scrollContainerRef, scrollToBottomIfNear } = useAutoScroll(activeSession?.messages.length ?? 0, { streaming: isLoading });
  
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
  };
  
  const handleFileSelect = (filePath: string) => {
    chatInputRef.current?.addFileReference(filePath);
  };

  const handleLoadRepo = async (repoUrl: string) => {
    setIsRepoLoading(true);
    try {
      const { files, commitSha } = await fetchRepoContents(repoUrl, githubToken);
      if (files.length === 0) {
        alert("Depo yüklendi fakat analiz edilecek uygun dosya bulunamadı. (Örn: `.gitignore` ile filtrelenmiş olabilir)");
      }
      const repoName = new URL(repoUrl).pathname.substring(1);
      addFilesToContext(files, repoName, repoUrl, commitSha);
      setShowGitHubModal(false);
    } catch (error) {
      console.error("Error processing GitHub repository:", error);
      let errorMessage = `Depo alınırken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`;
      if (error instanceof Error && (error.message.includes('403') || error.message.includes('API limiti'))) {
          errorMessage += '\n\nAPI limitini aştınız. Lütfen Ayarlar\'dan bir GitHub Kişisel Erişim Jetonu (Personal Access Token) ekleyerek tekrar deneyin.';
      }
      alert(errorMessage);
    } finally {
      setIsRepoLoading(false);
    }
  };

  const renderWelcomeScreen = () => (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-24 h-24 bg-gradient-to-tr from-violet-500 to-indigo-500 rounded-full mb-6 flex items-center justify-center">
             <BotIcon className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary mb-2">Gemini Gelişmiş Sohbet</h1>
        <p className="text-secondary max-w-md">
            Sohbete başlayın, bir GitHub deposu yükleyerek kod analizi yapın veya geçmiş sohbetlerinize göz atın.
        </p>
        <div className="mt-8">
            <button
                onClick={() => setShowGitHubModal(true)}
                className="bg-accent-darker hover:bg-accent-dark text-primary font-bold py-3 px-6 rounded-lg transition duration-200 flex items-center"
            >
                <GitHubIcon className="w-5 h-5 mr-2" />
                GitHub Deposu Yükle
            </button>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen font-sans">
      {showSettingsModal && <SettingsModal onClose={() => setShowSettingsModal(false)} />}
      {showGitHubModal && <GitHubRepoModal onLoad={handleLoadRepo} onClose={() => setShowGitHubModal(false)} isLoading={isRepoLoading} />}
      {isFileViewerOpen && <FileContentModal file={viewingFile} onClose={closeFileViewer} />}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        sessions={sessions}
        activeSessionId={activeSession?.id || null}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        projectFiles={activeSession?.projectFiles}
        onFileSelect={handleFileSelect}
        onFileView={openFileViewer}
      />
      
      <main className="flex-1 flex flex-col h-screen min-w-0">
        {isHydrating ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-secondary animate-pulse">Yükleniyor…</div>
          </div>
        ) : activeSession ? (
          <>
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-glass glass-surface">
                <div className="flex items-center gap-2 min-w-0">
                    {!isSidebarOpen && (
                      <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full text-secondary hover:text-primary hover:bg-surface-light transition-colors" aria-label="Kenar çubuğunu aç">
                        <MenuIcon className="w-5 h-5" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <h1 className="text-lg font-semibold truncate pr-4 text-primary">{activeSession.title}</h1>
                      {activeSession.projectRepoUrl && (
                        <div className="flex items-center text-xs text-secondary mt-1">
                          <GitHubIcon className="w-3.5 h-3.5 mr-1.5" />
                          <a href={activeSession.projectRepoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                            {new URL(activeSession.projectRepoUrl).pathname.substring(1)}
                          </a>
                        </div>
                      )}
                    </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <label htmlFor="model-select" className="text-xs text-secondary">Model:</label>
                    <select
                      id="model-select"
                      value={selectedModel}
                      onChange={handleModelChange}
                      className="text-sm bg-surface-light text-primary border border-glass rounded px-2 py-1"
                   >
                      {Object.entries(GEMINI_MODELS).map(([label, value]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                  {!activeSession.projectRepoUrl && (
                    <button
                        onClick={() => setShowGitHubModal(true)}
                        className="flex items-center text-sm text-secondary hover:text-primary transition-colors"
                    >
                        <GitHubIcon className="w-4 h-4 mr-2" />
                        GitHub Deposu Yükle
                    </button>
                  )}
                  {activeSession.projectRepoUrl && (
                      <button 
                        onClick={syncRepo} 
                        disabled={isSyncing}
                        className="flex items-center text-sm text-secondary hover:text-primary disabled:opacity-50 disabled:cursor-wait transition-colors"
                      >
                          <SyncIcon className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                          {isSyncing ? 'Senkronize ediliyor...' : 'Senkronize Et'}
                      </button>
                  )}
                  <TokenUsageDisplay session={activeSession} />
                  <button onClick={() => setShowSettingsModal(true)} className="p-2 rounded-full text-secondary hover:text-primary hover:bg-surface-light transition-colors" aria-label="Ayarlar">
                      <SettingsIcon className="w-5 h-5" />
                  </button>
                </div>
            </header>
            {showSummaryButton && (
              <div className="px-4 py-3 border-b border-glass glass-surface text-sm text-secondary flex items-center justify-between">
                <span>Sohbet bağlamı oldukça uzadı. Yeni bir sohbete özetleyerek devam etmek isteyebilirsiniz.</span>
                <button
                  onClick={summarizeAndContinueChat}
                  disabled={isSummarizing}
                  className="ml-4 bg-accent-darker hover:bg-accent-dark text-primary font-semibold px-3 py-1.5 rounded disabled:bg-surface-lighter disabled:cursor-not-allowed transition-colors"
                >
                  {isSummarizing ? 'Özetleniyor…' : 'Özetleyerek yeni sohbete devam et'}
                </button>
              </div>
            )}
            <MessageList
              messages={activeSession.messages}
              onDelete={deleteMessage}
              onEdit={editMessage}
              scrollContainerRef={scrollContainerRef}
            />
            <ChatInput ref={chatInputRef} onSendMessage={sendMessage} isLoading={isLoading || isSummarizing} onStop={stopGeneration} onFocus={scrollToBottomIfNear} />
          </>
        ) : (
          renderWelcomeScreen()
        )}
      </main>
    </div>
  );
};

export default App;
