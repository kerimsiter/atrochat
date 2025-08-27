
import { GoogleGenAI, GenerateContentResponse, Content, Part } from "@google/genai";
import { Role } from '../types';
import { GEMINI_MODEL } from '../constants';

let aiClient: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

const getAiClient = (apiKey: string): GoogleGenAI => {
    if (aiClient && currentApiKey === apiKey) {
        return aiClient;
    }
    
    if (!apiKey) {
        throw new Error("Gemini API anahtarı sağlanmadı.");
    }
    
    currentApiKey = apiKey;
    aiClient = new GoogleGenAI({ apiKey: currentApiKey });
    return aiClient;
}

export const getGeminiChatStream = async (
  apiKey: string,
  history: Content[],
  newParts: Part[],
  useGoogleSearch: boolean,
  useUrlContext: boolean,
  systemInstruction?: string,
  model?: string,
  signal?: AbortSignal
): Promise<AsyncGenerator<GenerateContentResponse, any, unknown>> => {
  try {
    const ai = getAiClient(apiKey);

    const tools: any[] = [];
    if (useUrlContext) {
        tools.push({urlContext: {}});
    }
    if (useGoogleSearch) {
        tools.push({googleSearch: {}});
    }

    const config: any = {
        thinkingConfig: {
            includeThoughts: true,
        },
    };

    if (tools.length > 0) {
        config.tools = tools;
    }

    const request: any = {
      model: model || GEMINI_MODEL,
      contents: [...history, { role: Role.USER, parts: newParts }],
      config: config,
    };

    if (systemInstruction && typeof systemInstruction === 'string') {
      request.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContentStream(request);
    return response;
  }
 catch (error)
 {
    console.error("Error creating Gemini stream:", error);
    // The error will propagate up and be handled in the UI.
    throw error;
  }
};

// Counts tokens for given text using Gemini SDK if possible; falls back to estimation on error
export const countTokens = async (
  apiKey: string,
  text: string,
  model?: string
): Promise<number> => {
  try {
    const ai = getAiClient(apiKey);
    const response: any = await (ai as any).models.countTokens({
      model: model || GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text }] }],
    });
    // Some SDK versions return { totalTokens }, others nest under usageMetadata
    const total = (response && (response.totalTokens ?? response?.usageMetadata?.totalTokens));
    if (typeof total === 'number') return total;
    // Fallback if structure is unexpected
    return Math.ceil(text.length / 4);
  } catch (error) {
    console.error('Token sayımı hatası, tahmine geri dönülüyor:', error);
    return Math.ceil(text.length / 4);
  }
};