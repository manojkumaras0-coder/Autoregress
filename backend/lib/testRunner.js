/**
 * Test Runner
 * Orchestrates Playwright browser sessions and executes interpreted test steps.
 * Uses smart waiting, frame-aware element resolution, and screenshot capture.
 */
const { chromium } = require('playwright');
const { interpretStep } = require('./actionInterpreter');
const { findElementAcrossFrames } = require('./frameHandler');
const path = require('path');

/**
 * Run all test cases against a target application.
 * @param {Array} testCases - Parsed test cases from Excel (grouped by TC_ID)
 * @param {Object} options - { baseUrl, headless, screenshotDir, runId }
 * @returns {Promise<Array>} - Results array
 */
async function runTests(testCases, options) {
    const { baseUrl, headless = true, screenshotDir, runId } = options;
    const results = [];

    const browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            ignoreHTTPSErrors: true,
            // Long timeout for slow enterprise apps like Maximo
            navigationTimeout: 60000,
            actionTimeout: 30000
        });
        context.setDefaultTimeout(30000);

        const page = await context.newPage();

        for (const testCase of testCases) {
            const tcResult = {
                tcId: testCase.tcId,
                steps: [],
                status: 'PASS',
                startTime: new Date().toISOString(),
                endTime: null
            };

            for (let i = 0; i < testCase.steps.length; i++) {
                const step = testCase.steps[i];
                const interpreted = interpretStep(step);
                const stepResult = {
                    stepIndex: i + 1,
                    raw: step,
                    interpreted,
                    status: 'PASS',
                    error: null,
                    screenshot: null,
                    duration: 0
                };

                const stepStart = Date.now();

                try {
                    await executeAction(page, interpreted, baseUrl);

                    // Take screenshot after each step
                    const screenshotName = `${testCase.tcId}_step${i + 1}.png`;
                    const screenshotPath = path.join(screenshotDir, screenshotName);
                    await page.screenshot({ path: screenshotPath, fullPage: false });
                    stepResult.screenshot = screenshotName;

                    // Validate expected result if present
                    if (interpreted.expected) {
                        await validateExpected(page, interpreted.expected);
                    }
                } catch (err) {
                    stepResult.status = 'FAIL';
                    stepResult.error = err.message;
                    tcResult.status = 'FAIL';

                    // Capture failure screenshot
                    try {
                        const failScreenshotName = `${testCase.tcId}_step${i + 1}_FAIL.png`;
                        const failScreenshotPath = path.join(screenshotDir, failScreenshotName);
                        await page.screenshot({ path: failScreenshotPath, fullPage: true });
                        stepResult.screenshot = failScreenshotName;
                    } catch (_) { /* ignore screenshot errors */ }
                }

                stepResult.duration = Date.now() - stepStart;
                tcResult.steps.push(stepResult);
            }

            tcResult.endTime = new Date().toISOString();
            results.push(tcResult);
        }

        await context.close();
    } finally {
        await browser.close();
    }

    return results;
}

/**
 * Execute a single interpreted action on the page.
 */
async function executeAction(page, interpreted, baseUrl) {
    const { action, locator, value } = interpreted;

    switch (action) {
        case 'navigate': {
            let url = value || (locator && locator.type === 'url' ? locator.value : null) || baseUrl;
            if (url && !/^https?:\/\//i.test(url)) {
                url = baseUrl.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
            }
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            // Smart wait: wait for network to settle after navigation
            await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
            break;
        }

        case 'click': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.scrollIntoViewIfNeeded();
            await element.click({ timeout: 15000 });
            // Smart wait: wait for potential navigation or network activity
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
            break;
        }

        case 'type': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.scrollIntoViewIfNeeded();
            await element.click();
            await element.fill(''); // Clear first
            await element.fill(value || '');
            break;
        }

        case 'select': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.selectOption(value || '');
            break;
        }

        case 'check': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.check();
            break;
        }

        case 'uncheck': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.uncheck();
            break;
        }

        case 'hover': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.hover();
            break;
        }

        case 'dblclick': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.dblclick();
            break;
        }

        case 'rightclick': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.click({ button: 'right' });
            break;
        }

        case 'clear': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.fill('');
            break;
        }

        case 'upload': {
            const { element } = await findElementAcrossFrames(page, locator);
            await element.setInputFiles(value || '');
            break;
        }

        case 'presskey': {
            const keyName = value || 'Enter';
            await page.keyboard.press(keyName);
            break;
        }

        case 'switchframe': {
            // Frame switching is handled automatically by findElementAcrossFrames
            // This is a no-op but logged for clarity
            break;
        }

        case 'wait': {
            const ms = parseInt(value, 10) || 3000;
            await page.waitForTimeout(ms);
            break;
        }

        case 'scroll': {
            if (locator) {
                const { element } = await findElementAcrossFrames(page, locator);
                await element.scrollIntoViewIfNeeded();
            } else {
                await page.evaluate(() => window.scrollBy(0, 500));
            }
            break;
        }

        case 'verify': {
            // Verification is handled in validateExpected
            break;
        }

        case 'screenshot': {
            // Screenshot is taken after every step automatically
            break;
        }

        case 'login': {
            // Composite action: navigate to base URL and perform login
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
            // Attempt to find and fill username/password fields
            if (locator && value) {
                // locator is username field, value contains "username|password"
                const [username, password] = value.split('|');
                try {
                    const userField = page.getByLabel(/user|email|login/i).first()
                        || page.getByPlaceholder(/user|email|login/i).first();
                    const passField = page.getByLabel(/pass/i).first()
                        || page.getByPlaceholder(/pass/i).first();
                    if (userField) await userField.fill(username || '');
                    if (passField) await passField.fill(password || '');
                    // Try to click Sign In / Login button
                    const loginBtn = page.getByRole('button', { name: /sign\s*in|log\s*in|submit/i });
                    await loginBtn.click();
                    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
                } catch (_) { /* silently continue if auto-login fails */ }
            }
            break;
        }

        case 'logout': {
            // Try common logout patterns
            try {
                const logoutLink = page.getByRole('link', { name: /log\s*out|sign\s*out/i }).first();
                await logoutLink.click();
            } catch {
                try {
                    const logoutBtn = page.getByRole('button', { name: /log\s*out|sign\s*out/i }).first();
                    await logoutBtn.click();
                } catch {
                    // Try clicking user menu first, then logout
                    try {
                        await page.getByRole('button', { name: /user|profile|account/i }).first().click();
                        await page.getByText(/log\s*out|sign\s*out/i).first().click();
                    } catch (_) { /* ignore */ }
                }
            }
            break;
        }

        case 'refresh': {
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => { });
            break;
        }

        case 'goback': {
            await page.goBack({ waitUntil: 'domcontentloaded' });
            break;
        }

        case 'close': {
            // Close current context (tab)
            break;
        }

        default:
            throw new Error(`Unknown action: ${action}. Step: "${interpreted.raw.step}"`);
    }
}

/**
 * Validate an expected result on the current page.
 * Checks for text visibility, URL patterns, or element presence.
 */
async function validateExpected(page, expected) {
    if (!expected) return;
    const text = expected.trim();

    // URL-based validation
    if (/^url:/i.test(text)) {
        const expectedUrl = text.replace(/^url:/i, '').trim();
        const currentUrl = page.url();
        if (!currentUrl.includes(expectedUrl)) {
            throw new Error(`URL validation failed. Expected URL to contain "${expectedUrl}", got "${currentUrl}"`);
        }
        return;
    }

    // Title-based validation
    if (/^title:/i.test(text)) {
        const expectedTitle = text.replace(/^title:/i, '').trim();
        const title = await page.title();
        if (!title.toLowerCase().includes(expectedTitle.toLowerCase())) {
            throw new Error(`Title validation failed. Expected "${expectedTitle}", got "${title}"`);
        }
        return;
    }

    // Default: look for text on the page (across frames)
    const found = await findTextInPage(page, text);
    if (!found) {
        throw new Error(`Validation failed: expected text "${text}" not found on the page`);
    }
}

/**
 * Search for text across the main page and all frames.
 */
async function findTextInPage(page, text) {
    // Try main page
    try {
        await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 5000 });
        return true;
    } catch { /* not in main page */ }

    // Try all frames
    for (const frame of page.frames()) {
        try {
            await frame.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout: 2000 });
            return true;
        } catch { /* not in this frame */ }
    }

    return false;
}

module.exports = { runTests };
