const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parseExcel } = require('./lib/excelParser');
const { runTests } = require('./lib/testRunner');
const { generateReport } = require('./lib/reportGenerator');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/reports', express.static(path.join(__dirname, 'reports')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure directories exist
['uploads', 'reports', 'screenshots'].forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Multer config for Excel upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

// ========== API Endpoints ==========

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload Excel and parse test cases
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const testCases = parseExcel(req.file.path);
        res.json({
            message: 'File uploaded and parsed successfully',
            filename: req.file.filename,
            filepath: req.file.path,
            testCaseCount: testCases.length,
            testCases
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Run tests from a previously uploaded file
app.post('/api/run', async (req, res) => {
    try {
        const { filepath, baseUrl, headless } = req.body;
        if (!filepath) {
            return res.status(400).json({ error: 'filepath is required' });
        }
        if (!baseUrl) {
            return res.status(400).json({ error: 'baseUrl is required (the application URL to test)' });
        }

        const testCases = parseExcel(filepath);
        const runId = `run-${Date.now()}`;
        const screenshotDir = path.join(__dirname, 'screenshots', runId);
        fs.mkdirSync(screenshotDir, { recursive: true });

        // Run tests
        const results = await runTests(testCases, {
            baseUrl,
            headless: headless !== false,
            screenshotDir,
            runId
        });

        // Generate report
        const reportPath = await generateReport(results, {
            runId,
            screenshotDir,
            reportDir: path.join(__dirname, 'reports')
        });

        res.json({
            message: 'Test run complete',
            runId,
            summary: {
                total: results.length,
                passed: results.filter(r => r.status === 'PASS').length,
                failed: results.filter(r => r.status === 'FAIL').length,
                skipped: results.filter(r => r.status === 'SKIP').length
            },
            reportUrl: `/reports/${path.basename(reportPath)}`,
            results
        });
    } catch (err) {
        console.error('Run error:', err);
        res.status(500).json({ error: err.message });
    }
});

// List previous reports
app.get('/api/reports', (req, res) => {
    const reportDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportDir)) return res.json([]);
    const files = fs.readdirSync(reportDir)
        .filter(f => f.endsWith('.html'))
        .map(f => ({
            name: f,
            url: `/reports/${f}`,
            created: fs.statSync(path.join(reportDir, f)).birthtime
        }))
        .sort((a, b) => new Date(b.created) - new Date(a.created));
    res.json(files);
});

// Download sample template
app.get('/api/template', (req, res) => {
    const format = req.query.format || 'simple';
    const filename = format === 'maximo' ? 'maximo_template.xlsx' : 'sample_template.xlsx';
    const templatePath = path.join(__dirname, 'templates', filename);
    if (fs.existsSync(templatePath)) {
        res.download(templatePath);
    } else {
        res.status(404).json({ error: 'Template not found' });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 AutoRegress Free server running on http://localhost:${PORT}`);
});
