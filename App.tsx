import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MessageBubble from './components/MessageBubble';
import ChatInput, { ChatInputRef } from './components/ChatInput';
import { useChatManager } from './hooks/useChatManager';
import { fetchRepoContents } from './services/githubService';
import { FileContent } from './types';
import { FileIcon, SettingsIcon, BotIcon, GitHubIcon, SyncIcon } from './components/icons';
import SettingsModal from './components/ApiKeyModal';
import GitHubRepoModal from './components/GitHubRepoModal';
import TokenUsageDisplay from './components/TokenUsageDisplay';

const App: React.FC = () => {
  const [githubToken, setGithubToken] = useState<string | null>(() => localStorage.getItem('githubPat'));
  const [geminiApiKey, setGeminiApiKey] = useState<string | null>(() => localStorage.getItem('geminiApiKey'));
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showGitHubModal, setShowGitHubModal] = useState<boolean>(false);
  const [isRepoLoading, setIsRepoLoading] = useState<boolean>(false);

  useEffect(() => {
    // If there is no API key on initial load, show the settings modal.
    if (!geminiApiKey) {
      setShowSettingsModal(true);
    }
  }, [geminiApiKey]);


  const {
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
  } = useChatManager(geminiApiKey, githubToken);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, isLoading]);
  
  const handleSaveSettings = (keys: { gemini: string; github: string }) => {
    localStorage.setItem('geminiApiKey', keys.gemini);
    setGeminiApiKey(keys.gemini);
    localStorage.setItem('githubPat', keys.github);
    setGithubToken(keys.github);
    setShowSettingsModal(false);
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
      {showSettingsModal && <SettingsModal onSave={handleSaveSettings} onClose={() => setShowSettingsModal(false)} currentGitHubToken={githubToken} currentGeminiApiKey={geminiApiKey} />}
      {showGitHubModal && <GitHubRepoModal onLoad={handleLoadRepo} onClose={() => setShowGitHubModal(false)} isLoading={isRepoLoading} />}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSession?.id || null}
        onNewChat={startNewChat}
        onSelectChat={selectChat}
        onDeleteChat={deleteChat}
        projectFiles={activeSession?.projectFiles}
        onFileSelect={handleFileSelect}
      />
      
      <main className="flex-1 flex flex-col h-screen">
        {activeSession ? (
          <>
            <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-glass glass-surface">
                <div>
                    <h1 className="text-lg font-semibold truncate pr-4 text-primary">{activeSession.title}</h1>
                    {activeSession.projectRepoUrl && (
                      <div className="flex items-center text-xs text-secondary mt-1">
                        <GitHubIcon className="w-3.5 h-3.5 mr-1.5" />
                        <a href={activeSession.projectRepoUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                          {new URL(activeSession.projectRepoUrl).pathname.substring(1)}
                        </a>
                      </div>
                    )}
                </div>
                <div className="flex items-center gap-4">
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
            <div className="flex-1 overflow-y-auto p-4">
                {activeSession.messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} onDelete={deleteMessage} onEdit={editMessage} />
                ))}
                {isLoading && (
                  <div className="flex items-start gap-3 my-4 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-light flex items-center justify-center"><BotIcon className="w-5 h-5" /></div>
                    <div className="px-4 py-3 rounded-lg bg-surface-light text-primary rounded-bl-none">
                      <div className="flex items-center">
                        <span className="text-sm text-secondary animate-pulse">Yazıyor...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <ChatInput ref={chatInputRef} onSendMessage={sendMessage} isLoading={isLoading} />
          </>
        ) : (
          renderWelcomeScreen()
        )}
      </main>
    </div>
  );
};

export default App;