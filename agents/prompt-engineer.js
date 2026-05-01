import { callGroq } from "../utils/api.js";

/**
 * Generates an enhanced prompt tailored to platform and domain.
 * @param {{platform: string, domain: string, mode: string}} context - Context package.
 * @param {string} rawPrompt - Original prompt text.
 * @param {string} apiKey - Groq API key.
 * @returns {Promise<string>} Enhanced prompt text.
 */
export async function promptEngineer(context, rawPrompt, apiKey) {
  if (!rawPrompt || !rawPrompt.trim()) {
    throw new Error("Prompt is empty. Please enter text before enhancing.");
  }

  const systemPrompt =
    `You are an expert prompt engineer specializing in ${context.platform} prompts. ` +
    `Given this ${context.domain} task, rewrite the prompt to be specific, structured, and optimized. ` +
    "Add: role definition, clear goal, constraints, output format requirements. " +
    "Anti-hallucination rule: only enhance what is given, never invent facts. " +
    "Return ONLY the enhanced prompt text, nothing else.";

  const userContent =
    `Mode: ${context.mode}\n` +
    `Platform: ${context.platform}\n` +
    `Original Prompt:\n${rawPrompt.trim()}`;

  return callGroq(systemPrompt, userContent, apiKey);
}
