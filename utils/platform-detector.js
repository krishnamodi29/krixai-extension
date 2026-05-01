/**
 * Detects supported AI platform based on URL.
 * @param {string} url - Page URL.
 * @returns {'chatgpt'|'claude'|'gemini'|'perplexity'|'grok'|'unknown'} Platform id.
 */
export function detectPlatform(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "unknown";
  }

  if (url.includes("chat.openai.com")) {
    return "chatgpt";
  }
  if (url.includes("claude.ai")) {
    return "claude";
  }
  if (url.includes("gemini.google.com")) {
    return "gemini";
  }
  if (url.includes("perplexity.ai")) {
    return "perplexity";
  }
  if (url.includes("grok.x.ai")) {
    return "grok";
  }

  return "unknown";
}
