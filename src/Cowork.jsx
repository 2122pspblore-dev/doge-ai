/* Copyright (c) 2026 2122pspblore-dev. All rights reserved. */
import { useState } from 'react';
import { Bot, Check, ChevronDown, ExternalLink, LoaderCircle, Play, Search, X } from 'lucide-react';

const LABELS = {
  search_web: 'Search the web',
  open_code_runner: 'Open Code Runner',
  open_groups: 'Open Groups',
  set_theme_dark: 'Switch to dark theme',
  set_theme_light: 'Switch to light theme',
  set_theme_system: 'Use system theme'
};

export default function Cowork({ username = '' }) {
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState('');
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState(null);
  const [done, setDone] = useState([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const [sites, setSites] = useState([]);

  async function createPlan(event) {
    event.preventDefault();
    if (!task.trim() || busy) return;
    setBusy(true); setError(''); setPlan(null); setDone([]); setSites([]);
    try {
      const response = await fetch('/api/cowork', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: task.trim(), username })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Cowork could not plan this task.');
      setPlan(data);
    } catch (e) { setError(e.message || 'Cowork failed.'); }
    finally { setBusy(false); }
  }

  async function runStep(step, index) {
    setActive(index); setError('');
    try {
      if (step.action === 'search_web') {
        const query = task.trim();
        const response = await fetch('/api/search?q=' + encodeURIComponent(query));
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Search failed.');
        setSites(data.results || []);
        if (!data.results?.length) throw new Error('No sites were found for this search.');
      } else {
        window.dispatchEvent(new CustomEvent('doge-ai:action', { detail: { action: step.action } }));
      }
      setDone(current => [...current, index]);
    } catch (e) { setError(e.message || 'That action failed.'); }
    finally { setActive(-1); }
  }

  return <section className="cowork-wrap">
    <button className="cowork-launch" onClick={() => setOpen(v => !v)}><Bot size={14}/> Cowork <ChevronDown size={12}/></button>
    {open && <div className="cowork-panel">
      <div className="cowork-head"><div><b>DOGE AI Cowork</b><small>Plan tasks and control approved app features</small></div><button onClick={() => setOpen(false)} aria-label="Close Cowork"><X size={16}/></button></div>
      <form className="cowork-form" onSubmit={createPlan}>
        <textarea rows={2} value={task} onChange={e => setTask(e.target.value)} placeholder="What should Cowork do? e.g. Open Code Runner and switch to dark theme"/>
        <button disabled={busy || !task.trim()}>{busy ? <LoaderCircle size={14} className="cowork-spin"/> : <Bot size={14}/>} {busy ? 'Planning…' : 'Make a plan'}</button>
      </form>
      {error && <p className="cowork-error">{error}</p>}
      {plan && <div className="cowork-plan"><p>{plan.summary}</p>
        {!plan.steps.length && <small>No app actions are needed for this task.</small>}
        {plan.steps.map((step, index) => <div className="cowork-step" key={index}><div><b>{index + 1}. {LABELS[step.action] || step.action}</b><small>{step.reason}</small></div><button disabled={active !== -1 || done.includes(index)} onClick={() => runStep(step, index)}>{active === index ? <LoaderCircle size={13} className="cowork-spin"/> : done.includes(index) ? <Check size={13}/> : <Play size={13}/>} {done.includes(index) ? 'Done' : 'Run'}</button></div>)}
      </div>}
      {sites.length > 0 && <div className="cowork-sites"><b><Search size={13}/> Sites actually found</b>{sites.map((site, i) => <a key={site.url || i} href={site.url} target="_blank" rel="noreferrer"><span>{site.title}</span><small>{new URL(site.url).hostname}</small><ExternalLink size={12}/></a>)}</div>}
      <small className="cowork-foot">Actions are limited to DOGE AI features. Review each step before running it.</small>
    </div>}
  </section>;
}
