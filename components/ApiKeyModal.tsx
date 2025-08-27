
import React, { useEffect, useState } from 'react';
import { KeyIcon, GitHubIcon, BotIcon } from './icons';
import { useChatStore } from '../store/chatStore';
import { DEFAULT_SYSTEM_INSTRUCTION } from '../constants';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const {
    geminiApiKey: storedGeminiKey,
    githubToken: storedGithubToken,
    systemInstruction: storedInstruction,
    isGeneratingInstruction,
    generateSystemInstruction,
    setApiKeys,
    setSystemInstruction,
  } = useChatStore();
  const [geminiApiKey, setGeminiApiKey] = useState(storedGeminiKey || '');
  const [githubToken, setGithubToken] = useState(storedGithubToken || '');
  const [systemInstruction, setSystemInstructionLocal] = useState(storedInstruction || '');

  useEffect(() => {
    setSystemInstructionLocal(storedInstruction || '');
  }, [storedInstruction]);

  const handleSave = () => {
    setApiKeys({ gemini: geminiApiKey.trim(), github: githubToken.trim() });
    setSystemInstruction(systemInstruction.trim());
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  }

  return (
    <div className="fixed inset-0 bg-obsidian/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="glass-surface rounded-lg shadow-xl p-5 w-full max-w-md border border-glass" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Gemini API Key Section (compact) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-secondary" />
              <h2 className="text-base font-semibold text-primary">API Anahtarı</h2>
            </div>
            <label htmlFor="gemini_api_key" className="sr-only">Gemini API Anahtarı</label>
            <input
              id="gemini_api_key"
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="Gemini API Key"
              className="w-full bg-surface-light text-primary rounded-md px-3 py-2 focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass text-sm"
              aria-label="Gemini API Anahtarı"
              required
            />
          </div>

          {/* System Instruction Section (compact) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <BotIcon className="w-5 h-5 text-secondary" />
                <h3 className="text-base font-semibold text-primary">Sistem Talimatı</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={generateSystemInstruction}
                  disabled={isGeneratingInstruction || !geminiApiKey.trim()}
                  className="text-xs bg-accent-darker text-primary font-semibold py-1 px-2 rounded-md hover:bg-accent-dark disabled:bg-surface-lighter disabled:text-secondary/60 disabled:cursor-not-allowed transition-colors"
                  aria-busy={isGeneratingInstruction}
                  aria-label="AI ile sistem talimatı oluştur"
                  title="Proje dosyalarına göre sistem talimatını AI ile oluştur"
                >
                  {isGeneratingInstruction ? 'Oluşturuluyor…' : '✨ AI ile Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => { setSystemInstructionLocal(DEFAULT_SYSTEM_INSTRUCTION); setSystemInstruction(DEFAULT_SYSTEM_INSTRUCTION); }}
                  disabled={isGeneratingInstruction}
                  className="text-xs bg-surface-light text-primary font-semibold py-1 px-2 rounded-md hover:bg-surface-lighter border border-glass disabled:text-secondary/60 disabled:cursor-not-allowed transition-colors"
                  title="Varsayılan sistem talimatına dön"
                >
                  Varsayılana Sıfırla
                </button>
              </div>
            </div>
            <label htmlFor="system_instruction" className="sr-only">Sistem Talimatı</label>
            <textarea
              id="system_instruction"
              value={systemInstruction}
              onChange={(e) => setSystemInstructionLocal(e.target.value)}
              placeholder="Sistem talimatı (opsiyonel)"
              className="w-full bg-surface-light text-primary rounded-md px-3 py-2 h-20 resize-y focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass text-sm"
              aria-label="Sistem Talimatı"
            />
            <p className="text-xs text-secondary/70 mt-1">
              Bu talimat her istekte gönderilir ve jeton maliyetini etkiler. Mümkün olduğunca kısa ve öz tutmaya çalışın.
            </p>
          </div>

          {/* GitHub Token Section (compact) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <GitHubIcon className="w-5 h-5 text-secondary" />
              <h3 className="text-base font-semibold text-primary">GitHub Token</h3>
            </div>
            <label htmlFor="github_token" className="sr-only">GitHub Token</label>
            <input
              id="github_token"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="GitHub Token (opsiyonel)"
              className="w-full bg-surface-light text-primary rounded-md px-3 py-2 focus:ring-2 focus:ring-accent-dark focus:outline-none transition placeholder-secondary/70 border border-glass text-sm"
              aria-label="GitHub Token"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-surface-light text-primary font-medium py-2 px-3 rounded-md hover:bg-surface-lighter transition-colors text-sm"
            >
              İptal
            </button>
            <button
              type="submit"
              disabled={!geminiApiKey.trim()}
              className="bg-accent-darker text-primary font-semibold py-2 px-3 rounded-md hover:bg-accent-dark disabled:bg-surface-lighter disabled:cursor-not-allowed transition-colors text-sm"
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
