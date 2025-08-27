
import React from 'react';
import CodeBlock from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockContent = '';
    let codeBlockLanguage = '';
    let listItems: string[] = [];

    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-3">
            {listItems.map((item, index) => <li key={index}>{parseInline(item)}</li>)}
          </ul>
        );
        listItems = [];
      }
    };
    
    const flushCodeBlock = () => {
        if (codeBlockContent) {
            elements.push(
                <CodeBlock 
                  key={`code-${elements.length}`} 
                  language={codeBlockLanguage} 
                  content={codeBlockContent.trimEnd()}
                />
              );
            codeBlockContent = '';
            codeBlockLanguage = '';
        }
    }

    const parseInline = (text: string) => {
      const parts = text
        .split(/(\*\*.*?\*\*|`.*?`)/g)
        .map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
          }
          if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={i} className="bg-surface-light text-accent px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
          }
          return part;
        });
      return <>{parts}</>;
    };

    lines.forEach((line, index) => {
      if (line.startsWith('```')) {
        flushList();
        if (inCodeBlock) {
          flushCodeBlock();
        } else {
            codeBlockLanguage = line.substring(3).trim();
        }
        inCodeBlock = !inCodeBlock;
        return;
      }

      if (inCodeBlock) {
        codeBlockContent += line + '\n';
        return;
      }

      if (line.startsWith('# ')) {
        flushList();
        elements.push(<h1 key={index} className="text-2xl font-bold mt-6 mb-3 border-b-2 border-glass pb-2">{parseInline(line.substring(2))}</h1>);
        return;
      }
      if (line.startsWith('## ')) {
        flushList();
        elements.push(<h2 key={index} className="text-xl font-bold mt-5 mb-2 border-b border-glass pb-1">{parseInline(line.substring(3))}</h2>);
        return;
      }
      if (line.startsWith('### ')) {
        flushList();
        elements.push(<h3 key={index} className="text-lg font-semibold mt-4 mb-2">{parseInline(line.substring(4))}</h3>);
        return;
      }
      
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        listItems.push(line.trim().substring(2));
      } else {
        flushList();
        if (line.trim() !== '') {
            elements.push(<p key={index} className="mb-3">{parseInline(line)}</p>);
        }
      }
    });
    
    flushList();
    flushCodeBlock();

    return elements;
  };

  return <div className="prose prose-invert max-w-none text-primary break-words">{renderContent()}</div>;
};

export default MarkdownRenderer;
