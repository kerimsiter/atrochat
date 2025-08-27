export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface Attachment {
  name: string;
  type: string;
  data: string; // base64 data URL for images, text content for others
}

export interface UrlMetadata {
  retrieved_url: string;
  url_retrieval_status: string;
}

export interface UrlContextMetadata {
  url_metadata: UrlMetadata[];
}

export interface GroundingMetadata {
  webSearchQueries?: string[];
  groundingChunks?: { web: { uri: string; title: string } }[];
  groundingSupports?: {
    segment?: { startIndex?: number; endIndex?: number; };
    groundingChunkIndices?: number[];
  }[];
}

export interface Message {
  id: string;
  role: Role;
  content: string; // For UI display
  apiContent?: string; // For API context, if different from display content
  timestamp: string;
  groundingMetadata?: GroundingMetadata;
  urlContextMetadata?: UrlContextMetadata;
  attachments?: Attachment[];
  isThinking?: boolean; // To show the thinking UI
  thinkingSteps?: string[]; // To store the steps of the thinking process
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  billedTokenCount: number; // Renamed from tokenCount for clarity
  cost: number;
  files: FileContent[]; // Temporary files for the next message
  projectFiles?: FileContent[]; // Persistent files for the session
  projectTokenCount: number; // Tokens from project files
  historyTokenCount: number; // Tokens from conversation history
  projectRepoUrl?: string;
  projectCommitSha?: string;
  isContextStale?: boolean; // Flag for INITIAL project load
  pendingContextUpdate?: {
    added: FileContent[];
    modified: FileContent[];
    removed: string[];
  };
}

export interface FileContent {
  path: string;
  content: string;
}