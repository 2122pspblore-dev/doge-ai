import { useEffect, useMemo, useRef, useState } from 'react';
import DogeV2Tools from './DogeV2Tools.jsx';
import GroupChats from './GroupChats.jsx';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ArrowUp, Plus, PanelLeft, Sparkles, Settings2, MessageSquare, Mic, MicOff, Paperclip, Volume2, VolumeX, X, Copy, Check, FileText, Share2, Trash2, Search, Pencil, RefreshCw, Pin, PinOff, Send, Square } from 'lucide-react';

const HISTORY_KEY='doge-ai-conversations-v2';
const SHARE_URL='https://dog1e.vercel.app/';
const MAX_FILE_SIZE=500*1024, MAX_FILES=3;
const ALLOWED_EXTENSIONS=new Set(['txt','md','csv','json','js','jsx','ts','tsx','py','html','css','xml','yaml','yml','log','sql','sh','toml','ini']);
const starters=['Explain something complicated simply','Help me brainstorm ideas','Write or improve something'];
const makeChat=()=>({id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),title:'New chat',messages:[],updatedAt:Date.now(),pinned:false});
function readChats(){
 try{
  const v=JSON.parse(localStorage.getItem(HISTORY_KEY)||'null');
  if(Array.isArray(v))return v;
  const old=JSON.parse(localStorage.getItem('doge-ai-chats')||'[]');
  if(Array.isArray(old)&&old.length)return old.map(c=>({id:String(c.id),title:c.title||'Previous chat',messages:c.messages||[],updatedAt:c.updatedAt||Date.now(),pinned:false}));
  const current=JSON.parse(localStorage.getItem('doge-ai-current')||'[]');
  return Array.isArray(current)&&current.length?[{...makeChat(),title:'Previous conversation',messages:current}]:[];
 }catch{return [];}
}
function CodeBlock({children}){
 const [copied,setCopied]=useState(false);const node=Array.isArray(children)?children[0]:children;
 const language=(node?.props?.className||'').match(/language-([\w-]+)/)?.[1]||'code';
 const code=String(node?.props?.children??'');
 async function copy(){try{await navigator.clipboard.writeText(code);setCopied(true);setTimeout(()=>setCopied(false),1400)}catch{}}
 return <div className="code-block"><div className="code-header"><span>{language}</span><button onClick={copy}>{copied?<Check size={13}/>:<Copy size={13}/>} {copied?'Copied':'Copy'}</button></div><pre>{children}</pre></div>;
}
function AssistantContent({content}){return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{pre:({children})=><CodeBlock>{children}</CodeBlock>,code:({className,children,...props})=><code className={className||'inline-code'} {...props}>{children}</code>}}>{content}</ReactMarkdown>}

export default function App(){
 const [chats,setChats]=useState(()=>{const saved=readChats();return saved.length?saved:[makeChat()]});
 const [activeId,setActiveId]=useState(()=>readChats()[0]?.id||null);
 const [text,setText]=useState(''),[sidebar,setSidebar]=useState(true),[advanced,setAdvanced]=useState(false);
 const [busy,setBusy]=useState(false),[thinkingLabel,setThinkingLabel]=useState('Doge AI is thinking…'),[error,setError]=useState('');
 const [files,setFiles]=useState([]),[speakingId,setSpeakingId]=useState(null),[listening,setListening]=useState(false);
 const [search,setSearch]=useState(''),[settingsOpen,setSettingsOpen]=useState(false),[personality,setPersonality]=useState(()=>localStorage.getItem('doge-ai-personality')||'Friendly');
 const [shareCopied,setShareCopied]=useState(false),[editingIndex,setEditingIndex]=useState(null),[draftEdit,setDraftEdit]=useState('');
 const [streamingId,setStreamingId]=useState(null);
 const [deviceProfile,setDeviceProfile]=useState(()=>{try{return JSON.parse(localStorage.getItem('doge-ai-profile-v1')||'null')}catch{return null}});
 useEffect(()=>{const syncProfile=()=>{try{setDeviceProfile(JSON.parse(localStorage.getItem('doge-ai-profile-v1')||'null'))}catch{setDeviceProfile(null)}};window.addEventListener('doge-ai-profile-updated',syncProfile);return()=>window.removeEventListener('doge-ai-profile-updated',syncProfile)},[]);
 const fileInput=useRef(null),scrollRef=useRef(null),recognitionRef=useRef(null),abortRef=useRef(null),textareaRef=useRef(null);
 const activeChat=chats.find(c=>c.id===activeId)||chats[0],messages=activeChat?.messages||[];
 useEffect(()=>{try{localStorage.setItem(HISTORY_KEY,JSON.stringify(chats));}catch{setError('Chat history storage is full. Delete older chats to free space.')}},[chats]);
 useEffect(()=>{if(!activeId&&chats[0])setActiveId(chats[0].id)},[activeId,chats]);
 useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
 useEffect(()=>()=>{window.speechSynthesis?.cancel();recognitionRef.current?.stop?.();abortRef.current?.abort?.()},[]);
 useEffect(()=>{
  const onKey=(e)=>{
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.querySelector('.chat-search')?.focus()}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='n'){e.preventDefault();createChat()}
   if(e.key==='Escape'){setSettingsOpen(false);setEditingIndex(null);if(busy)abortRef.current?.abort()}
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[busy,chats]);
 const visibleChats=useMemo(()=>[...chats].filter(c=>c.title.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.updatedAt-a.updatedAt),[chats,search]);
 function updateChat(id,fn){setChats(cs=>cs.map(c=>c.id===id?fn(c):c))}
 function createChat(){const c=makeChat();setChats(cs=>[c,...cs]);setActiveId(c.id);setText('');setFiles([]);setError('');setEditingIndex(null);setSidebar(true)}
 function openChat(id){setActiveId(id);setText('');setFiles([]);setError('');setEditingIndex(null);if(window.innerWidth<700)setSidebar(false)}
 function deleteChat(id){if(!window.confirm('Delete this conversation? This cannot be undone.'))return;const next=chats.filter(c=>c.id!==id);if(!next.length){const fresh=makeChat();setChats([fresh]);setActiveId(fresh.id)}else{setChats(next);if(activeId===id)setActiveId(next[0].id)}}
 function togglePin(id){updateChat(id,c=>({...c,pinned:!c.pinned}))}
 async function addFiles(list){const incoming=Array.from(list||[]),next=[];for(const f of incoming){const ext=f.name.split('.').pop().toLowerCase();if(!ALLOWED_EXTENSIONS.has(ext)){setError(f.name+': unsupported file type.');continue}if(f.size>MAX_FILE_SIZE){setError(f.name+': file exceeds 500 KB.');continue}try{next.push({name:f.name,content:await f.text()})}catch{setError('Could not read '+f.name+'.')}}setFiles(cur=>[...cur,...next].slice(0,MAX_FILES));if(fileInput.current)fileInput.current.value=''}
 function startVoiceInput(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){setError('Voice typing is not supported here. Try Chrome or Edge.');return}if(listening){recognitionRef.current?.stop();setListening(false);return}const r=new SR();r.lang=navigator.language||'en-US';r.continuous=true;r.interimResults=true;r.onresult=e=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)if(e.results[i].isFinal)t+=e.results[i][0].transcript+' ';if(t)setText(v=>(v?v+' ':'')+t.trim())};r.onerror=e=>{setListening(false);if(e.error!=='no-speech'&&e.error!=='aborted')setError('Microphone issue: '+e.error)};r.onend=()=>setListening(false);recognitionRef.current=r;try{r.start();setListening(true);setError('')}catch{setError('Could not start voice typing.')}}
 async function share(){try{await navigator.clipboard.writeText(SHARE_URL);setShareCopied(true);setTimeout(()=>setShareCopied(false),1600)}catch{setError('Copy this link: '+SHARE_URL)}}
 function speak(content,id){if(!window.speechSynthesis)return;if(speakingId===id){window.speechSynthesis.cancel();setSpeakingId(null);return}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(content);u.onend=()=>setSpeakingId(null);u.onerror=()=>setSpeakingId(null);setSpeakingId(id);window.speechSynthesis.speak(u)}
 async function streamReply(history,chatId){
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
   const controller=new AbortController();abortRef.current=controller;
   try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,advanced,personality,model:localStorage.getItem('doge-ai-model')||'fast',memory:localStorage.getItem('doge-ai-memory-v1')||'',stream:true}),signal:controller.signal});
    if(!res.ok){const p=await res.json().catch(()=>({}));const er=new Error(p.error||'Request failed');er.status=res.status;throw er}
    if(!res.body)throw new Error('Streaming is unavailable.');
    const reader=res.body.getReader(),decoder=new TextDecoder();let buffer='',answer='',received=false;
    setStreamingId(chatId+':'+history.length);
    const append=chunk=>{if(!chunk)return;answer+=chunk;received=true;updateChat(chatId,c=>({...c,messages:[...c.messages.slice(0,-1),{role:'assistant',content:answer,streaming:true}],updatedAt:Date.now()}))};
    while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split('\n');buffer=lines.pop()||'';for(const line of lines){const s=line.trim();if(!s||s.startsWith(':'))continue;const raw=s.startsWith('data:')?s.slice(5).trim():s; if(raw==='[DONE]')continue;try{const j=JSON.parse(raw);if(j.error)throw new Error(j.error);append(j.response??j.reply??j.choices?.[0]?.delta?.content??'')}catch(e){if(e instanceof SyntaxError)append(raw);else throw e}}}
    if(!received)throw new Error('The AI returned an empty answer.');
    updateChat(chatId,c=>({...c,messages:c.messages.map((m,i)=>i===c.messages.length-1?{...m,streaming:false}:m)}));return;
   }catch(e){lastError=e;if(e.name==='AbortError')throw e;if(e.status&&e.status<500&&e.status!==429)break;if(attempt<2){setThinkingLabel('Connection interrupted — retrying ('+(attempt+2)+'/3)…');await new Promise(r=>setTimeout(r,350*(attempt+1)))}}
  }
  throw lastError||new Error('Doge AI could not generate an answer.');
 }
 async function send(value=text,overrideMessages=null){
  const clean=value.trim();if((!clean&&!files.length)||busy||!activeChat)return;
  const attached=[...files],prompt=clean+attached.map(f=>'\n\n--- Attached file: '+f.name+' ---\n'+f.content+'\n--- End of '+f.name+' ---').join('');
  const user={role:'user',content:prompt,displayContent:clean,attachments:attached.map(f=>f.name)};
  const history=overrideMessages||[...messages,user],chatId=activeChat.id;
  updateChat(chatId,c=>({...c,title:c.messages.length?c.title:(clean.slice(0,42)||attached[0]?.name||'New chat'),messages:[...history,{role:'assistant',content:'',streaming:true}],updatedAt:Date.now()}));
  setText('');setFiles([]);setError('');setBusy(true);setThinkingLabel('Doge AI is thinking…');
  try{await streamReply(history,chatId)}catch(e){if(e.name!=='AbortError')setError((e.message||'Could not reach Doge AI.')+' You can retry the answer.');updateChat(chatId,c=>({...c,messages:c.messages.filter(m=>!(m.role==='assistant'&&m.streaming&&!m.content)).map(m=>m.streaming?{...m,streaming:false}:m)}))}
  finally{setBusy(false);setStreamingId(null);setThinkingLabel('Doge AI is thinking…')}
 }
 function regenerate(index){if(busy)return;const history=messages.slice(0,index);if(!history.length)return;const lastUser=[...history].reverse().find(m=>m.role==='user');if(!lastUser)return;updateChat(activeId,c=>({...c,messages:history}));send(lastUser.displayContent||lastUser.content,history)}
 function beginEdit(index){const m=messages[index];setEditingIndex(index);setDraftEdit(m.displayContent||m.content||'')}
 function saveEdit(index){const clean=draftEdit.trim();if(!clean)return;const history=messages.slice(0,index);history.push({role:'user',content:clean,displayContent:clean});setEditingIndex(null);updateChat(activeId,c=>({...c,messages:history}));send(clean,history)}
 return <div className="app">
  {sidebar&&<><div className="mobile-scrim" onClick={()=>setSidebar(false)}></div><aside className="sidebar"><div className="brand"><div className="logo">d</div><div className="brand-text"><span>Doge AI</span><small>Advik Kumar</small></div><button className="mobile-close" onClick={()=>setSidebar(false)}><X size={16}/></button></div><button className="new-chat" onClick={createChat}><Plus size={16}/> New chat <kbd>Ctrl N</kbd></button><div className="search-wrap"><Search size={14}/><input className="chat-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chats…"/><kbd>Ctrl K</kbd></div><div className="side-label history-label">YOUR CHATS</div><div className="history-list">{visibleChats.map(c=><div className={'history-row '+(c.id===activeId?'active':'')} key={c.id}><button className="history-open" onClick={()=>openChat(c.id)}><MessageSquare size={14}/><span>{c.title}</span></button><button className="history-pin" onClick={()=>togglePin(c.id)} title={c.pinned?'Unpin chat':'Pin chat'}>{c.pinned?<Pin size={13}/>:<PinOff size={13}/>}</button><button className="history-delete" onClick={()=>deleteChat(c.id)} title="Delete chat"><Trash2 size={13}/></button></div>)}</div><div className="side-bottom"><button className="side-item" onClick={()=>setAdvanced(v=>!v)}><Sparkles size={16}/> Advanced mode <span className="toggle">{advanced?'ON':'OFF'}</span></button><button className="side-item" onClick={()=>setSettingsOpen(true)}><Settings2 size={16}/> Settings</button><button className="side-item" onClick={share}><Share2 size={16}/> {shareCopied?'Link copied':'Share Doge AI'}</button><div className="profile"><div className="avatar">{(deviceProfile?.username||'D').slice(0,1).toUpperCase()}</div><div><b>{deviceProfile?.username||'Choose a user'}</b><small>{deviceProfile?'Saved on this device':'Create a profile in Groups'}</small></div></div></div></aside></>}
  <main className="main"><header><button className="icon-btn" onClick={()=>setSidebar(v=>!v)} title="Toggle sidebar"><PanelLeft size={18}/></button><div className="model">Doge <span>AI</span></div><button className="share-top" onClick={share}>{shareCopied?<Check size={14}/>:<Share2 size={14}/>} <span>{shareCopied?'Copied':'Share'}</span></button><button className="mode" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Advanced':'Standard'} <span className="dot"/></button></header>
   <section ref={scrollRef} className={'conversation '+(messages.length?'has-messages':'')}>{!messages.length?<div className="welcome"><div className="big-logo">d</div><h1>What can I help with?</h1><p>Ask anything. Keep it simple.</p><div className="starter-grid">{starters.map(s=><button key={s} onClick={()=>send(s)}>{s}<span>↗</span></button>)}</div></div>:<div className="messages">{messages.map((m,i)=><div className={'message '+m.role} key={i}>{m.role==='assistant'&&<div className="mini-logo">d</div>}<div className="message-body">{m.role==='assistant'?<><div className="message-actions"><button className="tool" onClick={()=>speak(m.content,i)}>{speakingId===i?<VolumeX size={14}/>:<Volume2 size={14}/>}<span>{speakingId===i?'Stop':'Read aloud'}</span></button><button className="tool" onClick={()=>navigator.clipboard?.writeText(m.content)}><Copy size={14}/><span>Copy</span></button>{i===messages.length-1&&!busy&&<button className="tool" onClick={()=>regenerate(i)}><RefreshCw size={14}/><span>Regenerate</span></button>}</div><div className="bubble"><AssistantContent content={m.content||''}/>{m.image&&<img className="generated-image" src={m.image} alt="Image generated by Doge AI"/>}{m.streaming&&<span className="stream-cursor">▋</span>}</div></>:<>{editingIndex===i?<div className="edit-box"><textarea value={draftEdit} onChange={e=>setDraftEdit(e.target.value)}/><div><button onClick={()=>setEditingIndex(null)}>Cancel</button><button onClick={()=>saveEdit(i)}><Send size={13}/> Save & submit</button></div></div>:<><div className="bubble"><div>{m.displayContent||m.content}</div>{m.attachments?.length>0&&<div className="message-attachments">{m.attachments.map(n=><span className="file-chip" key={n}><FileText size={13}/>{n}</span>)}</div>}</div><div className="message-actions"><button className="tool" onClick={()=>beginEdit(i)}><Pencil size={13}/><span>Edit</span></button></div></>}</>}</div></div>)}</div>}{busy&&<div className="thinking-indicator"><div className="mini-logo">d</div><div className="thinking-content"><span>{thinkingLabel}</span><div className="thinking-dots"><i/><i/><i/></div></div><button className="tool" onClick={()=>abortRef.current?.abort()} title="Stop generating"><Square size={13}/></button></div>}</section>
   <DogeV2Tools activeChat={activeChat} messages={messages} chats={chats} setChats={setChats} setActiveId={setActiveId} setText={setText} setError={setError} updateChat={updateChat}/>
   <GroupChats/>
   <div className="composer-wrap"><div className="composer">{files.length>0&&<div className="pending-files">{files.map((f,i)=><div className="pending-file" key={f.name+i}><FileText size={14}/><span>{f.name}</span><button onClick={()=>setFiles(v=>v.filter((_,j)=>j!==i))}><X size={13}/></button></div>)}</div>}<textarea ref={textareaRef} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={busy?'Doge AI is responding…':'Message Doge AI…'} rows={1}/><div className="composer-tools"><div><input ref={fileInput} className="file-input" type="file" multiple accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.toml,.ini" onChange={e=>addFiles(e.target.files)}/><button className="tool" title="Attach file" onClick={()=>fileInput.current?.click()}><Paperclip size={17}/></button><button className={'tool voice-input '+(listening?'listening':'')} title="Voice typing" onClick={startVoiceInput}>{listening?<MicOff size={17}/>:<Mic size={17}/>}</button></div><button className="send" onClick={()=>send()} disabled={(!text.trim()&&!files.length)||busy}><ArrowUp size={18}/></button></div></div>{error&&<div className="error">{error}</div>}<div className="disclaimer">Doge AI can make mistakes. Check important information. · Enter to send · Shift+Enter for new line</div></div>
  </main>
  {settingsOpen&&<div className="modal-backdrop" onClick={()=>setSettingsOpen(false)}><div className="settings-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><h2>Settings</h2><button onClick={()=>setSettingsOpen(false)}><X size={17}/></button></div><label>Response style<select value={personality} onChange={e=>{setPersonality(e.target.value);localStorage.setItem('doge-ai-personality',e.target.value)}}><option>Friendly</option><option>Concise</option><option>Detailed</option><option>Professional</option></select></label><p>Choose how Doge AI writes its answers. This is saved on this device.</p><button className="modal-done" onClick={()=>setSettingsOpen(false)}>Done</button></div></div>}
 </div>
}
