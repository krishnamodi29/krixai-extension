import { callGroq } from "../utils/api.js";

export async function dnaExplainer(rawPrompt, enhancedPrompt, apiKey) {
  const systemPrompt = "Respond with ONLY a JSON array of 3 strings. No markdown, no explanation. Example: [\"improvement 1\", \"improvement 2\", \"improvement 3\"]";
  const userContent = `Raw: ${rawPrompt}\nEnhanced: ${enhancedPrompt}`;
  try {
    const text = await callGroq(systemPrompt, userContent, apiKey);
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return ["Added specificity", "Improved structure", "Added context"];
    const parsed = JSON.parse(match[0]);
    const strings = parsed.filter(i => typeof i === "string").slice(0, 3);
    while (strings.length < 3) strings.push("Improved clarity");
    return strings;
  } catch(e) {
    return ["Added specificity", "Improved structure", "Added context"];
  }
}