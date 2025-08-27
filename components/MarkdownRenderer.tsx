import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const normalizeLang = (lang?: string) => {
    const l = (lang || '').toLowerCase();
    const map: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      py: 'python',
      sh: 'bash',
      shell: 'bash',
      yml: 'yaml',
      md: 'markdown',
      html: 'markup',
    };
    return map[l] || l;
  };

  return (
    <div className="prose prose-invert max-w-none text-primary break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }: any) {
            const match = /language-([\w-]+)/.exec(className || '');
            let lang = normalizeLang(match ? match[1] : '');
            const rawText = String(children);
            const text = rawText.endsWith('\n') ? rawText.slice(0, -1) : rawText;
            const isSingleLine = !text.includes('\n');
            const looksLikeCommand = /^(?:\$\s*)?(npm|pnpm|yarn|npx|git|cd|mkdir|rm|cp|mv|node|ts-node|python|pip|pip3)\b/.test(text.trim());

            if (inline) {
              return (
                <code className="bg-surface-light text-accent px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                  {children}
                </code>
              );
            }

            // Heuristic: ONLY render compact block for single-line command-like snippets without explicit language
            if ((!lang || lang === 'plaintext') && isSingleLine && looksLikeCommand) {
              return (
                <div className="my-3">
                  <code className="bg-obsidian border border-glass rounded px-3 py-2 block text-sm font-mono whitespace-pre-wrap break-words">
                    {text}
                  </code>
                </div>
              );
            }

            // Prefer bash for common command snippets when no explicit language
            if ((!lang || lang === 'plaintext') && looksLikeCommand) {
              lang = 'bash';
            }

            return (
              <CodeBlock language={lang} content={text} />
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-surface-light/50">{children}</thead>;
          },
          th({ children }) {
            return (
              <th className="border border-glass px-3 py-2 text-left font-semibold text-secondary">
                {children}
              </th>
            );
          },
          td({ children }) {
            return <td className="border border-glass px-3 py-2 align-top">{children}</td>;
          },
          tr({ children }) {
            return <tr className="even:bg-surface/40">{children}</tr>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
