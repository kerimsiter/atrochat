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
          <ul key={`ul-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
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
      
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        listItems.push(line.trim().substring(2));
      } else {
        flushList();
        if (line.trim() !== '') {
            elements.push(<p key={index}>{parseInline(line)}</p>);
        }
      }
    });
    
    flushList();
    flushCodeBlock();

    return elements;
  };

  return <div className="prose prose-invert max-w-none text-primary">{renderContent()}</div>;
};

export default MarkdownRenderer;