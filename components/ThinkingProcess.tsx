import React, { useState } from 'react';
import { CogIcon, ChevronRightIcon, CheckIcon } from './icons';

interface ThinkingProcessProps {
  steps: string[];
  isThinking: boolean;
}

const ThinkingProcess: React.FC<ThinkingProcessProps> = ({ steps, isThinking }) => {
  const [isOpen, setIsOpen] = useState(!isThinking && steps.length > 0);

  const title = isThinking ? "Gemini Düşünüyor..." : "Düşünme Süreci";

  return (
    <div className="border border-glass/30 rounded-lg bg-obsidian/20 mb-3 text-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-2 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center">
          {isThinking ? (
            <CogIcon className="w-4 h-4 mr-2 text-accent animate-spin" />
          ) : (
            <CheckIcon className="w-4 h-4 mr-2 text-positive" />
          )}
          <span className="font-medium text-secondary">{title}</span>
        </div>
        <ChevronRightIcon className={`w-5 h-5 text-secondary/70 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {isOpen && (
        <div className="p-3 border-t border-glass/30 max-h-48 overflow-y-auto">
          <ul className="space-y-1.5 text-xs font-mono text-secondary/80">
            {steps.map((step, index) => (
              <li key={index} className="flex items-start">
                  <span className="mr-2 text-accent/50 select-none">»</span>
                  <span>{step}</span>
              </li>
            ))}
            {isThinking && <li className="text-center text-secondary/50 animate-pulse">...</li>}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ThinkingProcess;