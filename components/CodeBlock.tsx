import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ClipboardIcon, CheckIcon } from './icons';

interface CodeBlockProps {
  language: string;
  content: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, content }) => {
  const [isCopied, setIsCopied] = useState(false);

  const lang = language || 'plaintext';

  const handleCopy = () => {
    if (isCopied) return;
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-obsidian rounded-lg my-4 border border-glass relative group text-sm">
      <div className="flex justify-between items-center px-4 py-2 bg-surface/50 rounded-t-md">
        <span className="text-xs font-sans text-secondary select-none">{lang}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors"
        >
          {isCopied ? <CheckIcon className="w-4 h-4 text-positive" /> : <ClipboardIcon className="w-4 h-4" />}
          {isCopied ? 'Kopyalandı!' : 'Kopyala'}
        </button>
      </div>

      <SyntaxHighlighter
        language={lang}
        style={atomDark}
        showLineNumbers
        wrapLines
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '16px',
          backgroundColor: 'transparent',
          fontSize: '14px',
        }}
        codeTagProps={{
          style: {
            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
          },
        }}
      >
        {content.trimEnd()}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;