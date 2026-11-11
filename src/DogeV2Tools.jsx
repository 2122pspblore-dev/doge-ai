import { useState } from 'react';
import CodeRunner from './CodeRunner.jsx';
import { Globe, Image as ImageIcon, GitBranch, BookOpen, Download, BarChart3, FilePlus2, X } from 'lucide-react';

const PROMPTS = [
  'Explain this step by step in simple language',
  'Turn these notes into a study guide',
  'Review this code and identify bugs',
  'Give me a practical project plan',
  'Brainstorm ten creative ideas',
  'Summarize the key points'
];

export default function DogeV2Tools({ activeChat, messages, chats, setChats, setActiveId, setText, setError, updateChat }) {
  const [model, setModel] = useState(() => localStorage.getItem('doge-ai-model') || 'fast');
  const [memory, setMemory] = useState(() => localStorage.getItem('doge-ai-memory-v1') || '');
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [artifactOpen, setArtifactOpen] = useState(false);
  const [artifactText, setArtifactText] = useState('');
  const [artifacts, setArtifacts] = useState(() => { try { return JSON.parse(localStorage.getItem('doge-ai-artifacts-v1') || '[]'); } catch { return []; } });
  const [usage, setUsage] = useState(() => { try { return JSON.parse(localStorage.getItem('doge-ai-usage') || '{"messages":0,"searches":0,"images":0}'); } catch { return {messages:0,searches:0,images:0}; } });

  function saveUsage(key) {
    const next = { ...usage, [key]: (usage[key] || 0) + 1 };
    setUsage(next);
    localStorage.setItem('doge-ai-usage', JSON.stringify(next));
  }
  async function searchWeb() {
    const query = window.prompt('What should Doge AI search for?');
    if (!query?.trim()) return;
    setSearching(true);
    try {
      const response = await fetch('/api/search?q=' + encodeURIComponent(query.trim()));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Search failed');
      const context = (data.results || []).map((r, i) => '[' + (i + 1) + '] ' + r.title + '\n' + r.snippet + '\n' + r.url).join('\n\n');
      if (!context) throw new Error('No results were found.');
      setText('Use these web search results to answer my question: ' + query + '\n\n' + context);
      saveUsage('searches');
    } catch (e) { setError('Web search: ' + e.message); }
    finally { setSearching(false); }
  }
  async function generateImage() {
    if (!imagePrompt.trim()) return;
    setImageBusy(true);
    try {
      const response = await fetch('/api/image', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt:imagePrompt.trim()}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Image generation failed');
      updateChat(activeChat.id, c => ({...c, messages:[...c.messages, {role:'assistant', content:'Image generated from: ' + imagePrompt, image:data.image}], updatedAt:Date.now()}));
      saveUsage('images');
      setImageOpen(false); setImagePrompt('');
    } catch(e) { setError(e.message); }
    finally { setImageBusy(false); }
  }
  function branchConversation() {
    if (!activeChat) return;
    const branch = { id:Date.now().toString(36)+Math.random().toString(36).slice(2,6), title:'Branch: ' + activeChat.title, messages:[...messages], updatedAt:Date.now(), pinned:false };
    setChats(cs => [branch, ...cs]); setActiveId?.(branch.id);
  }
  function saveArtifact() {
    const content = artifactText.trim() || messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || '';
    if (!content) return;
    const next = [{id:Date.now(), title:'Artifact ' + new Date().toLocaleString(), content}, ...artifacts];
    setArtifacts(next); localStorage.setItem('doge-ai-artifacts-v1', JSON.stringify(next)); setArtifactText('');
  }
  function exportChats() {
    const blob = new Blob([JSON.stringify(chats, null, 2)], {type:'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'doge-ai-backup.json'; a.click(); URL.revokeObjectURL(a.href);
  }
  return <div className="v2-tools">
    <div className="v2-toolbar">
      <select aria-label="Model" value={model} onChange={e=>{setModel(e.target.value);localStorage.setItem('doge-ai-model',e.target.value);}}>
        <option value="fast">Fast model</option><option value="thinking">Thinking model</option>
      </select>
      <button onClick={searchWeb} disabled={searching}><Globe size={14}/>{searching?'Searching':'Web search'}</button>
      <button onClick={()=>setImageOpen(true)}><ImageIcon size={14}/>Image</button><CodeRunner/>
      <button onClick={branchConversation}><GitBranch size={14}/>Branch</button>
      <button onClick={()=>{setArtifactText(messages.filter(m=>m.role==='assistant').slice(-1)[0]?.content||'');setArtifactOpen(true)}}><FilePlus2 size={14}/>Artifact</button>
      <select className="v2-prompt-select" aria-label="Prompt library" defaultValue="" onChange={e=>{if(e.target.value)setText(e.target.value);e.target.value="";}}><option value="">Prompt library</option>{PROMPTS.map(p=><option key={p} value={p}>{p}</option>)}</select><button onClick={exportChats}><Download size={14}/>Backup</button>
      <button onClick={()=>setSearchOpen(v=>!v)}><BarChart3 size={14}/>Settings</button>
    </div>
    {searchOpen && <div className="v2-panel">
      <button className="v2-close" onClick={()=>setSearchOpen(false)}><X size={14}/></button>
      <label>Custom memory (saved only in this browser)</label>
      <textarea rows={3} value={memory} onChange={e=>{setMemory(e.target.value);localStorage.setItem('doge-ai-memory-v1',e.target.value);}} placeholder="Preferences you want Doge AI to remember. Avoid private information."/>
      <div className="v2-stats"><b><BarChart3 size={14}/> Usage on this device</b><span>{usage.messages||0} messages · {usage.searches||0} searches · {usage.images||0} images</span></div>
      <div className="v2-stats"><b><BookOpen size={14}/> Saved artifacts</b><span>{artifacts.length} saved</span></div>
      {artifacts.slice(0,5).map(a=><button className="v2-artifact" key={a.id} onClick={()=>{setArtifactText(a.content);setArtifactOpen(true)}}>{a.title}</button>)}
    </div>}
    {imageOpen && <div className="v2-overlay"><div className="v2-dialog"><button className="v2-close" onClick={()=>setImageOpen(false)}><X size={15}/></button><h3>Generate an image</h3><textarea rows={3} value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} placeholder="Describe the image..."/><button className="v2-primary" disabled={imageBusy||!imagePrompt.trim()} onClick={generateImage}>{imageBusy?'Generating…':'Generate image'}</button></div></div>}
    {artifactOpen && <div className="v2-overlay"><div className="v2-dialog"><button className="v2-close" onClick={()=>setArtifactOpen(false)}><X size={15}/></button><h3>Artifacts</h3><textarea rows={8} value={artifactText} onChange={e=>setArtifactText(e.target.value)} placeholder="Write or edit an artifact..."/><button className="v2-primary" onClick={saveArtifact}>Save artifact</button><div className="v2-artifact-list">{artifacts.map(a=><button key={a.id} onClick={()=>setArtifactText(a.content)}>{a.title}</button>)}</div></div></div>}
  </div>;
}
