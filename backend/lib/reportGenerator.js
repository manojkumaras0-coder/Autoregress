/**
 * Report Generator
 * Generates rich HTML reports with embedded screenshots and summary statistics.
 */
const fs = require('fs');
const path = require('path');

/**
 * Generate an HTML report from test results.
 * @param {Array} results - Array of test case results
 * @param {Object} options - { runId, screenshotDir, reportDir }
 * @returns {string} - Path to generated report
 */
async function generateReport(results, options) {
    const { runId, screenshotDir, reportDir } = options;

    if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
    }

    const total = results.length;
    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    // Read screenshots and encode as base64
    const getScreenshotBase64 = (name) => {
        if (!name) return null;
        const filePath = path.join(screenshotDir, name);
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            return `data:image/png;base64,${data.toString('base64')}`;
        }
        return null;
    };

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutoRegress Free - Test Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #0f0f23;
      color: #e0e0e0;
      padding: 24px;
    }
    .header {
      background: linear-gradient(135deg, #1a1a3e 0%, #2d1b69 50%, #1a1a3e 100%);
      border-radius: 16px;
      padding: 32px;
      margin-bottom: 24px;
      border: 1px solid rgba(139, 92, 246, 0.3);
    }
    .header h1 {
      font-size: 28px;
      background: linear-gradient(90deg, #a78bfa, #60a5fa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header .meta { color: #94a3b8; font-size: 14px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 32px;
    }
    .summary-card {
      background: rgba(30, 30, 60, 0.8);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }
    .summary-card .number {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .summary-card .label { color: #94a3b8; font-size: 13px; text-transform: uppercase; }
    .total .number { color: #60a5fa; }
    .passed .number { color: #34d399; }
    .failed .number { color: #f87171; }
    .rate .number { color: #fbbf24; }
    .tc-card {
      background: rgba(30, 30, 60, 0.6);
      border: 1px solid rgba(139, 92, 246, 0.15);
      border-radius: 12px;
      margin-bottom: 20px;
      overflow: hidden;
    }
    .tc-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 24px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .tc-header:hover { background: rgba(139, 92, 246, 0.1); }
    .tc-header h3 { font-size: 16px; }
    .badge {
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge.pass { background: rgba(52, 211, 153, 0.2); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); }
    .badge.fail { background: rgba(248, 113, 113, 0.2); color: #f87171; border: 1px solid rgba(248, 113, 113, 0.3); }
    .tc-body { padding: 0 24px 24px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid rgba(139, 92, 246, 0.1); font-size: 13px; }
    th { color: #a78bfa; font-weight: 600; }
    .step-pass { color: #34d399; }
    .step-fail { color: #f87171; }
    .error-msg { color: #f87171; font-size: 12px; margin-top: 4px; font-style: italic; }
    .screenshot-thumb {
      width: 120px;
      border-radius: 6px;
      cursor: pointer;
      border: 1px solid rgba(139, 92, 246, 0.3);
      transition: transform 0.2s;
    }
    .screenshot-thumb:hover { transform: scale(1.5); z-index: 10; position: relative; }
    .footer {
      text-align: center;
      padding: 24px;
      color: #64748b;
      font-size: 12px;
      border-top: 1px solid rgba(139, 92, 246, 0.1);
      margin-top: 32px;
    }
    /* Modal for full-size screenshots */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.85);
      z-index: 1000;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }
    .modal-overlay.active { display: flex; }
    .modal-overlay img { max-width: 90vw; max-height: 90vh; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 AutoRegress Free — Test Report</h1>
    <div class="meta">
      Run ID: ${runId} &nbsp;|&nbsp;
      Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp;
      Platform: IBM Maximo / Web Application
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card total">
      <div class="number">${total}</div>
      <div class="label">Total Test Cases</div>
    </div>
    <div class="summary-card passed">
      <div class="number">${passed}</div>
      <div class="label">Passed</div>
    </div>
    <div class="summary-card failed">
      <div class="number">${failed}</div>
      <div class="label">Failed</div>
    </div>
    <div class="summary-card rate">
      <div class="number">${passRate}%</div>
      <div class="label">Pass Rate</div>
    </div>
  </div>

  ${results.map(tc => `
  <div class="tc-card">
    <div class="tc-header" onclick="this.parentElement.querySelector('.tc-body').style.display = this.parentElement.querySelector('.tc-body').style.display === 'none' ? 'block' : 'none'">
      <h3>${tc.tcId}</h3>
      <span class="badge ${tc.status === 'PASS' ? 'pass' : 'fail'}">${tc.status}</span>
    </div>
    <div class="tc-body">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Step</th>
            <th>Action</th>
            <th>Element</th>
            <th>Data</th>
            <th>Expected</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Screenshot</th>
          </tr>
        </thead>
        <tbody>
          ${tc.steps.map(s => `
          <tr>
            <td>${s.stepIndex}</td>
            <td>${s.raw.step || '-'}</td>
            <td>${s.interpreted.action}</td>
            <td>${s.raw.element || '-'}</td>
            <td>${s.raw.data || '-'}</td>
            <td>${s.raw.expected || '-'}</td>
            <td class="${s.status === 'PASS' ? 'step-pass' : 'step-fail'}">${s.status}</td>
            <td>${s.duration}ms</td>
            <td>${(() => {
            const b64 = getScreenshotBase64(s.screenshot);
            return b64 ? `<img class="screenshot-thumb" src="${b64}" onclick="openModal(this.src)" />` : '-';
        })()}</td>
          </tr>
          ${s.error ? `<tr><td colspan="9"><div class="error-msg">❌ ${s.error}</div></td></tr>` : ''}
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
  `).join('')}

  <div class="footer">
    AutoRegress Free &copy; ${new Date().getFullYear()} — Free-Tier Automated Regression Testing
  </div>

  <div class="modal-overlay" id="screenshotModal" onclick="this.classList.remove('active')">
    <img id="modalImg" src="" />
  </div>

  <script>
    function openModal(src) {
      document.getElementById('modalImg').src = src;
      document.getElementById('screenshotModal').classList.add('active');
    }
  </script>
</body>
</html>`;

    const reportPath = path.join(reportDir, `report-${runId}.html`);
    fs.writeFileSync(reportPath, html, 'utf-8');
    return reportPath;
}

module.exports = { generateReport };
