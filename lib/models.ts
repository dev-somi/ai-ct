import type { Provider } from "./types";

export const MODEL_SUGGESTIONS: Record<Provider, string[]> = {
  "claude-cli": ["sonnet", "opus", "haiku", "claude-opus-5-5", "claude-sonnet-5-5"],
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-4-5-20251001"],
  openai: ["gpt-5", "gpt-5-mini", "gpt-4.1"],
  gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
};
