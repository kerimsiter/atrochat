import React, { useState } from 'react';
import { GitHubIcon, KeyIcon } from './icons';

interface SettingsModalProps {
  onSave: (keys: { gemini: string; github: string }) => void;
  onClose: () => void;
  currentGitHubToken: string | null;
  currentGeminiApiKey: string | null;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onSave, onClose, currentGitHubToken, currentGeminiApiKey }) => {
  const [githubToken, setGithubToken] = useState(currentGitHubToken || '');
  const [geminiApiKey, setGeminiApiKey] = useState(currentGeminiApiKey || '');

  const handleSave = () => {
    onSave({
      gemini: geminiApiKey.trim(),
      github: githubToken.trim(),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  }

  return (
    <div className="fixed inset-0 bg-obsidian/80 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-surface rounded-lg shadow-2xl p-8 w-full max-w-lg border border-glass" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          {/* Gemini API Key Section */}
          <div className="flex items-center mb-4">
            <KeyIcon className="w-8 h-8 text-secondary mr-4" />
            <h2 className="text-2xl font-bold text-primary">API Anahtarları</h2>
          </div>
          <p className="text-secondary mb-6">
            Uygulamayı kullanmak için Gemini API anahtarınızı girmeniz gerekmektedir.
          </p>
          <div className="mb-6">
            <label htmlFor="gemini_api_key" className="block text-sm font-medium text-secondary mb-2">Gemini API Anahtarı</label>
            <input
              id="gemini_api_key"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Google AI Studio'dan alınan anahtar"
              className="w-full bg-surface-light text-primary rounded-lg p-3 focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass"
              aria-label="Gemini API Anahtarı"
              required
            />
          </div>

          <div className="border-t border-glass my-8"></div>

          {/* GitHub Token Section */}
          <div className="flex items-center mb-4">
            <GitHubIcon className="w-8 h-8 text-secondary mr-4" />
            <h2 className="text-2xl font-bold text-primary">GitHub Entegrasyonu</h2>
          </div>
          <p className="text-secondary mb-4">
            GitHub API limitlerine takılmamak için bir Kişisel Erişim Jetonu (Personal Access Token) ekleyebilirsiniz. Bu isteğe bağlıdır.
          </p>
          <div>
            <label htmlFor="github_token" className="block text-sm font-medium text-secondary mb-2">GitHub Kişisel Erişim Jetonu (İsteğe Bağlı)</label>
            <input
              id="github_token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full bg-surface-light text-primary rounded-lg p-3 focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass"
              aria-label="GitHub Kişisel Erişim Jetonu"
            />
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-surface-light text-primary font-bold py-3 px-6 rounded-lg hover:bg-surface-lighter transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!geminiApiKey.trim()}
              className="bg-accent-darker text-primary font-bold py-3 px-6 rounded-lg hover:bg-accent-dark disabled:bg-surface-lighter disabled:cursor-not-allowed transition-colors"
            >
              Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsModal;