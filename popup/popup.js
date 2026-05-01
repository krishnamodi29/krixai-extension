const MODE_KEY = "krixai_selected_mode";
const API_KEY_STORAGE = "groqApiKey";
const GROQ_KEY_STORAGE = "groqApiKey";

/** @type {'technical'|'creative'|'analytical'} */
let selectedMode = "analytical";

/**
 * Gets current active tab.
 * @returns {Promise<chrome.tabs.Tab>}
 */
async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs?.[0]) {
    throw new Error("No active tab found.");
  }
  return tabs[0];
}

/**
 * Saves Groq API key to local storage and sync backup.
 * @param {string} apiKey - Groq API key value.
 * @returns {Promise<void>}
 */
async function saveApiKeyWithBackup(apiKey) {
  await chrome.storage.local.set({
    [API_KEY_STORAGE]: apiKey,
    [GROQ_KEY_STORAGE]: apiKey
  });
  try {
    await chrome.storage.sync.set({ [GROQ_KEY_STORAGE]: apiKey });
  } catch (_error) {
    // Ignore sync failures and continue with local persistence.
  }
}

/**
 * Loads Groq API key from local first, then sync as backup.
 * @returns {Promise<{apiKey: string, groqApiKey: string}>}
 */
async function loadApiKeyFromStorage() {
  const localStore = await chrome.storage.local.get([API_KEY_STORAGE, GROQ_KEY_STORAGE]);
  const localKey = localStore[API_KEY_STORAGE] || localStore[GROQ_KEY_STORAGE] || "";
  const localGroqKey = localStore[GROQ_KEY_STORAGE] || "";
  if (localKey || localGroqKey) {
    return { apiKey: localKey, groqApiKey: localGroqKey };
  }
  try {
    const syncStore = await chrome.storage.sync.get([GROQ_KEY_STORAGE]);
    return {
      apiKey: syncStore[GROQ_KEY_STORAGE] || "",
      groqApiKey: syncStore[GROQ_KEY_STORAGE] || ""
    };
  } catch (_error) {
    return { apiKey: "", groqApiKey: "" };
  }
}

/**
 * Sends message to active tab content script.
 * @param {any} message - Message payload.
 * @returns {Promise<any>}
 */
function sendToContentScript(message) {
  return new Promise(async (resolve, reject) => {
    try {
      const tab = await getActiveTab();
      chrome.tabs.sendMessage(tab.id, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Sends message to service worker.
 * @param {any} message - Message payload.
 * @returns {Promise<any>}
 */
function sendToServiceWorker(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

/**
 * Sets visible status text.
 * @param {string} message - Status message.
 */
function setStatus(message) {
  document.getElementById("statusMessage").textContent = message || "";
}

/**
 * Toggles loading spinner visibility.
 * @param {boolean} isLoading - True to show spinner.
 */
function setLoading(isLoading) {
  const spinner = document.getElementById("spinner");
  spinner.classList.toggle("hidden", !isLoading);
}

/**
 * Shows either main view or settings view.
 * @param {boolean} showSettings - Whether to display settings panel.
 */
function showSettingsView(showSettings) {
  document.getElementById("mainView").classList.toggle("hidden", showSettings);
  document.getElementById("settingsView").classList.toggle("hidden", !showSettings);
}

/**
 * Updates mode pill visual state.
 */
function renderModePills() {
  const pills = document.querySelectorAll(".pill");
  pills.forEach((pill) => {
    const isActive = pill.dataset.mode === selectedMode;
    pill.classList.toggle("active", isActive);
  });
}

/**
 * Renders enhancement results in popup UI.
 * @param {{rawPrompt: string, enhancedPrompt: string, dna: string[], confidence: {score: number, reason: string}}} data - Result payload.
 */
function renderResults(data) {
  document.getElementById("rawPromptPanel").textContent = data.rawPrompt || "";
  document.getElementById("enhancedPromptPanel").textContent = data.enhancedPrompt || "";

  const scoreBadge = document.getElementById("scoreBadge");
  scoreBadge.textContent = `Confidence ${data.confidence.score}/100 - ${data.confidence.reason}`;
  scoreBadge.classList.remove("hidden");

  const dnaList = document.getElementById("dnaList");
  dnaList.innerHTML = "";
  (data.dna || []).forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    dnaList.appendChild(li);
  });
}

/**
 * Handles mode pill clicks and persistence.
 */
function bindModePills() {
  document.querySelectorAll(".pill").forEach((pill) => {
    pill.addEventListener("click", async () => {
      selectedMode = /** @type {'technical'|'creative'|'analytical'} */ (pill.dataset.mode || "analytical");
      renderModePills();
      await chrome.storage.local.set({ [MODE_KEY]: selectedMode });
    });
  });
}

/**
 * Loads saved mode and API key, toggling settings view if needed.
 */
async function loadInitialState() {
  const store = await chrome.storage.local.get([MODE_KEY]);
  const keys = await loadApiKeyFromStorage();
  selectedMode = store[MODE_KEY] || "analytical";
  renderModePills();
  document.getElementById("apiKeyInput").value = keys.apiKey || "";
  document.getElementById("groqApiKeyInput").value = keys.groqApiKey || keys.apiKey || "";
  showSettingsView(!keys.groqApiKey && !keys.apiKey);
}

/**
 * Saves API key from settings input.
 */
function bindSettingsActions() {
  const saveBtn = document.getElementById("saveApiKeyBtn");
  const settingsToggle = document.getElementById("settingsToggle");
  const backBtn = document.getElementById("backBtn");

  settingsToggle.addEventListener("click", () => showSettingsView(true));
  backBtn.addEventListener("click", () => showSettingsView(false));

  saveBtn.addEventListener("click", async () => {
    const apiKeyPrimary = document.getElementById("apiKeyInput").value.trim();
    const apiKeySecondary = document.getElementById("groqApiKeyInput").value.trim();
    const finalApiKey = apiKeySecondary || apiKeyPrimary;
    if (!finalApiKey) {
      setStatus("Please enter a Groq API key.");
      return;
    }
    await saveApiKeyWithBackup(finalApiKey);
    document.getElementById("apiKeyInput").value = finalApiKey;
    document.getElementById("groqApiKeyInput").value = finalApiKey;
    setStatus("API key saved.");
    showSettingsView(false);
  });
}

/**
 * Handles Enhance button action from popup.
 */
function bindEnhanceAction() {
  const enhanceBtn = document.getElementById("enhanceBtn");
  enhanceBtn.addEventListener("click", async () => {
    setLoading(true);
    setStatus("");
    try {
      const keys = await loadApiKeyFromStorage();
      const groqApiKey = keys.groqApiKey || keys.apiKey;
      if (!groqApiKey) {
        showSettingsView(true);
        throw new Error("No Groq API key found. Open Settings and save your key.");
      }

      const tab = await getActiveTab();
      const rawPromptResponse = await sendToContentScript({ type: "GET_RAW_PROMPT" });
      if (!rawPromptResponse?.success) {
        throw new Error(rawPromptResponse?.error || "Could not read prompt from this page.");
      }
      if (!rawPromptResponse.rawPrompt?.trim()) {
        throw new Error("Please write a prompt first.");
      }

      const response = await sendToServiceWorker({
        type: "ENHANCE_PROMPT",
        rawPrompt: rawPromptResponse.rawPrompt,
        mode: selectedMode,
        groqApiKey,
        url: tab.url || ""
      });

      if (!response?.success) {
        throw new Error(response?.error || "Enhancement failed.");
      }

      await sendToContentScript({
        type: "SET_ENHANCED_PROMPT",
        enhancedPrompt: response.data.enhancedPrompt
      });

      renderResults(response.data);
    } catch (error) {
      setStatus(error.message || "KrixAI could not complete enhancement.");
    } finally {
      setLoading(false);
    }
  });
}

/**
 * Initializes popup interactions.
 */
async function initPopup() {
  bindModePills();
  bindSettingsActions();
  bindEnhanceAction();
  await loadInitialState();
}

initPopup().catch((error) => {
  setStatus(`Initialization failed: ${error.message}`);
});
