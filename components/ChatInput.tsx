import React, { useState, useRef, useEffect, KeyboardEvent, useImperativeHandle, forwardRef, DragEvent, ClipboardEvent } from 'react';
import { SendIcon, PaperclipIcon, FileIcon, XCircleIcon } from './icons';
import { Attachment } from '../types';
import { processFile } from '../utils/fileProcessor';

interface ChatInputProps {
  onSendMessage: (message: string, attachments: Attachment[], useUrlAnalysis: boolean, useGoogleSearch: boolean) => void;
  isLoading: boolean;
  onStop?: () => void;
}

export interface ChatInputRef {
    addFileReference: (filePath: string) => void;
}

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSendMessage, isLoading, onStop }, ref) => {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [useUrlAnalysis, setUseUrlAnalysis] = useState(false);
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    addFileReference: (filePath: string) => {
        const fileRef = `@${filePath} `;
        setInput(prev => fileRef + prev);
        textareaRef.current?.focus();
    }
  }));

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setAttachments(prev => [...prev, ...newFiles]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files);
    if(e.target) e.target.value = ''; // Reset input to allow re-uploading the same file
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    addFiles(e.clipboardData.files);
  };
  
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async () => {
    if ((input.trim() || attachments.length > 0) && !isLoading) {
      const processedAttachments = await Promise.all(attachments.map(processFile));
      onSendMessage(input.trim(), processedAttachments, useUrlAnalysis, useGoogleSearch);
      setInput('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div 
        className={`p-4 glass-surface border-t border-glass transition-colors ${isDragging ? 'bg-accent/10' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
       {isDragging && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-accent rounded-md">
            <p className="text-accent font-semibold">Dosyaları buraya bırakın</p>
        </div>
      )}

      {attachments.length > 0 && (
        <div className="mb-3 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {attachments.map((file, index) => {
                const isImage = file.type.startsWith('image/');
                const objectUrl = isImage ? URL.createObjectURL(file) : null;
                
                return (
                    <div key={index} className="relative group aspect-square bg-surface-light rounded-lg overflow-hidden">
                        {isImage && objectUrl ? (
                            <img src={objectUrl} alt={file.name} className="w-full h-full object-cover" onLoad={() => URL.revokeObjectURL(objectUrl)}/>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full p-2">
                                <FileIcon className="w-8 h-8 text-secondary"/>
                                <p className="text-xs text-secondary text-center truncate w-full mt-1" title={file.name}>{file.name}</p>
                            </div>
                        )}
                        <button 
                            onClick={() => removeAttachment(index)}
                            className="absolute top-1 right-1 bg-obsidian/60 rounded-full text-primary hover:bg-obsidian transition-colors opacity-0 group-hover:opacity-100"
                            aria-label="Dosya ekini kaldır"
                        >
                           <XCircleIcon className="w-5 h-5"/>
                        </button>
                    </div>
                );
            })}
        </div>
      )}
      
      <div className="relative flex items-center">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="p-2 mr-2 rounded-full text-secondary hover:text-primary hover:bg-surface-light disabled:opacity-50 transition-colors"
          aria-label="Dosya Ekle"
        >
          <PaperclipIcon className="w-6 h-6" />
        </button>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            multiple 
        />
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Mesajınızı yazın, dosya sürükleyin veya yapıştırın... (Shift+Enter yeni satır)"
          className="w-full bg-surface-light text-primary rounded-lg p-4 pr-16 resize-none focus:ring-2 focus:ring-accent-dark focus:outline-none transition max-h-48 overflow-y-auto placeholder-secondary/70"
          rows={1}
          disabled={isLoading}
        />
        {isLoading ? (
          <button
            onClick={onStop}
            className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors"
            aria-label="Durdur"
            type="button"
          >
            Durdur
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() && attachments.length === 0}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-accent-darker text-primary hover:bg-accent-dark disabled:bg-surface-lighter disabled:cursor-not-allowed transition-colors"
            aria-label="Gönder"
            type="button"
          >
            <SendIcon className="w-5 h-5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-start mt-2.5 space-x-6 pl-12">
          <label htmlFor="url-analysis-toggle" className="flex items-center cursor-pointer select-none group">
              <div className="relative">
                  <input type="checkbox" id="url-analysis-toggle" className="sr-only" checked={useUrlAnalysis} onChange={() => setUseUrlAnalysis(!useUrlAnalysis)} />
                  <div className={`block w-10 h-6 rounded-full transition ${useUrlAnalysis ? 'bg-accent-dark' : 'bg-surface-light'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${useUrlAnalysis ? 'translate-x-full' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm text-secondary group-hover:text-primary transition-colors">URL İçerik Analizi</span>
          </label>
           <label htmlFor="google-search-toggle" className="flex items-center cursor-pointer select-none group">
              <div className="relative">
                  <input type="checkbox" id="google-search-toggle" className="sr-only" checked={useGoogleSearch} onChange={() => setUseGoogleSearch(!useGoogleSearch)} />
                  <div className={`block w-10 h-6 rounded-full transition ${useGoogleSearch ? 'bg-accent-dark' : 'bg-surface-light'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${useGoogleSearch ? 'translate-x-full' : ''}`}></div>
              </div>
              <span className="ml-3 text-sm text-secondary group-hover:text-primary transition-colors">Google ile Ara</span>
          </label>
      </div>
    </div>
  );
});

export default ChatInput;