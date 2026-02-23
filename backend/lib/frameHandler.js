/**
 * Frame Handler
 * Recursively searches for elements across all frames and iframes.
 * Critical for IBM Maximo which uses deeply nested iframes.
 */

/**
 * Find an element across all frames in a page, recursively.
 * @param {import('playwright').Page} page
 * @param {Object} locator - { type, value, role, name }
 * @param {Object} options - { timeout }
 * @returns {Promise<{ element: Locator, frame: Frame|Page }>}
 */
async function findElementAcrossFrames(page, locator, options = {}) {
    const timeout = options.timeout || 10000;

    // First try in the main page
    const mainResult = await tryFindInContext(page, locator, timeout / 3);
    if (mainResult) return { element: mainResult, frame: page };

    // Then recursively search all frames
    const frames = page.frames();
    for (const frame of frames) {
        if (frame === page.mainFrame()) continue;
        const result = await tryFindInContext(frame, locator, timeout / (frames.length + 1));
        if (result) return { element: result, frame };
    }

    // Deep nested search (frames within frames)
    for (const frame of frames) {
        const childFrames = frame.childFrames();
        for (const childFrame of childFrames) {
            const result = await tryFindInContext(childFrame, locator, 2000);
            if (result) return { element: result, frame: childFrame };
        }
    }

    throw new Error(`Element not found in any frame: ${JSON.stringify(locator)}`);
}

/**
 * Try to find an element in a specific frame/page context.
 * @param {import('playwright').Frame|import('playwright').Page} context
 * @param {Object} locator
 * @param {number} timeout
 * @returns {Promise<Locator|null>}
 */
async function tryFindInContext(context, locator, timeout) {
    try {
        let el;
        switch (locator.type) {
            case 'role':
                el = context.getByRole(locator.role, { name: locator.name });
                break;
            case 'label':
                el = context.getByLabel(locator.value);
                break;
            case 'placeholder':
                el = context.getByPlaceholder(locator.value);
                break;
            case 'text':
                el = context.getByText(locator.value, { exact: false });
                break;
            case 'id':
                el = context.locator(`#${locator.value}`);
                break;
            case 'css':
                el = context.locator(locator.value);
                break;
            case 'xpath':
                el = context.locator(`xpath=${locator.value}`);
                break;
            default:
                return null;
        }

        // Wait for visibility with the given timeout
        await el.first().waitFor({ state: 'visible', timeout });
        return el.first();
    } catch {
        return null;
    }
}

module.exports = { findElementAcrossFrames, tryFindInContext };
