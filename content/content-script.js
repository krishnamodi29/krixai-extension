const FLOATING_BUTTON_ID = "krixai-floating-enhance";
const SUPPORTED_PLATFORMS = ["chatgpt", "claude", "gemini", "perplexity", "grok"];
const SELECTORS_BY_PLATFORM = {
  chatgpt: [
    "#prompt-textarea",
    "div[contenteditable='true'][data-virtualkeyboard-exclusion]",
    "form div[contenteditable='true']"
  ],
  claude: [".ProseMirror", "div[contenteditable='true']"],
  gemini: [".ql-editor", "div[contenteditable='true']", "rich-textarea div"],
  perplexity: ["textarea", "div[contenteditable='true']"],
  grok: ["textarea", "div[contenteditable='true']"]
};

/** @type {HTMLElement|null} */
let activeField = null;
/** @type {HTMLElement|null} */
let floatingButton = null;
/** @type {number|null} */
let hideTimer = null;
/** @type {number|null} */
let tooltipTimer = null;

/**
 * Detects platform from URL.
 * @param {string} url - Page URL.
 * @returns {'chatgpt'|'claude'|'gemini'|'perplexity'|'grok'|'unknown'}
 */
function detectPlatform(url) {
  if (!url || typeof url !== "string") {
    return "unknown";
  }
  if (url.includes("chat.openai.com")) return "chatgpt";
  if (url.includes("claude.ai")) return "claude";
  if (url.includes("gemini.google.com")) return "gemini";
  if (url.includes("perplexity.ai")) return "perplexity";
  if (url.includes("grok.x.ai")) return "grok";
  return "unknown";
}

/**
 * Returns active platform for current page.
 * @returns {'chatgpt'|'claude'|'gemini'|'perplexity'|'grok'|'unknown'}
 */
function getCurrentPlatform() {
  return detectPlatform(window.location.href);
}

/**
 * Returns whether this page is supported.
 * @returns {boolean}
 */
function isSupportedPage() {
  return SUPPORTED_PLATFORMS.includes(getCurrentPlatform());
}

/**
 * Checks if node is text input surface.
 * @param {Element|null} node - Candidate element.
 * @returns {node is HTMLElement}
 */
function isEditableElement(node) {
  if (!(node instanceof HTMLElement)) {
    return false;
  }
  if (node.matches("textarea")) {
    return true;
  }
  return node.isContentEditable || node.getAttribute("contenteditable") === "true";
}

/**
 * Returns the closest supported editable element from event target.
 * @param {EventTarget|null} target - Event target.
 * @returns {HTMLElement|null}
 */
function resolveEditableTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const candidate = target.closest("textarea, [contenteditable='true'], .ProseMirror, #prompt-textarea, .ql-editor, rich-textarea div");
  if (!candidate || !isEditableElement(candidate)) {
    return null;
  }
  return candidate;
}

/**
 * Finds the best prompt field using ordered selectors.
 * @returns {HTMLElement|null}
 */
function findPromptField() {
  const platform = getCurrentPlatform();
  const selectors = SELECTORS_BY_PLATFORM[platform] || [];
  for (const selector of selectors) {
    const found = document.querySelector(selector);
    if (isEditableElement(found)) {
      console.log("KrixAI: textarea found", found);
      return found;
    }
  }
  return null;
}

/**
 * Reads editable value.
 * @param {HTMLElement} element - Prompt element.
 * @returns {string}
 */
function getElementValue(element) {
  if (!element) return "";
  if ("value" in element) {
    return String(/** @type {HTMLTextAreaElement} */ (element).value || "");
  }
  return String(element.textContent || "");
}

/**
 * Writes editable value and emits input event.
 * @param {HTMLElement} element - Prompt element.
 * @param {string} value - New value.
 */
function setElementValue(element, value) {
  if (!element) return;
  if ("value" in element) {
    /** @type {HTMLTextAreaElement} */ (element).value = value;
  } else {
    element.textContent = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Sends prompt to background orchestrator.
 * @param {string} rawPrompt - Prompt text.
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
function enhancePrompt(rawPrompt) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["groqApiKey", "krixai_selected_mode"], (store) => {
      const groqApiKey = store.groqApiKey || "";
      const mode = store.krixai_selected_mode || "analytical";
      try {
        chrome.runtime.sendMessage(
          { type: "ENHANCE_PROMPT", rawPrompt, mode, groqApiKey, url: window.location.href },
          (response) => {
            if (chrome.runtime.lastError) {
              const message = String(chrome.runtime.lastError.message || "");
              const normalized = message.toLowerCase();
              if (normalized.includes("extension context invalidated") || normalized.includes("context invalidated")) {
                showButtonTooltip("Please refresh the page");
                resolve({ success: false, contextInvalidated: true });
                return;
              }
              resolve({ success: false, error: message });
              return;
            }
            resolve(response || { success: false, error: "No response received." });
          }
        );
      } catch (error) {
        const message = String(error?.message || "");
        const normalized = message.toLowerCase();
        if (normalized.includes("extension context invalidated") || normalized.includes("context invalidated")) {
          showButtonTooltip("Please refresh the page");
          resolve({ success: false, contextInvalidated: true });
          return;
        }
        resolve({ success: false, error: message || "KrixAI failed to send request." });
      }
    });
  });
}

/**
 * Injects styles for floating button.
 */
function injectFloatingStyles() {
  if (document.getElementById("krixai-floating-style")) {
    return;
  }
  const style = document.createElement("style");
  style.id = "krixai-floating-style";
  style.textContent = `
    #${FLOATING_BUTTON_ID} {
      position: absolute;
      right: 8px;
      bottom: 8px;
      width: 36px;
      height: 36px;
      border: 1px solid #ffd2e0;
      border-radius: 999px;
      background: #ffffff;
      color: #ff3366;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
      opacity: 0;
      transform: scale(0.92);
      transition: width 0.22s ease, opacity 0.18s ease, transform 0.18s ease, background 0.2s ease, color 0.2s ease;
      z-index: 2147483646;
      overflow: hidden;
      white-space: nowrap;
    }
    #${FLOATING_BUTTON_ID}.visible {
      opacity: 1;
      transform: scale(1);
    }
    #${FLOATING_BUTTON_ID}:hover,
    #${FLOATING_BUTTON_ID}.expanded {
      width: 116px;
      background: linear-gradient(90deg, #ff3366, #ff8c42);
      border-color: transparent;
      color: #ffffff;
    }
    #${FLOATING_BUTTON_ID} .krixai-icon {
      min-width: 16px;
      text-align: center;
      font-size: 14px;
      line-height: 1;
      margin-right: 0;
      transition: margin-right 0.18s ease;
    }
    #${FLOATING_BUTTON_ID}:hover .krixai-icon,
    #${FLOATING_BUTTON_ID}.expanded .krixai-icon {
      margin-right: 6px;
    }
    #${FLOATING_BUTTON_ID} .krixai-label {
      opacity: 0;
      max-width: 0;
      transition: opacity 0.18s ease, max-width 0.18s ease;
      font-size: 12px;
    }
    #${FLOATING_BUTTON_ID}:hover .krixai-label,
    #${FLOATING_BUTTON_ID}.expanded .krixai-label {
      opacity: 1;
      max-width: 80px;
    }
    #${FLOATING_BUTTON_ID} .krixai-tooltip {
      position: absolute;
      bottom: calc(100% + 8px);
      right: 0;
      background: #1a1a1a;
      color: #ffffff;
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 11px;
      line-height: 1;
      white-space: nowrap;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
      opacity: 0;
      pointer-events: none;
      transform: translateY(4px);
      transition: opacity 0.16s ease, transform 0.16s ease;
    }
    #${FLOATING_BUTTON_ID} .krixai-tooltip.visible {
      opacity: 1;
      transform: translateY(0);
    }
  `;
  document.documentElement.appendChild(style);
}

/**
 * Returns or creates floating button.
 * @returns {HTMLElement}
 */
function ensureFloatingButton() {
  if (floatingButton && document.contains(floatingButton)) {
    return floatingButton;
  }
  injectFloatingStyles();

  const button = document.createElement("button");
  button.id = FLOATING_BUTTON_ID;
  button.type = "button";
  button.innerHTML = `<span class="krixai-icon">✦</span><span class="krixai-label">Enhance ✦</span>`;
  button.addEventListener("mouseenter", () => button.classList.add("expanded"));
  button.addEventListener("mouseleave", () => button.classList.remove("expanded"));
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", onEnhanceClick);
  floatingButton = button;
  return button;
}

/**
 * Shows a temporary tooltip anchored to the button.
 * @param {string} text - Tooltip message.
 */
function showButtonTooltip(text) {
  const button = ensureFloatingButton();
  let tooltip = button.querySelector(".krixai-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("span");
    tooltip.className = "krixai-tooltip";
    button.appendChild(tooltip);
  }
  tooltip.textContent = text;
  tooltip.classList.add("visible");
  if (tooltipTimer !== null) {
    clearTimeout(tooltipTimer);
  }
  tooltipTimer = window.setTimeout(() => {
    tooltip.classList.remove("visible");
  }, 1800);
}

/**
 * Cancels pending hide timeout.
 */
function clearHideTimer() {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

/**
 * Ensures host parent is positioned for absolute button anchoring.
 * @param {HTMLElement} field - Active field.
 * @returns {HTMLElement}
 */
function ensureAnchor(field) {
  const parent = field.parentElement || field;
  const currentPosition = window.getComputedStyle(parent).position;
  if (currentPosition === "static") {
    parent.dataset.krixaiAnchor = "true";
    parent.style.position = "relative";
  }
  return parent;
}

/**
 * Shows floating button anchored to given field.
 * @param {HTMLElement} field - Target field.
 */
function showFloatingButton(field) {
  if (!field || !isSupportedPage()) {
    return;
  }
  clearHideTimer();
  activeField = field;
  const button = ensureFloatingButton();
  const anchor = ensureAnchor(field);
  let anchored = false;
  if (anchor && document.contains(anchor)) {
    if (button.parentElement !== anchor) {
      anchor.appendChild(button);
    }
    button.style.position = "absolute";
    button.style.bottom = "8px";
    button.style.right = "8px";
    anchored = true;
  }
  if (!anchored) {
    if (button.parentElement !== document.body) {
      document.body.appendChild(button);
    }
    button.style.position = "fixed";
    button.style.bottom = "80px";
    button.style.right = "20px";
  }
  requestAnimationFrame(() => {
    button.classList.add("visible");
  });
}

/**
 * Hides floating button.
 */
function hideFloatingButton() {
  if (!floatingButton) {
    return;
  }
  floatingButton.classList.remove("visible", "expanded");
}

/**
 * Delays hiding floating button to allow click.
 */
function hideFloatingButtonWithDelay() {
  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    hideFloatingButton();
  }, 300);
}

/**
 * Handles floating enhancement click.
 * @param {MouseEvent} event - Click event.
 */
async function onEnhanceClick(event) {
  event.preventDefault();
  event.stopPropagation();
  clearHideTimer();

  const field = activeField && document.contains(activeField) ? activeField : findPromptField();
  if (!field) {
    alert("Could not detect text field on this page.");
    hideFloatingButton();
    return;
  }

  const rawPrompt = getElementValue(field).trim();
  if (!rawPrompt) {
    alert("Please write a prompt first.");
    return;
  }

  const button = ensureFloatingButton();
  button.classList.add("expanded");
  button.setAttribute("aria-busy", "true");
  button.querySelector(".krixai-label").textContent = "Enhancing...";

  try {
    const result = await enhancePrompt(rawPrompt);
    if (result.contextInvalidated) {
      const label = button.querySelector(".krixai-label");
      if (label) label.textContent = "Enhance ✦";
      return;
    }
    if (!result.success) {
      throw new Error(result.error || "KrixAI failed to enhance your prompt.");
    }
    setElementValue(field, result.data.enhancedPrompt);
    button.querySelector(".krixai-label").textContent = "Enhanced ✓";
    window.setTimeout(() => {
      const label = button.querySelector(".krixai-label");
      if (label) label.textContent = "Enhance ✦";
      button.classList.remove("expanded");
    }, 1000);
  } catch (error) {
    alert(error.message || "KrixAI failed to enhance your prompt.");
    const label = button.querySelector(".krixai-label");
    if (label) label.textContent = "Enhance ✦";
  } finally {
    button.removeAttribute("aria-busy");
  }
}

/**
 * Updates field detection on DOM changes.
 */
function refreshPromptDetection() {
  if (!isSupportedPage()) {
    hideFloatingButton();
    return;
  }
  if (activeField && !document.contains(activeField)) {
    activeField = null;
    hideFloatingButton();
  }
  if (!activeField) {
    const found = findPromptField();
    if (found === document.activeElement) {
      showFloatingButton(found);
    }
  }
}

/**
 * Executes a full injection/detection pass.
 */
function runInjectionCycle() {
  const found = findPromptField();
  if (!found) {
    return;
  }
  if (found === document.activeElement || activeField === found) {
    activeField = found;
    showFloatingButton(found);
  }
}

/**
 * Handles focus and click events at document level.
 * @param {Event} event - Focus/click event.
 */
function onPotentialFieldActivate(event) {
  if (!isSupportedPage()) {
    return;
  }
  const targetField = resolveEditableTarget(event.target);
  if (!targetField) {
    return;
  }
  activeField = targetField;
  showFloatingButton(targetField);
}

/**
 * Handles document focus out and schedules hide.
 * @param {FocusEvent} event - Focus out event.
 */
function onFocusOut(event) {
  if (!activeField) {
    return;
  }
  const nextTarget = event.relatedTarget;
  if (floatingButton && nextTarget instanceof Node && floatingButton.contains(nextTarget)) {
    return;
  }
  hideFloatingButtonWithDelay();
}

/**
 * Handles popup requests for reading/writing prompt text.
 */
function setupPopupMessageHandlers() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_RAW_PROMPT") {
      const field = activeField && document.contains(activeField) ? activeField : findPromptField();
      if (!field) {
        sendResponse({ success: false, error: "Could not detect text field on this page." });
        return true;
      }
      sendResponse({ success: true, rawPrompt: getElementValue(field) });
      return true;
    }

    if (message?.type === "SET_ENHANCED_PROMPT") {
      const field = activeField && document.contains(activeField) ? activeField : findPromptField();
      if (!field) {
        sendResponse({ success: false, error: "Could not detect text field on this page." });
        return true;
      }
      setElementValue(field, message.enhancedPrompt || "");
      sendResponse({ success: true });
      return true;
    }

    return false;
  });
}

/**
 * Initializes floating enhancement behavior.
 */
function init() {
  if (!isSupportedPage()) {
    return;
  }
  setupPopupMessageHandlers();
  document.addEventListener("focusin", onPotentialFieldActivate, true);
  document.addEventListener("click", onPotentialFieldActivate, true);
  document.addEventListener("focusout", onFocusOut, true);

  const observer = new MutationObserver(() => {
    runInjectionCycle();
    refreshPromptDetection();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", runInjectionCycle);
  window.addEventListener("load", runInjectionCycle);
  window.setTimeout(runInjectionCycle, 2000);
  refreshPromptDetection();
  runInjectionCycle();
}

init();
