
import React, { useState } from 'react';
//- Fix: Removed unused KeyIcon
import { GitHubIcon } from './icons';

interface SettingsModalProps {
  //- Fix: Updated onSave handler to only manage github token
  onSave: (keys: { github: string }) => void;
  onClose: () => void;
  currentGitHubToken: string | null;
  //- Fix: Removed Gemini API Key prop
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onSave, onClose, currentGitHubToken }) => {
  const [githubToken, setGithubToken] = useState(currentGitHubToken || '');
  //- Fix: Removed state for Gemini API Key

  const handleSave = () => {
    onSave({
      //- Fix: Removed gemini key from save payload
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
          {/*-//- Fix: Removed Gemini API Key section from the modal*/}

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
              //- Fix: Removed disabled check for Gemini API Key
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
