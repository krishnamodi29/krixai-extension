import { detectPlatform } from "../utils/platform-detector.js";

/**
 * Detects platform and infers task domain/mode.
 * @param {string} url - Current page URL.
 * @param {string} rawPrompt - Prompt text.
 * @param {'technical'|'creative'|'analytical'} [preferredMode] - Optional user-selected mode override.
 * @returns {{platform: string, domain: 'technical'|'creative'|'analytical', mode: 'technical'|'creative'|'analytical'}}
 */
export function contextDetective(url, rawPrompt, preferredMode) {
  const platform = detectPlatform(url);
  const promptText = (rawPrompt || "").toLowerCase();

  const technicalKeywords = ["code", "function", "build", "debug", "script", "api"];
  const creativeKeywords = ["write", "story", "creative", "poem", "script"];

  let domain = "analytical";
  if (technicalKeywords.some((keyword) => promptText.includes(keyword))) {
    domain = "technical";
  } else if (creativeKeywords.some((keyword) => promptText.includes(keyword))) {
    domain = "creative";
  }

  const safeMode = ["technical", "creative", "analytical"].includes(preferredMode)
    ? preferredMode
    : domain;

  return { platform, domain, mode: safeMode };
}
