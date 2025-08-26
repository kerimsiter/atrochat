import React, { useState } from 'react';
import { ClipboardIcon, CheckIcon } from './icons';

interface CodeBlockProps {
  language: string;
  content: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, content }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-surface rounded-lg my-4 border border-glass">
      <div className="flex justify-between items-center px-4 py-2 bg-obsidian/50 rounded-t-md">
        <span className="text-xs font-sans text-secondary select-none">{language || 'code'}</span>
        <button 
          onClick={handleCopy} 
          className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
        >
          {isCopied ? <CheckIcon className="w-4 h-4 text-positive" /> : <ClipboardIcon className="w-4 h-4" />}
          {isCopied ? 'Kopyalandı!' : 'Kopyala'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        <code className="text-sm text-cyan-300 font-mono">{content}</code>
      </pre>
    </div>
  );
};

export default CodeBlock;