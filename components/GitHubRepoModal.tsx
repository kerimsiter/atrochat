import React, { useState } from 'react';
import { GitHubIcon } from './icons';

interface GitHubRepoModalProps {
  onLoad: (repoUrl: string) => void;
  onClose: () => void;
  isLoading: boolean;
}

const GitHubRepoModal: React.FC<GitHubRepoModalProps> = ({ onLoad, onClose, isLoading }) => {
  const [url, setUrl] = useState('');

  const handleLoad = () => {
    if (url.trim() && !isLoading) {
      onLoad(url.trim());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLoad();
  };

  return (
    <div className="fixed inset-0 bg-obsidian/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-surface rounded-lg shadow-2xl p-8 w-full max-w-lg border border-glass relative" onClick={e => e.stopPropagation()}>
        <div className="flex items-center mb-6">
          <GitHubIcon className="w-8 h-8 text-secondary mr-4" />
          <h2 className="text-2xl font-bold text-primary">GitHub Deposu Yükle</h2>
        </div>
        <p className="text-secondary mb-6">
          Analiz için genel (public) bir GitHub deposunun URL'sini girin. Depodaki dosyalar `.gitignore` kurallarına göre filtrelenecektir.
        </p>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-grow bg-surface-light text-primary rounded-lg p-3 focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass"
            aria-label="GitHub Repository URL"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="bg-accent-darker text-primary font-bold py-3 px-6 rounded-lg hover:bg-accent-dark disabled:bg-surface-lighter disabled:cursor-not-allowed transition-colors w-32"
          >
            {isLoading ? 'Yükleniyor...' : 'Yükle'}
          </button>
        </form>
         <button onClick={onClose} className="absolute top-4 right-4 text-secondary/70 hover:text-primary transition-colors" aria-label="Kapat">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
         </button>
      </div>
    </div>
  );
};

export default GitHubRepoModal;