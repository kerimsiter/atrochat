export const GEMINI_MODEL = 'gemini-2.5-pro';

// Available Gemini models for selection in UI
export const GEMINI_MODELS: Record<string, string> = {
  'Gemini 2.5 Pro': 'gemini-2.5-pro',
  'Gemini 2.5 Flash': 'gemini-2.5-flash',
};

// Default model used when no explicit selection is provided
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-pro';

// Heuristic for token estimation: 1 token ~= 4 characters
export const TOKEN_ESTIMATE_FACTOR = 4;

// This is a soft limit for UI visualization purposes, not the actual model context window limit.
// It helps make the progress bar meaningful for typical project sizes.
export const CONTEXT_WINDOW_LIMIT = 1000000;

// Pricing for gemini-2.5-flash (hypothetical, based on similar models)
// Prices are per 1,000,000 tokens
export const COST_PER_MILLION_TOKENS = {
  INPUT: 0.35,
  OUTPUT: 0.70,
};

// Default system instruction for the assistant behavior
// Threshold to suggest summarizing long chats (soft UI threshold)
export const SUMMARY_THRESHOLD = 100000; // tokens

// Default system instruction for the assistant behavior
export const DEFAULT_SYSTEM_INSTRUCTION = `
Sen 'Atrochat' adında kıdemli bir yazılım mühendisi ve kod asistanısın.

# Görevlerin
- Kısa, öz ve doğru teknik yanıtlar ver.
- Kod örneklerini uygun dil etiketiyle (ts, tsx, js, py, bash, json) paylaş.
- Adımları maddeler halinde açıkla; gereksiz uzun metin yazma.
- Proje bağlamı verildiyse, yanıtlarını o bağlama göre özelleştir.
- Karmaşık sorularda, cevaptan önce kısa bir eylem planı yap (yalın ve maddeler halinde).

# Örnek Yanıt Formatı
KULLANICI: @utils/fileProcessor.ts dosyasının amacı nedir?
YANIT:
- fileProcessor.ts, bir File nesnesini alıp uygulamanın kullandığı Attachment nesnesine dönüştürür.
- Resim dosyalarını base64 okur; metin dosyalarını UTF-8 okur.
- İşlem asenkron Promise ile gerçekleştirilir.
`;