import React from 'react';
import { ChatSession } from '../types';
import { CONTEXT_WINDOW_LIMIT } from '../constants';
import { DatabaseIcon } from './icons';

interface TokenUsageDisplayProps {
  session: ChatSession;
}

const TokenUsageDisplay: React.FC<TokenUsageDisplayProps> = ({ session }) => {
  const { 
    billedTokenCount, 
    cost, 
    projectTokenCount, 
    historyTokenCount 
  } = session;

  const contextTokens = projectTokenCount + historyTokenCount;
  const projectPercentage = contextTokens > 0 ? (projectTokenCount / contextTokens) * 100 : 0;
  const historyPercentage = contextTokens > 0 ? (historyTokenCount / contextTokens) * 100 : 0;


  return (
    <div className="text-xs text-secondary flex items-center space-x-4">
      <span>Kullanılan Token: {billedTokenCount.toLocaleString()}</span>
      <span>Maliyet: ${cost.toFixed(4)}</span>
      <div className="group relative flex items-center cursor-help">
        <DatabaseIcon className="w-4 h-4 mr-1.5 text-accent" />
        <span>Bağlam: {contextTokens.toLocaleString()}</span>
        
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-obsidian border border-glass rounded-lg shadow-lg p-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
          <div className="font-semibold text-primary mb-2">Bağlam Kullanımı</div>
          <div className="w-full bg-surface-light rounded-full h-2.5 mb-2 overflow-hidden">
            <div className="flex h-2.5">
              <div 
                className="bg-accent-dark" 
                style={{ width: `${projectPercentage}%` }}
                title={`Proje: ${projectTokenCount.toLocaleString()}`}
              ></div>
              <div 
                className="bg-positive" 
                style={{ width: `${historyPercentage}%` }}
                title={`Geçmiş: ${historyTokenCount.toLocaleString()}`}
              ></div>
            </div>
          </div>
          <div className="text-secondary">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-accent-dark mr-2"></span>Proje Dosyaları</span>
              <span>{projectTokenCount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center"><span className="w-2 h-2 rounded-full bg-positive mr-2"></span>Sohbet Geçmişi</span>
              <span>{historyTokenCount.toLocaleString()}</span>
            </div>
            <div className="border-t border-glass my-2"></div>
            <div className="flex items-center justify-between text-xs font-medium text-primary">
              <span>Toplam Bağlam</span>
              <span>{contextTokens.toLocaleString()}</span>
            </div>
             <div className="text-center text-secondary/60 mt-1">
                / {CONTEXT_WINDOW_LIMIT.toLocaleString()} (Görsel Limit)
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenUsageDisplay;