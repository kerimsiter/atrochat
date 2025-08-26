import React from 'react';
import { ChatSession, FileContent } from '../types';
import { PlusIcon, ChatBubbleIcon, TrashIcon } from './icons';
import FileTree from './FileTree';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  projectFiles: FileContent[] | undefined;
  onFileSelect: (filePath: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectChat, onDeleteChat, projectFiles, onFileSelect }) => {
  const filePaths = projectFiles?.map(f => f.path) || [];

  return (
    <div className="glass-surface w-80 p-4 flex flex-col h-full border-r border-glass">
      <div className="flex-shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center bg-accent-darker hover:bg-accent-dark text-primary font-bold py-2 px-4 rounded-lg transition-colors duration-200"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Yeni Sohbet
        </button>
      </div>
      <div className="mt-6 flex-grow overflow-y-auto pr-2">
        <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Sohbet Geçmişi</h2>
        <ul className="space-y-2">
          {sessions.map(session => (
            <li key={session.id}>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onSelectChat(session.id);
                }}
                className={`flex items-center p-2 text-sm rounded-md group transition-colors duration-200 ${
                  session.id === activeSessionId ? 'bg-surface-light text-primary' : 'text-secondary hover:bg-surface-light hover:text-primary'
                }`}
              >
                <ChatBubbleIcon className="w-5 h-5 mr-3 text-secondary/70" />
                <span className="flex-1 truncate">{session.title}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
                  className="ml-2 p-1 text-secondary/70 hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Sohbeti sil: ${session.title}`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </a>
            </li>
          ))}
        </ul>
      </div>

      {filePaths.length > 0 && (
        <div className="mt-4 pt-4 border-t border-glass flex-shrink-0 max-h-64 overflow-y-auto">
            <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-2">Proje Dosyaları</h2>
            <FileTree paths={filePaths} onFileSelect={onFileSelect} />
        </div>
      )}

    </div>
  );
};

export default Sidebar;