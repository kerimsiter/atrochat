import React, { useEffect } from 'react';
import { FileContent } from '../types';
import CodeBlock from './CodeBlock';
import { FileIcon } from './icons';

interface FileContentModalProps {
  file: FileContent | null;
  onClose: () => void;
}

const FileContentModal: React.FC<FileContentModalProps> = ({ file, onClose }) => {
  // Kapama: ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey as any);
    return () => window.removeEventListener('keydown', onKey as any);
  }, [onClose]);

  if (!file) return null;

  const lang = (file.path.split('.').pop() || 'plaintext').toLowerCase();

  return (
    <div
      className="fixed inset-0 bg-obsidian/80 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-surface rounded-lg shadow-2xl w-full max-w-4xl h-[80vh] border border-glass flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-glass">
          <div className="flex items-center gap-2 text-primary min-w-0">
            <FileIcon className="w-5 h-5 text-secondary" />
            <span className="font-mono text-xs truncate" title={file.path}>{file.path}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-secondary hover:text-primary hover:bg-surface-light transition-colors"
            aria-label="Kapat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <CodeBlock language={lang} content={file.content} />
        </div>
      </div>
    </div>
  );
};

export default FileContentModal;
