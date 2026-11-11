import { useState } from 'react';

export default function CodeRunner() {
  const [open,setOpen]=useState(false);
  const [code,setCode]=useState('console.log(2 + 2);');
  const [output,setOutput]=useState('');
  const [running,setRunning]=useState(false);
  function run() {
    const id='doge-run-'+Math.random().toString(36).slice(2);
    const frame=document.createElement('iframe');
    frame.setAttribute('sandbox','allow-scripts');
    frame.style.display='none';
    const payload=JSON.stringify(code).replace(/</g,'\\u003c');
    frame.srcdoc='<meta http-equiv="Content-Security-Policy" content="default-src \\'none\\'; script-src \\'unsafe-inline\\' \\'unsafe-eval\\'; connect-src \\'none\\'; img-src \\'none\\'; style-src \\'none\\'"><script>try{const logs=[];console.log=(...a)=>logs.push(a.map(x=>String(x)).join(" "));const result=(new Function('+payload+'))();parent.postMessage({dogeRunner:'+JSON.stringify(id)+',out:logs.join("\\n")+(result===undefined?"":("\\n"+String(result)))||"Finished"},"*")}catch(e){parent.postMessage({dogeRunner:'+JSON.stringify(id)+',out:String(e)},"*")}<\\/script>';
    const finish=e=>{if(e.data?.dogeRunner===id){setOutput(e.data.out);setRunning(false);window.removeEventListener('message',finish);frame.remove();}};
    window.addEventListener('message',finish);
    document.body.appendChild(frame);
    setRunning(true);
    setTimeout(()=>{window.removeEventListener('message',finish);frame.remove();setRunning(false);setOutput('Stopped: 2-second execution limit reached.');},2000);
  }
  return <div className="v2-code-runner">
    <button onClick={()=>setOpen(v=>!v)}>▶ Code runner</button>
    {open&&<div className="v2-panel"><p className="v2-hint">JavaScript runs in a sandboxed frame with network access blocked and a 2-second limit.</p><textarea rows={7} value={code} onChange={e=>setCode(e.target.value)}/><button className="v2-primary" disabled={running} onClick={run}>{running?'Running…':'Run code'}</button>{output&&<pre className="v2-run-output">{output}</pre>}</div>}
  </div>;
}
