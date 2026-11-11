import { useEffect, useRef, useState } from 'react';
import { Code2, Download, Play, Sparkles, Square, RotateCcw, ChevronDown, X } from 'lucide-react';

const STARTERS = {
  javascript: 'console.log("Hello from DOGE AI!");\n\nconst answer = 6 * 7;\nconsole.log("The answer is", answer);',
  python: 'print("Hello from DOGE AI!")\n\nanswer = 6 * 7\nprint("The answer is", answer)',
  html: '<!doctype html>\n<html>\n<head>\n  <meta charset="utf-8">\n  <title>My page</title>\n</head>\n<body>\n  <h1>Hello, DOGE AI!</h1>\n  <p>Edit this HTML and press Run.</p>\n</body>\n</html>'
};
const EXTENSIONS = { javascript: 'js', python: 'py', html: 'html' };

function extractCode(text) {
  const match = text.match(/```(?:javascript|js|python|py|html)?\s*([\s\S]*?)```/i);
  return (match ? match[1] : '').trim();
}

export default function CodeRunner() {
  const [open, setOpen] = useState(false);
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(STARTERS.javascript);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState('');
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [panelPosition, setPanelPosition] = useState(null);
  const dragRef = useRef(null);
  const frameRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const openRunner = () => setOpen(true);\n    window.addEventListener('doge-ai:open-code-runner', openRunner);\n    function move(event) {
      if (!dragRef.current) return;
      const { offsetX, offsetY } = dragRef.current;
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const panel = document.querySelector('.doge-editor');
      const panelWidth = panel?.offsetWidth || 760;
      const panelHeight = panel?.offsetHeight || 600;
      setPanelPosition({
        x: Math.max(12, Math.min(width - panelWidth - 12, event.clientX - offsetX)),
        y: Math.max(12, Math.min(height - panelHeight - 12, event.clientY - offsetY))
      });
    }
    function stop() { dragRef.current = null; }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);\n      window.removeEventListener('doge-ai:open-code-runner', openRunner);
    };
  }, []);

  function startDrag(event) {
    if (event.button !== 0 || event.target.closest('button')) return;
    const rect = event.currentTarget.parentElement.getBoundingClientRect();
    dragRef.current = { offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top };
    if (!panelPosition) setPanelPosition({ x: rect.left, y: rect.top });
    event.preventDefault();
  }

  function stopRun(message = 'Execution stopped.') {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    frameRef.current?.remove();
    frameRef.current = null;
    setRunning(false);
    setOutput(message);
  }

  function run() {
    stopRun('');
    setPreview('');
    setOutput('');
    setNotice('');
    if (language === 'html') {
      setPreview(code);
      return;
    }

    const id = 'doge-run-' + crypto.randomUUID();
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.display = 'none';
    frameRef.current = frame;
    const safeCode = JSON.stringify(code).replace(/</g, '\\u003c');
    const safeId = JSON.stringify(id);

    if (language === 'javascript') {
      frame.srcdoc = `
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'">
        <script>
          try {
            const logs = [];
            const show = (...args) => logs.push(args.map(value => {
              try { return typeof value === 'object' ? JSON.stringify(value) : String(value); }
              catch { return String(value); }
            }).join(' '));
            console.log = show; console.info = show; console.warn = show;
            const result = (new Function(${safeCode}))();
            const output = logs.join('\\n') + (result === undefined ? '' : ('\\n' + String(result)));
            parent.postMessage({ dogeRunner: ${safeId}, out: output || 'Finished (no output).' }, '*');
          } catch (error) {
            parent.postMessage({ dogeRunner: ${safeId}, out: String(error) }, '*');
          }
        <\\/script>
      `;
    } else {
      frame.srcdoc = `
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; connect-src https://cdn.jsdelivr.net; img-src 'none'; style-src 'unsafe-inline'">
        <script src="https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js"><\\/script>
        <script>
          (async () => {
            try {
              const pyodide = await loadPyodide();
              let logs = [];
              pyodide.setStdout({ batched: value => logs.push(value) });
              pyodide.setStderr({ batched: value => logs.push(value) });
              await pyodide.runPythonAsync(${safeCode});
              parent.postMessage({ dogeRunner: ${safeId}, out: logs.join('\\n') || 'Finished (no output).' }, '*');
            } catch (error) {
              parent.postMessage({ dogeRunner: ${safeId}, out: String(error) }, '*');
            }
          })();
        <\\/script>
      `;
    }

    const finish = event => {
      if (event.data?.dogeRunner !== id) return;
      clearTimeout(timeoutRef.current);
      window.removeEventListener('message', finish);
      frame.remove();
      frameRef.current = null;
      setOutput(event.data.out);
      setRunning(false);
    };
    window.addEventListener('message', finish);
    document.body.appendChild(frame);
    setRunning(true);
    timeoutRef.current = setTimeout(() => {
      window.removeEventListener('message', finish);
      stopRun(language === 'python' ? 'Stopped: Python startup or execution exceeded 20 seconds.' : 'Stopped: 2-second execution limit reached.');
    }, language === 'python' ? 20000 : 2000);
  }

  function changeLanguage(next) {
    stopRun('');
    setPreview('');
    setOutput('');
    setLanguage(next);
    setCode(STARTERS[next]);
  }

  function exportCode() {
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'doge-ai-code.' + EXTENSIONS[language];
    link.click();
    URL.revokeObjectURL(url);
  }

  async function askAI() {
    if (!instruction.trim() || aiBusy || !code.trim()) return;
    setAiBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: localStorage.getItem('doge-ai-model') || 'fast',
          messages: [
            { role: 'user', content: 'You are editing code in the DOGE AI editor. Make only the requested changes, preserve existing behavior and unrelated code, and do not invent APIs or claim you tested it. Return the complete updated file in exactly one fenced code block using the ' + language + ' language. If the requested change is unsafe or impossible, explain briefly instead of fabricating code.\n\nRequested change:\n' + instruction.trim() + '\n\nCurrent file:\n```' + language + '\n' + code + '\n```' }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI edit failed.');
      const answer = data.reply ?? data.response ?? data.result?.response ?? data.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('The AI returned an empty response.');
      const updated = extractCode(answer);
      if (!updated) throw new Error('The AI did not return a code block. Your original code was kept.');
      setCode(updated);
      setOutput('');
      setPreview('');
      setInstruction('');
      setNotice('AI edit applied. Review the changes before running or exporting.');
    } catch (error) {
      setNotice(error.message || 'Could not edit this code.');
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className="v2-code-runner">
      <button onClick={() => setOpen(value => !value)}><Code2 size={14}/> Code runner <ChevronDown size={12}/></button>
      {open && (
        <div className="doge-editor-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
        <div className="v2-panel doge-editor" style={panelPosition ? { left: panelPosition.x, top: panelPosition.y, transform: 'none' } : undefined}>
          <div className="doge-editor-titlebar" onPointerDown={startDrag}>
            <div className="doge-editor-window-title"><Code2 size={15}/><span>Code Runner</span><small>Drag to move</small></div>
            <button className="doge-editor-close" onClick={() => setOpen(false)} aria-label="Close Code Runner" title="Close"><X size={17}/></button>
          </div>
          <div className="doge-editor-top">
            <label>Language
              <select value={language} onChange={event => changeLanguage(event.target.value)}>
                <option value="javascript">JavaScript</option>
                <option value="python">Python (Pyodide)</option>
                <option value="html">HTML preview</option>
              </select>
            </label>
            <div className="doge-editor-actions">
              <button onClick={exportCode}><Download size={13}/> Export</button>
              <button onClick={() => { setCode(STARTERS[language]); setOutput(''); setPreview(''); setNotice(''); }}><RotateCcw size={13}/> Reset</button>
            </div>
          </div>
          <p className="v2-hint">JavaScript runs in an isolated sandbox with no automatic time limit; use Stop if it runs too long. Python runs in a sandboxed Pyodide runtime (20-second startup/execution limit). HTML opens a sandboxed preview.</p>
          <div className="doge-editor-input">
            <div className="doge-line-numbers" aria-hidden="true">{code.split('\n').map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea spellCheck="false" autoCapitalize="off" autoCorrect="off" value={code} onChange={event => setCode(event.target.value)} aria-label="Code editor" />
          </div>
          <div className="doge-editor-actions doge-run-actions">
            <button className="v2-primary" disabled={running || !code.trim()} onClick={run}><Play size={13}/>{running ? 'Running…' : 'Run'}</button>
            {running && <button onClick={() => stopRun()}><Square size={13}/> Stop</button>}
          </div>
          {preview && <div className="doge-preview-wrap"><div className="doge-output-title">HTML preview</div><iframe title="HTML preview" sandbox="allow-scripts" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:"><style>body{font:14px system-ui;padding:16px;color:#222}</style>${preview}`} /></div>}
          {output && <div className="doge-output"><div className="doge-output-title">Console output</div><pre>{output}</pre></div>}
          <div className="doge-ai-edit">
            <label htmlFor="doge-ai-edit-instruction">Ask Doge AI to edit this code</label>
            <textarea id="doge-ai-edit-instruction" rows={2} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="e.g. Add input validation and explain errors clearly…"/>
            <button disabled={aiBusy || !instruction.trim()} onClick={askAI}><Sparkles size={13}/>{aiBusy ? 'Editing…' : 'Apply AI edit'}</button>
          </div>
          {notice && <p className="doge-editor-notice">{notice}</p>}
        </div>
        </div>
      )}
    </div>
  );
}
