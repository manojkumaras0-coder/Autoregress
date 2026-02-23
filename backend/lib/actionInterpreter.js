/**
 * Action Interpreter
 * Maps human-readable test steps from Excel to Playwright action objects.
 * No LLM required — uses keyword/pattern matching with smart defaults.
 */

// Keyword patterns for action recognition
const ACTION_PATTERNS = [
    // Navigation
    { pattern: /^(open|navigate|go\s*to|launch|browse|load|visit)\b/i, action: 'navigate' },
    // Click actions
    { pattern: /^(click|press|tap|hit|select\s+button|push)\b/i, action: 'click' },
    // Type / Enter text
    { pattern: /^(type|enter|input|fill|set|write|put)\b/i, action: 'type' },
    // Select dropdown
    { pattern: /^(select|choose|pick|dropdown)\b/i, action: 'select' },
    // Check / Uncheck
    { pattern: /^(check|tick)\b/i, action: 'check' },
    { pattern: /^(uncheck|untick|deselect)\b/i, action: 'uncheck' },
    // Wait
    { pattern: /^(wait|pause|delay|sleep)\b/i, action: 'wait' },
    // Scroll
    { pattern: /^(scroll)\b/i, action: 'scroll' },
    // Hover
    { pattern: /^(hover|mouse\s*over|move\s*to)\b/i, action: 'hover' },
    // Double click
    { pattern: /^(double[\s-]*click|dbl[\s-]*click)\b/i, action: 'dblclick' },
    // Right click
    { pattern: /^(right[\s-]*click|context[\s-]*click)\b/i, action: 'rightclick' },
    // Clear
    { pattern: /^(clear|erase|empty|reset\s+field)\b/i, action: 'clear' },
    // Upload file
    { pattern: /^(upload|attach|browse\s+file)\b/i, action: 'upload' },
    // Press key
    { pattern: /^(press\s+key|keyboard|key\s*press|hit\s+key)\b/i, action: 'presskey' },
    // Switch frame
    { pattern: /^(switch\s*(to)?\s*frame|iframe)\b/i, action: 'switchframe' },
    // Verify / Assert
    { pattern: /^(verify|assert|check\s+that|validate|confirm|expect|ensure|should)\b/i, action: 'verify' },
    // Screenshot
    { pattern: /^(screenshot|capture|snap)\b/i, action: 'screenshot' },
    // Login (composite)
    { pattern: /^(login|log\s*in|sign\s*in|authenticate)\b/i, action: 'login' },
    // Logout
    { pattern: /^(logout|log\s*out|sign\s*out)\b/i, action: 'logout' },
    // Close
    { pattern: /^(close)\b/i, action: 'close' },
    // Refresh
    { pattern: /^(refresh|reload)\b/i, action: 'refresh' },
    // Go back
    { pattern: /^(go\s*back|back|previous)\b/i, action: 'goback' },
];

/**
 * Interpret a single test step into a Playwright-compatible action object.
 * @param {Object} step - { step, element, data, expected }
 * @returns {Object} - { action, locator, value, expected, raw }
 */
function interpretStep(step) {
    const stepText = String(step.step ?? '').trim();
    const element = String(step.element ?? '').trim();
    const data = String(step.data ?? '').trim();
    const expected = String(step.expected ?? '').trim();

    let action = 'unknown';
    for (const { pattern, action: act } of ACTION_PATTERNS) {
        if (pattern.test(stepText)) {
            action = act;
            break;
        }
    }

    // Build locator strategy
    const locator = buildLocator(element);

    return {
        action,
        locator,
        value: data || null,
        expected: expected || null,
        raw: { step: stepText, element, data, expected }
    };
}

/**
 * Build a smart Playwright locator from an element description.
 * Prioritizes accessible locators for resilience against dynamic IDs.
 *
 * Supports:
 *   - CSS selectors (starts with . # [ or contains :)
 *   - XPath (starts with / or //)
 *   - ID references (id=xxx)
 *   - Labeled fields (e.g., "Email Field", "Username input")
 *   - Role-based (e.g., "button Login", "link Home")
 *   - URL (starts with http)
 *   - Plain text (fallback: getByText)
 */
function buildLocator(element) {
    if (!element) return null;

    // URL
    if (/^https?:\/\//i.test(element)) {
        return { type: 'url', value: element };
    }

    // Explicit CSS selector
    if (/^[.#\[]/.test(element) || element.includes('::') || element.includes('>')) {
        return { type: 'css', value: element };
    }

    // XPath
    if (/^\/\//.test(element) || /^\/[a-zA-Z]/.test(element)) {
        return { type: 'xpath', value: element };
    }

    // id=someId
    if (/^id=/i.test(element)) {
        return { type: 'id', value: element.replace(/^id=/i, '').trim() };
    }

    // Role-based: "button Submit", "link Home", "textbox Email"
    const roleMatch = element.match(/^(button|link|textbox|checkbox|radio|combobox|tab|menuitem|heading|row|cell|dialog|alertdialog)\s+(.+)$/i);
    if (roleMatch) {
        return { type: 'role', role: roleMatch[1].toLowerCase(), name: roleMatch[2].trim() };
    }

    // Label-based heuristics: "Email Field", "Password input", "Username textbox"
    const fieldMatch = element.match(/^(.+?)\s+(field|input|textbox|box|area|dropdown|select|checkbox|radio|btn|button)$/i);
    if (fieldMatch) {
        return { type: 'label', value: fieldMatch[1].trim() };
    }

    // Placeholder-based: "placeholder:Search..."
    if (/^placeholder:/i.test(element)) {
        return { type: 'placeholder', value: element.replace(/^placeholder:/i, '').trim() };
    }

    // Fallback: treat as text
    return { type: 'text', value: element };
}

module.exports = { interpretStep, buildLocator, ACTION_PATTERNS };
