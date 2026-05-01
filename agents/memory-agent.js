/**
 * Safely returns local storage if extension context is available.
 * @returns {chrome.storage.StorageArea|null}
 */
function safeStorage() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
  } catch (_e) {}
  return null;
}

/**
 * Persists enhancement sessions in local storage.
 */
export class MemoryAgent {
  /**
   * Saves one enhancement record.
   * @param {{platform: string, mode: string, rawPrompt: string, enhancedPrompt: string, score: number, timestamp?: number}} data - History record.
   * @returns {Promise<void>}
   */
  static async save(data) {
    const storage = safeStorage();
    if (!storage) return;
    try {
      const result = await storage.get(["krixai_history"]);
      const history = result.krixai_history || [];
      history.unshift({ ...data, timestamp: Date.now() });
      if (history.length > 20) history.pop();
      await storage.set({ krixai_history: history });
    } catch (e) {
      console.log("KrixAI memory save skipped:", e.message);
    }
  }

  /**
   * Gets history entries.
   * @returns {Promise<Array<{platform: string, mode: string, rawPrompt: string, enhancedPrompt: string, score: number, timestamp: number}>>}
   */
  static async getHistory() {
    const storage = safeStorage();
    if (!storage) return [];
    try {
      const result = await storage.get(["krixai_history"]);
      return result.krixai_history || [];
    } catch (_e) {
      return [];
    }
  }

  /**
   * Gets top 5 prompts by score.
   * @returns {Promise<Array<{platform: string, mode: string, rawPrompt: string, enhancedPrompt: string, score: number, timestamp: number}>>}
   */
  static async getTopPrompts() {
    const history = await this.getHistory();
    return history
      .slice()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 5);
  }

  /**
   * Clears all saved memory history.
   * @returns {Promise<void>}
   */
  static async clearHistory() {
    const storage = safeStorage();
    if (!storage) return;
    try {
      await storage.set({ krixai_history: [] });
    } catch (_e) {
      // no-op
    }
  }
}
