import { useState, useEffect, useRef, useCallback } from 'react'
import './index.css'

const API_BASE = 'http://localhost:4000';

function App() {
    // State
    const [file, setFile] = useState(null);
    const [uploadResult, setUploadResult] = useState(null);
    const [baseUrl, setBaseUrl] = useState('');
    const [headless, setHeadless] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [runResults, setRunResults] = useState(null);
    const [reports, setReports] = useState([]);
    const [expandedTc, setExpandedTc] = useState({});
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef(null);

    // Fetch reports on mount
    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const res = await fetch(`${API_BASE}/api/reports`);
            const data = await res.json();
            setReports(data);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        }
    };

    // File Upload
    const handleFileSelect = useCallback(async (selectedFile) => {
        if (!selectedFile) return;
        setFile(selectedFile);
        setIsUploading(true);
        setUploadResult(null);
        setRunResults(null);

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                setUploadResult(data);
            } else {
                alert(`Upload failed: ${data.error}`);
            }
        } catch (err) {
            alert(`Upload error: ${err.message}`);
        } finally {
            setIsUploading(false);
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelect(droppedFile);
    }, [handleFileSelect]);

    // Run Tests
    const handleRunTests = async () => {
        if (!uploadResult || !baseUrl) return;
        setIsRunning(true);
        setRunResults(null);

        try {
            const res = await fetch(`${API_BASE}/api/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filepath: uploadResult.filepath,
                    baseUrl,
                    headless
                })
            });
            const data = await res.json();
            if (res.ok) {
                setRunResults(data);
                fetchReports();
            } else {
                alert(`Run failed: ${data.error}`);
            }
        } catch (err) {
            alert(`Run error: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    };

    // Download template
    const handleDownloadTemplate = () => {
        window.open(`${API_BASE}/api/template`, '_blank');
    };

    const toggleTc = (tcId) => {
        setExpandedTc(prev => ({ ...prev, [tcId]: !prev[tcId] }));
    };

    return (
        <div className="app">
            {/* Header */}
            <header className="header">
                <div className="header__logo">🧪</div>
                <h1 className="header__title">AutoRegress Free</h1>
                <p className="header__subtitle">AI-Powered Regression Testing for IBM Maximo & Web Applications</p>
                <span className="header__badge">Free & Open Source</span>
            </header>

            {/* Upload Section */}
            <section className="card" style={{ animationDelay: '0.1s' }}>
                <h2 className="card__title">
                    <span className="card__title-icon">📄</span>
                    Upload Test Cases
                </h2>

                <div
                    className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                >
                    <div className="upload-zone__icon">{isUploading ? '⏳' : '📤'}</div>
                    <div className="upload-zone__text">
                        {isUploading ? 'Processing...' : 'Drop your Excel file here or click to browse'}
                    </div>
                    <div className="upload-zone__hint">Supports .xlsx and .xls files</div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => handleFileSelect(e.target.files[0])}
                    />
                </div>

                <div className="btn-row" style={{ marginTop: '16px' }}>
                    <button className="btn btn--secondary btn--sm" onClick={handleDownloadTemplate}>
                        ⬇️ Simple Template
                    </button>
                    <button className="btn btn--secondary btn--sm" onClick={() => window.open(`${API_BASE}/api/template?format=maximo`, '_blank')}>
                        ⬇️ Maximo Template
                    </button>
                </div>

                {/* Upload Result */}
                {uploadResult && (
                    <>
                        <div className="file-info">
                            <span className="file-info__icon">✅</span>
                            <div>
                                <div className="file-info__name">{file?.name}</div>
                                <div className="file-info__count">{uploadResult.testCaseCount} test case(s) parsed</div>
                            </div>
                        </div>

                        {/* Test Cases Preview */}
                        <div className="test-cases-preview">
                            {uploadResult.testCases.map(tc => (
                                <div className="tc-group" key={tc.tcId}>
                                    <div className="tc-group__header" onClick={() => toggleTc(tc.tcId)}>
                                        <h4>📋 {tc.tcId} {tc.title ? `— ${tc.title}` : ''}</h4>
                                        <span>{tc.steps.length} step(s) {expandedTc[tc.tcId] ? '▲' : '▼'}</span>
                                    </div>
                                    {expandedTc[tc.tcId] && (
                                        <div className="tc-group__steps">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Step#</th>
                                                        <th>Action</th>
                                                        <th>Element</th>
                                                        <th>Data</th>
                                                        <th>Expected</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tc.steps.map((s, i) => (
                                                        <tr key={i}>
                                                            <td>{s.testStep || i + 1}</td>
                                                            <td>{s.step}</td>
                                                            <td>{s.element || '-'}</td>
                                                            <td>{s.data || '-'}</td>
                                                            <td>{s.expected || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </section>

            {/* Run Configuration */}
            {uploadResult && (
                <section className="card" style={{ animationDelay: '0.2s' }}>
                    <h2 className="card__title">
                        <span className="card__title-icon">⚙️</span>
                        Run Configuration
                    </h2>

                    <div className="form-group">
                        <label>Application URL (Base URL)</label>
                        <input
                            type="url"
                            placeholder="https://your-maximo-instance.com or http://localhost:8080"
                            value={baseUrl}
                            onChange={(e) => setBaseUrl(e.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <div className="toggle" onClick={() => setHeadless(!headless)}>
                            <div className={`toggle__track ${headless ? 'active' : ''}`}>
                                <div className="toggle__thumb" />
                            </div>
                            <span className="toggle__label">
                                Headless Mode {headless ? '(Browser hidden)' : '(Browser visible)'}
                            </span>
                        </div>
                    </div>

                    <button
                        className="btn btn--primary"
                        onClick={handleRunTests}
                        disabled={!baseUrl || isRunning}
                    >
                        {isRunning ? (
                            <><span className="spinner" /> Running Tests...</>
                        ) : (
                            <>🚀 Run Regression Tests</>
                        )}
                    </button>
                </section>
            )}

            {/* Results */}
            {runResults && (
                <section className="card" style={{ animationDelay: '0.3s' }}>
                    <h2 className="card__title">
                        <span className="card__title-icon">📊</span>
                        Test Results
                    </h2>

                    <div className="summary-grid">
                        <div className="summary-stat summary-stat--total">
                            <div className="summary-stat__number">{runResults.summary.total}</div>
                            <div className="summary-stat__label">Total</div>
                        </div>
                        <div className="summary-stat summary-stat--pass">
                            <div className="summary-stat__number">{runResults.summary.passed}</div>
                            <div className="summary-stat__label">Passed</div>
                        </div>
                        <div className="summary-stat summary-stat--fail">
                            <div className="summary-stat__number">{runResults.summary.failed}</div>
                            <div className="summary-stat__label">Failed</div>
                        </div>
                        <div className="summary-stat summary-stat--rate">
                            <div className="summary-stat__number">
                                {runResults.summary.total > 0
                                    ? `${((runResults.summary.passed / runResults.summary.total) * 100).toFixed(0)}%`
                                    : '0%'}
                            </div>
                            <div className="summary-stat__label">Pass Rate</div>
                        </div>
                    </div>

                    {/* Detailed Results per TC */}
                    {runResults.results.map(tc => (
                        <div className="tc-group" key={tc.tcId}>
                            <div className="tc-group__header" onClick={() => toggleTc(`result-${tc.tcId}`)}>
                                <h4>
                                    {tc.status === 'PASS' ? '✅' : '❌'} {tc.tcId}
                                </h4>
                                <span className={`status status--${tc.status.toLowerCase()}`}>{tc.status}</span>
                            </div>
                            {expandedTc[`result-${tc.tcId}`] && (
                                <div className="tc-group__steps">
                                    <table className="results-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Step</th>
                                                <th>Action</th>
                                                <th>Status</th>
                                                <th>Duration</th>
                                                <th>Error</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {tc.steps.map(s => (
                                                <tr key={s.stepIndex}>
                                                    <td>{s.stepIndex}</td>
                                                    <td>{s.raw.step}</td>
                                                    <td>{s.interpreted.action}</td>
                                                    <td>
                                                        <span className={`status status--${s.status.toLowerCase()}`}>{s.status}</span>
                                                    </td>
                                                    <td>{s.duration}ms</td>
                                                    <td>{s.error ? <span className="error-text">{s.error}</span> : '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}

                    {runResults.reportUrl && (
                        <div style={{ marginTop: '20px' }}>
                            <a
                                className="btn btn--primary"
                                href={`${API_BASE}${runResults.reportUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                📄 View Full HTML Report
                            </a>
                        </div>
                    )}
                </section>
            )}

            {/* Previous Reports */}
            <section className="card" style={{ animationDelay: '0.4s' }}>
                <h2 className="card__title">
                    <span className="card__title-icon">📁</span>
                    Previous Reports
                </h2>

                {reports.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                        No reports yet. Upload test cases and run to generate reports.
                    </p>
                ) : (
                    reports.map((r, i) => (
                        <div className="report-item" key={i}>
                            <div>
                                <div className="report-item__name">📄 {r.name}</div>
                                <div className="report-item__date">{new Date(r.created).toLocaleString()}</div>
                            </div>
                            <a
                                className="btn btn--secondary btn--sm"
                                href={`${API_BASE}${r.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                View
                            </a>
                        </div>
                    ))
                )}
            </section>

            {/* Footer */}
            <footer style={{
                textAlign: 'center',
                padding: '32px 0',
                color: 'var(--text-muted)',
                fontSize: '13px'
            }}>
                AutoRegress Free &copy; {new Date().getFullYear()} — Free-Tier Automated Regression Testing
                <br />
                Optimized for IBM Maximo & Enterprise Web Applications
            </footer>
        </div>
    );
}

export default App;
