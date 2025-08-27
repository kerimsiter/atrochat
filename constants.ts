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