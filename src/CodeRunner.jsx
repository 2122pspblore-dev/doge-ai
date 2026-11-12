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
  const [codeModel, setCodeModel] = useState(() => localStorage.getItem('doge-ai-code-model') || 'thinking');
  const [agentMode, setAgentMode] = useState('implement');
  const [projectFiles, setProjectFiles] = useState([]);
  const [patchText, setPatchText] = useState('');
  const [code, setCode] = useState(STARTERS.javascript);
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState('');
  const [instruction, setInstruction] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [panelPosition, setPanelPosition] = useState(null);
  const dragRef = useRef(null);
  const projectInput = useRef(null);
  const frameRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const openRunner = () => setOpen(true);
    window.addEventListener('doge-ai:open-code-runner', openRunner);
    function move(event) {
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
      window.removeEventListener('pointercancel', stop);
      window.removeEventListener('doge-ai:open-code-runner', openRunner);
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
    if (language === 'python') {
      timeoutRef.current = setTimeout(() => {
        window.removeEventListener('message', finish);
        stopRun('Stopped: Python startup or execution exceeded 20 seconds.');
      }, 20000);
    }
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

  async function addProjectFiles(event) {
    const selected = Array.from(event.target.files || []);
    const next = [];
    for (const file of selected) {
      if (file.size > 150 * 1024) { setNotice(file.name + ' is too large (150 KB max per context file).'); continue; }
      try { next.push({ name: file.name, content: (await file.text()).slice(0, 150000) }); }
      catch { setNotice('Could not read ' + file.name + '.'); }
    }
    setProjectFiles(current => [...current, ...next].slice(0, 8));
    event.target.value = '';
  }

  function downloadPatch() {
    if (!patchText) return;
    const blob = new Blob([patchText], { type: 'text/x-diff;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'doge-ai-code-agent.patch';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function askAI() {
    if (!instruction.trim() || aiBusy || !code.trim()) return;
    setAiBusy(true);
    setNotice('');
    setPatchText('');
    try {
      const projectContext = projectFiles.map(file => '\n\n--- Project context file: ' + file.name + ' ---\n' + file.content + '\n--- End project context file ---').join('');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: codeModel,
          messages: [
            { role: 'user', content: 'You are DOGE AI Code Agent working on the current file in the editor. Agent mode: ' + agentMode.toUpperCase() + '. Be precise, inspect the supplied code before answering, preserve unrelated behavior, and never claim you ran or tested anything. In PLAN mode, give a short ordered implementation plan without changing code. In EXPLAIN mode, explain how the current code works and point out important assumptions. In DEBUG mode, identify likely bugs and their causes; include a corrected full file only if a concrete fix is clear. In IMPLEMENT mode, make only the requested changes to the current editor file and return the complete updated file in exactly one fenced code block using the ' + language + ' language. In PATCH mode, create a valid unified diff for every file that needs changes, use the supplied file names in diff headers, and return only the diff without Markdown fences. Treat project context files as read-only evidence unless producing a patch. Do not invent APIs. If the request is unsafe or impossible, explain briefly.\n\nRequest:\n' + instruction.trim() + '\n\nCurrent editor file:\n```' + language + '\n' + code + '\n```' + projectContext }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI edit failed.');
      const answer = data.reply ?? data.response ?? data.result?.response ?? data.choices?.[0]?.message?.content;
      if (typeof answer !== 'string' || !answer.trim()) throw new Error('The AI returned an empty response.');
      if (agentMode === 'patch') {
        if (!answer.includes('diff --git') && !answer.includes('--- a/')) throw new Error('The Code Agent did not return a unified diff. Your files were not changed.');
        setPatchText(answer);
        setOutput(answer);
        setNotice('Patch generated. Download it and review it before applying it to your project.');
        setInstruction('');
        return;
      }
      if (agentMode !== 'implement') {
        const suggestedCode = extractCode(answer);
        if (suggestedCode && agentMode === 'debug') {
          setCode(suggestedCode);
          setNotice('A suggested debug fix was applied to the editor. Review it before running.');
        } else {
          setNotice(answer);
        }
        setInstruction('');
        return;
      }
      const updated = extractCode(answer);
      if (!updated) throw new Error('The AI did not return a code block. Your original code was kept.');
      setCode(updated);
      setOutput('');
      setPreview('');
      setInstruction('');
      setNotice('Code Agent applied an edit. Review the changes before running or exporting.');
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
            <label>AI model for code edits
              <select value={codeModel} onChange={event => { setCodeModel(event.target.value); localStorage.setItem('doge-ai-code-model', event.target.value); }}>
                <option value="fast">Fast model</option>
                <option value="thinking">Thinking model</option>
              </select>
            </label>
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
            <label htmlFor="doge-ai-edit-instruction">DOGE AI Code Agent</label>
            <div className="doge-agent-files"><button type="button" onClick={() => projectInput.current?.click()}>Add project context files ({projectFiles.length}/8)</button><input ref={projectInput} type="file" multiple hidden onChange={addProjectFiles} />{projectFiles.map((file,index)=><span key={file.name+index}>{file.name}<button type="button" onClick={() => setProjectFiles(files => files.filter((_,i)=>i!==index))}>×</button></span>)}</div>
            <select value={agentMode} onChange={event => setAgentMode(event.target.value)}><option value="plan">Plan changes</option><option value="explain">Explain code</option><option value="debug">Debug code</option><option value="implement">Implement current file</option><option value="patch">Generate project patch</option></select>
            <textarea id="doge-ai-edit-instruction" rows={2} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="e.g. Add input validation and explain errors clearly…"/>
            <button disabled={aiBusy || !instruction.trim()} onClick={askAI}><Sparkles size={13}/>{aiBusy ? 'Working…' : agentMode === 'implement' ? 'Apply code changes' : agentMode === 'patch' ? 'Generate patch' : 'Ask Code Agent'}</button>
          </div>
          {patchText && <button className="doge-editor-patch-download" onClick={downloadPatch}><Download size={13}/> Download project patch</button>}
          {notice && <p className="doge-editor-notice">{notice}</p>}
        </div>
        </div>
      )}
    </div>
  );
}
