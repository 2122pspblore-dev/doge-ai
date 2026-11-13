/* Copyright (c) 2026 2122pspblore-dev. All rights reserved. */
import { useCallback, useEffect, useState } from 'react';
import { Users, Plus, Send, UserPlus, X, MessageCircle, Crown, RefreshCw, Bot } from 'lucide-react';

const DEVICE_KEY = 'doge-ai-device-id-v1';
function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(DEVICE_KEY, id); }
  return id;
}
export default function GroupChats() {
  const [deviceId] = useState(getDeviceId);
  const [user, setUser] = useState(null);
  const [username, setUsername] = useState('');
  const [loadingUser, setLoadingUser] = useState(true);
  const [error, setError] = useState('');
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  const api = useCallback(async (path, options={}) => {
    const response = await fetch(path, { ...options, headers: { 'Content-Type':'application/json', 'X-Doge-Device':deviceId, ...(options.headers||{}) } });
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [deviceId]);

  const loadGroups = useCallback(async () => {
    if (!user) return;
    try { const data = await api('/api/groups'); setGroups(data.groups || []); }
    catch(e) { setError(e.message); }
  }, [api,user]);

  const loadRoom = useCallback(async (id) => {
    if (!id) return;
    try {
      const [m,g] = await Promise.all([api('/api/groups/'+id+'/messages'),api('/api/groups/'+id+'/members')]);
      setMessages(m.messages || []); setMembers(g.members || []);
    } catch(e) { setError(e.message); }
  }, [api]);

  useEffect(() => {
    api('/api/users/me').then(data=>setUser(data.user)).catch(e=>setError(e.message)).finally(()=>setLoadingUser(false));
  }, [api]);
  useEffect(() => { if(user) loadGroups(); }, [user,loadGroups]);
  useEffect(() => { const handler=()=>setOpen(true); window.addEventListener('doge-ai:open-groups',handler); return ()=>window.removeEventListener('doge-ai:open-groups',handler); }, []);
  useEffect(() => {
    if (!selected) return;
    loadRoom(selected.id);
    const timer = setInterval(()=>loadRoom(selected.id), 2500);
    return ()=>clearInterval(timer);
  }, [selected,loadRoom]);

  async function register(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { const data=await api('/api/users/register',{method:'POST',body:JSON.stringify({username})}); setUser(data.user); localStorage.setItem('doge-ai-profile-v1',JSON.stringify(data.user)); window.dispatchEvent(new Event('doge-ai-profile-updated')); }
    catch(e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function createGroup() {
    const name=window.prompt('Name your group conversation:');
    if(!name?.trim()) return;
    try { const data=await api('/api/groups',{method:'POST',body:JSON.stringify({name})}); await loadGroups(); setSelected(data.group); setOpen(true); }
    catch(e) { setError(e.message); }
  }
  async function invite() {
    const name=window.prompt('Enter the exact username of the person to add:');
    if(!name?.trim()||!selected) return;
    try { await api('/api/groups/'+selected.id+'/members',{method:'POST',body:JSON.stringify({username:name})}); await loadRoom(selected.id); setError(''); }
    catch(e) { setError(e.message); }
  }
  async function askAI() {
    if (!selected || aiBusy || !messages.length) return;
    setAiBusy(true); setError('');
    try { await api('/api/groups/'+selected.id+'/ai',{method:'POST',body:JSON.stringify({})}); await loadRoom(selected.id); }
    catch(e) { setError(e.message); }
    finally { setAiBusy(false); }
  }

  async function send(e) {
    e.preventDefault(); if(!draft.trim()||!selected) return;
    const content=draft.trim(); setDraft('');
    try { await api('/api/groups/'+selected.id+'/messages',{method:'POST',body:JSON.stringify({content})}); await loadRoom(selected.id); }
    catch(e) { setDraft(content); setError(e.message); }
  }

  if (loadingUser) return null;
  return <>
    {!user && <div className="gc-gate"><form className="gc-gate-card" onSubmit={register}><div className="gc-mark">d</div><h1>Welcome to DOGE AI</h1><p>Create your device's user profile to start chatting and join group conversations.</p><label>Your username</label><input value={username} onChange={e=>setUsername(e.target.value)} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]{3,20}" placeholder="e.g. DogeFan123" required autoFocus/><small>3–20 letters, numbers, or underscores. One profile per device.</small>{error&&<div className="gc-error">{error}</div>}<button disabled={busy}>{busy?'Creating profile…':'Continue'}</button></form></div>}
    {user && <section className="gc-wrap">
      <button className="gc-launch" onClick={()=>setOpen(v=>!v)}><UserPlus size={14}/> Invite people <span>{groups.length}</span></button>
      {open && <div className="gc-panel">
        <div className="gc-head"><div><b>DOGE AI Cowork</b><small>Shared AI conversations · up to 20 people · @{user.username}</small></div><div><button title="New group" onClick={createGroup}><Plus size={16}/></button><button title="Refresh" onClick={loadGroups}><RefreshCw size={14}/></button><button title="Close" onClick={()=>setOpen(false)}><X size={16}/></button></div></div>
        <div className="gc-content">
          <aside className="gc-list">{groups.length===0&&<p className="gc-empty">No groups yet. Create one to start chatting.</p>}{groups.map(g=><button className={selected?.id===g.id?'active':''} key={g.id} onClick={()=>setSelected(g)}><MessageCircle size={14}/><span>{g.name}</span><small>{g.member_count}</small></button>)}</aside>
          <div className="gc-room">
            {!selected?<div className="gc-empty gc-center">Choose a group or create a new one.</div>:<>
              <div className="gc-room-head"><div><b>{selected.name}</b><small>{members.length} members · {members.map(m=>'@'+m.username).join(', ')}</small></div>{selected.owner_id===deviceId&&<button onClick={invite}><UserPlus size={14}/> Add people</button>}</div>
              <div className="gc-messages">{messages.map(m=><div className={'gc-message '+(m.sender_id===deviceId?'mine':m.sender_id==='DOGE_AI'?'gc-ai':'')} key={m.id}><b>{m.sender_id===deviceId?'You':m.sender_id==='DOGE_AI'?'DOGE AI':'@'+m.username}</b><p>{m.content}</p></div>)}</div>
              <div className="gc-room-actions"><button type="button" onClick={askAI} disabled={aiBusy||!messages.length}><Bot size={14}/>{aiBusy?'DOGE AI is thinking…':'Ask DOGE AI'}</button></div>
              <form className="gc-compose" onSubmit={send}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Message this group…" maxLength={5000}/><button disabled={!draft.trim()}><Send size={15}/></button></form>
            </>}
          </div>
        </div>
        {error&&<div className="gc-error gc-notice">{error}<button onClick={()=>setError('')}><X size={12}/></button></div>}
      </div>}
    </section>}
  </>;
}
