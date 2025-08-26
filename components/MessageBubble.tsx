import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Message, Role, Attachment } from '../types';
import { UserIcon, BotIcon, ClipboardIcon, CheckIcon, FileIcon, PencilIcon, TrashIcon } from './icons';
import MarkdownRenderer from './MarkdownRenderer';

interface MessageBubbleProps {
  message: Message;
  onDelete: (messageId: string) => void;
  onEdit: (messageId: string, newContent: string) => void;
}

const AttachmentDisplay: React.FC<{ attachment: Attachment }> = ({ attachment }) => {
    const isImage = attachment.type.startsWith('image/');

    if (isImage) {
        return (
            <div className="w-full aspect-video bg-surface rounded-lg overflow-hidden">
                <img src={attachment.data} alt={attachment.name} className="w-full h-full object-contain" />
            </div>
        );
    }

    return (
        <div className="flex items-center p-2 bg-surface rounded-lg">
            <FileIcon className="w-6 h-6 text-secondary mr-2 flex-shrink-0" />
            <span className="text-sm text-secondary truncate" title={attachment.name}>{attachment.name}</span>
        </div>
    );
};


// Helper function to insert citations into the text
const addCitationsToContent = (
  content: string, 
  supports?: any[], 
  chunks?: { web: { uri: string; title: string } }[]
): string => {
  if (!supports || !chunks || supports.length === 0 || chunks.length === 0) {
    return content;
  }

  // Sort supports by end_index in descending order to avoid shifting issues when inserting.
  const sortedSupports = [...supports].sort(
    (a, b) => (b.segment?.endIndex ?? 0) - (a.segment?.endIndex ?? 0)
  );

  let modifiedContent = content;

  for (const support of sortedSupports) {
    const endIndex = support.segment?.endIndex;
    if (endIndex === undefined || !support.groundingChunkIndices?.length) {
      continue;
    }

    const citationNumbers = support.groundingChunkIndices
      .map((i: number) => `[${i + 1}]`)
      .join('');

    if (citationNumbers) {
      modifiedContent = modifiedContent.slice(0, endIndex) + ' ' + citationNumbers + modifiedContent.slice(endIndex);
    }
  }

  return modifiedContent;
};


const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onDelete, onEdit }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(message.content);
  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);

  const isUser = message.role === Role.USER;
  const isSystem = message.role === Role.SYSTEM;

  useEffect(() => {
    if (isEditing && editTextAreaRef.current) {
        editTextAreaRef.current.focus();
        editTextAreaRef.current.style.height = 'auto';
        editTextAreaRef.current.style.height = `${editTextAreaRef.current.scrollHeight}px`;
    }
  }, [isEditing]);
  
  const handleEditInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditedContent(e.target.value);
    if(editTextAreaRef.current){
        editTextAreaRef.current.style.height = 'auto';
        editTextAreaRef.current.style.height = `${editTextAreaRef.current.scrollHeight}px`;
    }
  };

  const contentWithCitations = useMemo(() => {
    return addCitationsToContent(
      message.content, 
      message.groundingMetadata?.groundingSupports, 
      message.groundingMetadata?.groundingChunks
    );
  }, [message.content, message.groundingMetadata]);


  const handleCopy = () => {
    navigator.clipboard.writeText(message.content); // Copy original content without citations
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleDelete = () => {
    onDelete(message.id);
  };

  const handleSaveEdit = () => {
    if (editedContent.trim() !== message.content) {
        onEdit(message.id, editedContent.trim());
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditedContent(message.content);
    setIsEditing(false);
  };

  if (isSystem) {
    return (
      <div className="text-center my-4">
        <div className="inline-block bg-surface text-secondary text-xs px-3 py-1 rounded-full">
          {message.content}
        </div>
      </div>
    );
  }

  const bubbleClasses = isUser
    ? 'bg-accent-dark text-primary rounded-br-none'
    : 'bg-surface-light text-primary rounded-bl-none';
  
  const containerClasses = isUser ? 'justify-end' : 'justify-start';
  
  const Icon = isUser ? UserIcon : BotIcon;

  return (
    <div className={`flex items-start gap-3 my-4 ${containerClasses}`}>
       {!isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-light flex items-center justify-center"><Icon className="w-5 h-5" /></div>}
      <div className={`flex flex-col max-w-2xl w-full`}>
        <div className={`relative group px-4 py-3 rounded-lg ${bubbleClasses}`}>
            {message.attachments && message.attachments.length > 0 && !isEditing && (
                <div className="mb-2 grid grid-cols-2 gap-2">
                    {message.attachments.map((att, index) => (
                        <AttachmentDisplay key={index} attachment={att} />
                    ))}
                </div>
            )}
           <div className="text-sm leading-relaxed">
            {isEditing ? (
                <div>
                    <textarea
                        ref={editTextAreaRef}
                        value={editedContent}
                        onChange={handleEditInput}
                        className="w-full bg-surface/80 text-primary rounded-lg p-2 resize-none focus:ring-2 focus:ring-accent-darker focus:outline-none transition max-h-60 overflow-y-auto"
                        rows={1}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit();
                            } else if (e.key === 'Escape') {
                                handleCancelEdit();
                            }
                        }}
                    />
                    <div className="flex justify-end items-center gap-2 mt-2">
                        <button onClick={handleCancelEdit} className="text-xs px-3 py-1 rounded bg-surface-lighter hover:bg-surface-light text-secondary">İptal</button>
                        <button onClick={handleSaveEdit} className="text-xs px-3 py-1 rounded bg-accent hover:bg-accent-dark text-primary font-semibold">Kaydet</button>
                    </div>
                </div>
            ) : (
                <MarkdownRenderer content={contentWithCitations} />
            )}
           </div>
           
           <div className="absolute top-2 right-2 flex items-center gap-1">
             {!isUser && (
              <button
                onClick={handleCopy}
                className="p-1 rounded-md bg-surface-lighter/50 text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                aria-label="Mesajı kopyala"
              >
                {isCopied ? (
                  <CheckIcon className="w-4 h-4 text-positive" />
                ) : (
                  <ClipboardIcon className="w-4 h-4" />
                )}
              </button>
            )}
            {isUser && !isEditing && (
                <>
                    <button
                        onClick={() => setIsEditing(true)}
                        className="p-1 rounded-md bg-surface-lighter/50 text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                        aria-label="Mesajı düzenle"
                    >
                       <PencilIcon className="w-4 h-4" />
                    </button>
                     <button
                        onClick={handleDelete}
                        className="p-1 rounded-md bg-surface-lighter/50 text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                        aria-label="Mesajı sil"
                    >
                       <TrashIcon className="w-4 h-4" />
                    </button>
                </>
            )}
           </div>

          {message.groundingMetadata?.groundingChunks && message.groundingMetadata.groundingChunks.length > 0 && (
            <div className="mt-4 pt-3 border-t border-glass/30">
                <h4 className="text-xs font-semibold text-secondary mb-2">Kaynaklar:</h4>
                <div className="flex flex-col space-y-1.5">
                    {message.groundingMetadata.groundingChunks.map((chunk, index) => (
                        chunk.web && (
                            <a 
                                key={index} 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-xs text-accent hover:underline flex items-start"
                                title={chunk.web.uri}
                            >
                                <span className="mr-2 flex-shrink-0 font-semibold">[{index + 1}]</span>
                                <span className="truncate">{chunk.web.title || chunk.web.uri}</span>
                            </a>
                        )
                    ))}
                </div>
            </div>
          )}
          {message.urlContextMetadata && Array.isArray(message.urlContextMetadata.url_metadata) && message.urlContextMetadata.url_metadata.length > 0 && (
            <div className="mt-4 pt-3 border-t border-glass/30">
                <h4 className="text-xs font-semibold text-secondary mb-2">Analiz Edilen URL'ler:</h4>
                <div className="flex flex-col space-y-1.5">
                    {message.urlContextMetadata.url_metadata.map((meta, index) => {
                        const isSuccess = meta.url_retrieval_status === 'URL_RETRIEVAL_STATUS_SUCCESS';
                        return (
                            <div key={index} className="flex items-start text-xs">
                                <span className={`mr-2 flex-shrink-0 font-mono ${isSuccess ? 'text-positive' : 'text-warm'}`}>
                                    [{isSuccess ? '✓' : '✗'}]
                                </span>
                                <a 
                                    href={meta.retrieved_url}
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-accent hover:underline truncate"
                                    title={meta.retrieved_url}
                                >
                                    {meta.retrieved_url}
                                </a>
                                {!isSuccess && <span className="ml-2 text-secondary/70 whitespace-nowrap">({meta.url_retrieval_status.replace('URL_RETRIEVAL_STATUS_', '')})</span>}
                            </div>
                        )
                    })}
                </div>
            </div>
          )}
        </div>
        <div className={`text-xs text-secondary/60 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
       {isUser && <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent-dark flex items-center justify-center"><Icon className="w-5 h-5" /></div>}
    </div>
  );
};

export default MessageBubble;