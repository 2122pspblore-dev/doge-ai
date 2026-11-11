import { useState } from 'react';

export default function CodeRunner() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('console.log(2 + 2);');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);

  function run() {
    const id = 'doge-run-' + Math.random().toString(36).slice(2);
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.display = 'none';

    // Serialize user code and the run ID before embedding them in the isolated frame.
    const safeCode = JSON.stringify(code).replace(/</g, '\\u003c');
    const safeId = JSON.stringify(id);
    frame.srcdoc = `
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; connect-src 'none'; img-src 'none'; style-src 'none'">
      <script>
        try {
          const logs = [];
          console.log = (...args) => logs.push(args.map(value => String(value)).join(' '));
          const result = (new Function(${safeCode}))();
          const output = logs.join('\\n') + (result === undefined ? '' : ('\\n' + String(result)));
          parent.postMessage({ dogeRunner: ${safeId}, out: output || 'Finished' }, '*');
        } catch (error) {
          parent.postMessage({ dogeRunner: ${safeId}, out: String(error) }, '*');
        }
      <\\/script>
    `;

    let timer;
    const finish = event => {
      if (event.data?.dogeRunner === id) {
        clearTimeout(timer);
        setOutput(event.data.out);
        setRunning(false);
        window.removeEventListener('message', finish);
        frame.remove();
      }
    };

    window.addEventListener('message', finish);
    document.body.appendChild(frame);
    setRunning(true);
    timer = setTimeout(() => {
      window.removeEventListener('message', finish);
      frame.remove();
      setRunning(false);
      setOutput('Stopped: 2-second execution limit reached.');
    }, 2000);
  }

  return (
    <div className="v2-code-runner">
      <button onClick={() => setOpen(value => !value)}>▶ Code runner</button>
      {open && (
        <div className="v2-panel">
          <p className="v2-hint">JavaScript runs in a sandboxed frame with network access blocked and a 2-second limit.</p>
          <textarea rows={7} value={code} onChange={event => setCode(event.target.value)} />
          <button className="v2-primary" disabled={running} onClick={run}>{running ? 'Running…' : 'Run code'}</button>
          {output && <pre className="v2-run-output">{output}</pre>}
        </div>
      )}
    </div>
  );
}
