const XLSX = require('xlsx');

/**
 * Parse an Excel file containing regression test cases.
 * 
 * Supports TWO formats:
 * 
 * Format A (Simple template):
 *   Columns: TC_ID, Step, Element, Data, Expected
 *
 * Format B (IBM Maximo / Enterprise):
 *   Columns: TestCaseId, Title, TestStep, StepAction, StepExpected,
 *            TestPointId, Configuration, Tester, Outcome, Comment
 *
 * Auto-detects the format based on available columns.
 * Returns an array of test case objects grouped by TC_ID.
 */
function parseExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (rawRows.length === 0) {
        throw new Error('Excel file is empty or has no data rows');
    }

    // Normalize column names (case-insensitive, trim whitespace)
    const normalizedRows = rawRows.map(row => {
        const normalized = {};
        for (const [key, value] of Object.entries(row)) {
            const normKey = key.trim().toUpperCase().replace(/\s+/g, '_');
            normalized[normKey] = value;
        }
        return normalized;
    });

    // Detect format by checking which columns exist
    const firstRow = normalizedRows[0];
    const hasMaximoFormat = 'STEPACTION' in firstRow || 'STEP_ACTION' in firstRow
        || 'TESTCASEID' in firstRow || 'TEST_CASE_ID' in firstRow || 'TESTCASE_ID' in firstRow;

    let steps;

    if (hasMaximoFormat) {
        // ===== Format B: IBM Maximo / Enterprise =====
        steps = normalizedRows
            .filter(row => {
                // Skip rows that have no StepAction (e.g. header/metadata rows)
                const action = String(row.STEPACTION || row.STEP_ACTION || '').trim();
                return action.length > 0;
            })
            .map((row, index) => {
                const tcId = String(
                    row.TESTCASEID || row.TEST_CASE_ID || row.TESTCASE_ID || row.TC_ID || `TC_${index + 1}`
                ).trim();
                const title = String(row.TITLE || '').trim();
                const testStep = String(row.TESTSTEP || row.TEST_STEP || row.STEP_NO || '').trim();
                const stepAction = String(row.STEPACTION || row.STEP_ACTION || '').trim();
                const stepExpected = String(row.STEPEXPECTED || row.STEP_EXPECTED || '').trim();
                const testPointId = String(row.TESTPOINTID || row.TEST_POINT_ID || '').trim();
                const configuration = String(row.CONFIGURATION || '').trim();
                const tester = String(row.TESTER || '').trim();
                const outcome = String(row.OUTCOME || '').trim();
                const comment = String(row.COMMENT || row.COMMENTS || '').trim();

                // Parse the StepAction to extract action, element, and data
                const parsed = parseStepAction(stepAction);

                return {
                    tcId: tcId || 'UNKNOWN',
                    title,
                    testStep,
                    step: parsed.actionText,
                    element: parsed.element,
                    data: parsed.data,
                    expected: stepExpected,
                    // Preserve metadata
                    meta: { testPointId, configuration, tester, outcome, comment }
                };
            });
    } else {
        // ===== Format A: Simple template =====
        steps = normalizedRows.map((row, index) => ({
            tcId: String(row.TC_ID || row.TCID || row.TEST_CASE_ID || `TC_${index + 1}`).trim(),
            title: '',
            testStep: String(index + 1),
            step: String(row.STEP || row.ACTION || row.DESCRIPTION || '').trim(),
            element: String(row.ELEMENT || row.LOCATOR || row.SELECTOR || row.FIELD || '').trim(),
            data: String(row.DATA || row.INPUT || row.VALUE || '').trim(),
            expected: String(row.EXPECTED || row.EXPECTED_RESULT || row.VALIDATION || '').trim(),
            meta: {}
        }));
    }

    // Group by TC_ID
    const grouped = {};
    for (const step of steps) {
        if (!grouped[step.tcId]) {
            grouped[step.tcId] = {
                tcId: step.tcId,
                title: step.title || '',
                steps: []
            };
        }
        // Inherit title from first row that has it
        if (step.title && !grouped[step.tcId].title) {
            grouped[step.tcId].title = step.title;
        }
        grouped[step.tcId].steps.push(step);
    }

    return Object.values(grouped);
}

/**
 * Parse a free-text StepAction string into structured action, element, and data.
 * 
 * Examples:
 *   "Login to Maximo."
 *     → { actionText: "Login", element: "", data: "" }
 *
 *   "Click on the 'User Profile' button and select 'Default Information'"
 *     → { actionText: "Click", element: "User Profile", data: "Default Information" }
 *
 *   "In the 'Line of Business' field, select a value"
 *     → { actionText: "Select", element: "Line of Business", data: "" }
 *
 *   "Populate Clearance Description and classification"
 *     → { actionText: "Enter", element: "Clearance Description", data: "" }
 *
 *   "Navigate to Clearances (Therm) application"
 *     → { actionText: "Navigate", element: "Clearances (Therm)", data: "" }
 */
function parseStepAction(text) {
    if (!text) return { actionText: '', element: '', data: '' };

    let actionText = '';
    let element = '';
    let data = '';

    const lower = text.toLowerCase();

    // --- Extract quoted values (these are likely element names or data) ---
    const quotedValues = [];
    const quoteRegex = /['""'']([^'""'']+)['""'']/g;
    let match;
    while ((match = quoteRegex.exec(text)) !== null) {
        quotedValues.push(match[1].trim());
    }

    // --- Determine action type from keywords ---
    if (/^(mx\s+)?login|^log\s*in|^sign\s*in/i.test(lower)) {
        actionText = 'Login';
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
    }
    else if (/^navigate|^go\s*to|^open|^launch|^move\s+to/i.test(lower)) {
        actionText = 'Navigate';
        // Extract destination from "Navigate to X" or quoted values
        const navMatch = text.match(/(?:navigate|go|move)\s+to\s+(?:the\s+)?(.+?)(?:\.|$)/i);
        element = quotedValues[0] || (navMatch ? navMatch[1].trim() : '');
    }
    else if (/^click|^press|^tap|^hit|^select\s+button/i.test(lower)) {
        actionText = 'Click';
        // Extract element from "Click on 'X'" or "Click the X button"
        element = quotedValues[0] || '';
        if (!element) {
            const clickMatch = text.match(/click\s+(?:on\s+)?(?:the\s+)?(.+?)(?:\s+button|\s+link|\s+icon|\s+tab|\.|$)/i);
            if (clickMatch) element = clickMatch[1].replace(/['"]/g, '').trim();
        }
        data = quotedValues[1] || '';
    }
    else if (/^(type|enter|input|fill|set|write|populate|put)\b/i.test(lower)) {
        actionText = 'Enter';
        // "Populate X field with Y" or "Enter Y in X field"
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
        if (!element) {
            const fieldMatch = text.match(/(?:populate|fill|enter|type|set|put)\s+(?:the\s+)?(.+?)\s+(?:field|input|textbox|with|and)/i);
            if (fieldMatch) element = fieldMatch[1].trim();
        }
    }
    else if (/^select|^choose|^pick/i.test(lower)) {
        actionText = 'Select';
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
    }
    else if (/^(in the|in\s+')/i.test(lower)) {
        // "In the 'X' field, select/enter/click..."
        element = quotedValues[0] || '';
        if (/select/i.test(lower)) {
            actionText = 'Select';
            data = quotedValues[1] || '';
        } else if (/enter|type|fill|populate/i.test(lower)) {
            actionText = 'Enter';
            data = quotedValues[1] || '';
        } else if (/click/i.test(lower)) {
            actionText = 'Click';
        } else if (/use/i.test(lower)) {
            actionText = 'Click';
            data = quotedValues[1] || '';
        } else {
            actionText = 'Click';
        }
    }
    else if (/^verify|^assert|^confirm|^validate|^check\s+that|^ensure/i.test(lower)) {
        actionText = 'Verify';
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
    }
    else if (/^find\b/i.test(lower)) {
        actionText = 'Verify';
        element = quotedValues[0] || '';
    }
    else if (/^(wait|pause|delay)/i.test(lower)) {
        actionText = 'Wait';
    }
    else if (/^scroll/i.test(lower)) {
        actionText = 'Scroll';
        element = quotedValues[0] || '';
    }
    else if (/^(hover|mouse\s*over)/i.test(lower)) {
        actionText = 'Hover';
        element = quotedValues[0] || '';
    }
    else if (/^(double[\s-]*click)/i.test(lower)) {
        actionText = 'Double Click';
        element = quotedValues[0] || '';
    }
    else if (/^(right[\s-]*click)/i.test(lower)) {
        actionText = 'Right Click';
        element = quotedValues[0] || '';
    }
    else if (/^(clear|erase|empty)/i.test(lower)) {
        actionText = 'Clear';
        element = quotedValues[0] || '';
    }
    else if (/^(upload|attach)/i.test(lower)) {
        actionText = 'Upload';
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
    }
    else if (/^(refresh|reload)/i.test(lower)) {
        actionText = 'Refresh';
    }
    else if (/^(close)/i.test(lower)) {
        actionText = 'Close';
    }
    else if (/^(log\s*out|sign\s*out)/i.test(lower)) {
        actionText = 'Logout';
    }
    else {
        // Fallback: use the full text as the action, try to detect from context
        actionText = text.split(/[.,;]/).shift().trim();
        element = quotedValues[0] || '';
        data = quotedValues[1] || '';
    }

    return { actionText, element, data };
}

module.exports = { parseExcel, parseStepAction };
