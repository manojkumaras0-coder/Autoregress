/**
 * Generate sample Excel templates for both formats.
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const templateDir = path.join(__dirname, '..', 'templates');
if (!fs.existsSync(templateDir)) fs.mkdirSync(templateDir, { recursive: true });

// ===== Format A: Simple Template =====
const simpleData = [
    { TC_ID: 'TC001', Step: 'Open App', Element: 'URL', Data: 'https://your-app-url.com', Expected: 'App Loaded' },
    { TC_ID: 'TC001', Step: 'Enter', Element: 'Username Field', Data: 'admin', Expected: '' },
    { TC_ID: 'TC001', Step: 'Enter', Element: 'Password Field', Data: 'password123', Expected: '' },
    { TC_ID: 'TC001', Step: 'Click', Element: 'button Sign In', Data: '', Expected: 'Dashboard' },
];

const wsSimple = XLSX.utils.json_to_sheet(simpleData);
wsSimple['!cols'] = [{ wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 30 }];
const wbSimple = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbSimple, wsSimple, 'Test Cases');
XLSX.writeFile(wbSimple, path.join(templateDir, 'sample_template.xlsx'));
console.log('✅ Simple template created');

// ===== Format B: Maximo Template =====
const maximoData = [
    {
        TestCaseId: '334792', Title: '[APP] Maximo Clearance Test', TestStep: '1',
        StepAction: 'MX Login and Set Default Profile Settings',
        StepExpected: '', TestPointId: '602877:0', Configuration: 'Windows 10',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '1.1',
        StepAction: "Login to Maximo.",
        StepExpected: 'Logged in successfully.', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '1.2',
        StepAction: "Click on the 'User Profile' button and select 'Default Information'",
        StepExpected: 'Default site successfully set to appropriate value.', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '1.3',
        StepAction: "In the 'Line of Business' field, select a value",
        StepExpected: 'LOB Selected.', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '1.4',
        StepAction: "Click Ok.",
        StepExpected: '', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '2',
        StepAction: "Navigate to Clearances (Therm) application",
        StepExpected: 'Clearances (Therm) application opens.', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
    {
        TestCaseId: '334792', Title: '', TestStep: '3',
        StepAction: "Click on the '+' icon to create New Clearance",
        StepExpected: 'New record opens.', TestPointId: '', Configuration: '',
        Tester: '', Outcome: '', Comment: ''
    },
];

const wsMaximo = XLSX.utils.json_to_sheet(maximoData);
wsMaximo['!cols'] = [
    { wch: 12 }, { wch: 30 }, { wch: 8 }, { wch: 55 }, { wch: 45 },
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 20 }
];
const wbMaximo = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbMaximo, wsMaximo, 'Test Cases');
XLSX.writeFile(wbMaximo, path.join(templateDir, 'maximo_template.xlsx'));
console.log('✅ Maximo template created');
