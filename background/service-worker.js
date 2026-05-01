import { contextDetective } from "../agents/context-detective.js";
import { promptEngineer } from "../agents/prompt-engineer.js";
import { dnaExplainer } from "../agents/dna-explainer.js";
import { confidenceScorer } from "../agents/confidence-scorer.js";
import { MemoryAgent } from "../agents/memory-agent.js";

/**
 * Shared state for current orchestration run.
 * @type {{platform: string, domain: string, mode: string, rawPrompt: string, context: object|null}}
 */
const sharedState = {
  platform: "unknown",
  domain: "analytical",
  mode: "analytical",
  rawPrompt: "",
  context: null
};

/**
 * Handles prompt enhancement orchestration flow.
 * @param {{rawPrompt: string, mode?: 'technical'|'creative'|'analytical', groqApiKey?: string, url: string}} payload - Message payload.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function orchestrateEnhancement(payload) {
  const { rawPrompt, mode, groqApiKey, url } = payload || {};
  if (!rawPrompt || !rawPrompt.trim()) {
    return { success: false, error: "Please enter a prompt first." };
  }
  if (!groqApiKey || !groqApiKey.trim()) {
    return { success: false, error: "No Groq API key found. Open Settings and save your key." };
  }

  try {
    // Route: contextDetective -> promptEngineer -> (dnaExplainer + confidenceScorer)
    const context = contextDetective(url, rawPrompt, mode);
    sharedState.platform = context.platform;
    sharedState.domain = context.domain;
    sharedState.mode = context.mode;
    sharedState.rawPrompt = rawPrompt;
    sharedState.context = context;

    const enhancedPrompt = await promptEngineer(context, rawPrompt, groqApiKey || "");
    const withTimeout = (promise, ms, fallback) => 
      Promise.race([
        promise,
        new Promise(resolve => setTimeout(() => resolve(fallback), ms))
      ]);
    
    const [dna, confidence] = await Promise.all([
      withTimeout(
        dnaExplainer(rawPrompt, enhancedPrompt, groqApiKey || ""),
        8000,
        ["Added context", "Improved specificity", "Added structure"]
      ),
      withTimeout(
        confidenceScorer(enhancedPrompt, groqApiKey || ""),
        8000,
        { score: 75, reason: "Prompt improved" }
      )
    ]);

    const result = {
      platform: context.platform,
      domain: context.domain,
      mode: context.mode,
      rawPrompt,
      enhancedPrompt,
      dna,
      confidence
    };

    try {
      await MemoryAgent.save({
        platform: context.platform,
        mode: context.mode,
        rawPrompt,
        enhancedPrompt,
        score: confidence.score,
        timestamp: Date.now()
      });
    } catch (_error) {
      // Memory failures are non-blocking; enhancement result must still return.
    }

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: `KrixAI could not enhance this prompt right now. ${error.message}`
    };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message?.type;
  if (type === "ENHANCE_PROMPT") {
    orchestrateEnhancement({
      rawPrompt: message.rawPrompt,
      mode: message.mode,
      groqApiKey: message.groqApiKey,
      url: message.url || sender?.url || ""
    }).then(sendResponse);
    return true;
  }

  if (type === "GET_MEMORY_HISTORY") {
    MemoryAgent.getHistory()
      .then((history) => sendResponse({ success: true, data: history }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (type === "GET_TOP_PROMPTS") {
    MemoryAgent.getTopPrompts()
      .then((topPrompts) => sendResponse({ success: true, data: topPrompts }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (type === "CLEAR_MEMORY_HISTORY") {
    MemoryAgent.clearHistory()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});
