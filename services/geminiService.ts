import { GoogleGenAI, GenerateContentResponse, Content, Part } from "@google/genai";
import { Role } from '../types';

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
  useUrlContext: boolean
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

    const response = await ai.models.generateContentStream({
      model: "gemini-2.5-pro",
      contents: [...history, { role: Role.USER, parts: newParts }],
      ...(tools.length > 0 && { config: { tools } }),
    });
    return response;
  }
 catch (error)
 {
    console.error("Error creating Gemini stream:", error);
    // The error will propagate up and be handled in the UI.
    throw error;
  }
};