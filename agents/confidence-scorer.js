import { callGroq } from "../utils/api.js";

export async function confidenceScorer(enhancedPrompt, apiKey) {
  const systemPrompt = "Respond with ONLY a JSON object. No markdown. Example: {\"score\": 85, \"reason\": \"clear and specific\"}";
  try {
    const text = await callGroq(systemPrompt, enhancedPrompt, apiKey);
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return { score: 75, reason: "Prompt improved" };
    const parsed = JSON.parse(match[0]);
    const score = Number(parsed?.score);
    if (!Number.isFinite(score)) return { score: 75, reason: "Prompt improved" };
    return { score: Math.min(100, Math.max(0, Math.round(score))), reason: parsed?.reason || "Prompt improved" };
  } catch(e) {
    return { score: 75, reason: "Prompt improved" };
  }
}