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

  const inferLanguage = (text: string): string => {
    const firstLine = text.split('\n')[0] || '';
    // By filename
    const m = firstLine.match(/\.([a-zA-Z0-9]+)$/);
    if (m) {
      const ext = m[1].toLowerCase();
      const map: Record<string, string> = {
        js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
        py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
        cs: 'csharp', cpp: 'cpp', c: 'c', sh: 'bash', yml: 'yaml', yaml: 'yaml',
        html: 'markup', css: 'css', json: 'json', md: 'markdown'
      };
      if (map[ext]) return map[ext];
    }
    const t = text.toLowerCase();
    if (/^\s*</.test(t)) return 'markup';
    if (/\b(import|export)\b/.test(t) && /\bfrom\b/.test(t)) return 'typescript';
    if (/\bfunction\b|=>/.test(t)) return 'javascript';
    if (/\bdef\b.*:/.test(t)) return 'python';
    if (/^\s*#include\b|\bstd::/.test(t)) return 'cpp';
    if (/^\s*class\b.*{/.test(t)) return 'java';
    if (/^\s*SELECT\b|\bFROM\b/.test(t)) return 'sql';
    return 'plaintext';
  };

  const lang = language || inferLanguage(content);

  const handleCopy = () => {
    if (isCopied) return;
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-obsidian rounded-lg my-4 border border-glass relative group text-sm">
      <div className="flex justify-between items-center px-4 py-2 bg-surface/50 rounded-t-md">
        {lang && lang !== 'plaintext' ? (
          <span className="text-xs font-sans text-secondary select-none">{lang}</span>
        ) : (
          <span className="text-xs font-sans text-secondary select-none" aria-hidden="true"></span>
        )}
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