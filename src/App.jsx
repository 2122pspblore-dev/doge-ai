import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ArrowUp, Plus, PanelLeft, Sparkles, Settings2, MessageSquare, Mic, MicOff, Paperclip, Volume2, VolumeX, X, Copy, Check, FileText, Share2, Trash2 } from 'lucide-react';

const starters = ['Explain something complicated simply','Help me brainstorm ideas','Write or improve something'];
const MAX_FILE_SIZE = 40 * 1024;
const MAX_FILES = 3;
const HISTORY_KEY = 'doge-ai-conversations-v1';
const SHARE_URL = 'https://dog1e.vercel.app/';
const ALLOWED_EXTENSIONS = new Set(['txt','md','csv','json','js','jsx','ts','tsx','py','html','css','xml','yaml','yml','log','sql','sh','toml','ini']);

function makeChat() {
  return { id: Date.now().toString(36) + Math.random().toString(36).slice(2,7), title: 'New chat', messages: [], updatedAt: Date.now() };
}

function readSavedChats() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(value) ? value.filter(chat => chat && chat.id && Array.isArray(chat.messages)) : [];
  } catch { return []; }
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || '';
  const language = className.match(/language-([\\w-]+)/)?.[1] || 'code';
  const codeText = String(codeElement?.props?.children ?? '');
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setCopied(false); }
  }
  return <div className="code-block">
    <div className="code-header"><span>{language}</span><button onClick={copyCode} title="Copy code">{copied ? <Check size={13}/> : <Copy size={13}/>} {copied ? 'Copied' : 'Copy'}</button></div>
    <pre>{children}</pre>
  </div>;
}

function AssistantContent({ content }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={{
    pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
    code: ({ className, children, ...props }) => <code className={className || 'inline-code'} {...props}>{children}</code>
  }}>{content}</ReactMarkdown>;
}

export default function App(){
 const [chats,setChats]=useState(()=>{const saved=readSavedChats();return saved.length?saved:[makeChat()];});
 const [activeId,setActiveId]=useState(()=>{const saved=readSavedChats();return saved[0]?.id || null;});
 const [text,setText]=useState('');
 const [sidebar,setSidebar]=useState(true);
 const [advanced,setAdvanced]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [files,setFiles]=useState([]);
 const [speakingId,setSpeakingId]=useState(null);
 const [listening,setListening]=useState(false);
 const [shareCopied,setShareCopied]=useState(false);
 const fileInput=useRef(null);
 const recognitionRef=useRef(null);
 const activeChat=chats.find(chat=>chat.id===activeId) || chats[0];
 const messages=activeChat?.messages || [];

 useEffect(()=>{try{localStorage.setItem(HISTORY_KEY,JSON.stringify(chats));}catch{setError('Could not save chat history. Browser storage may be full.');}},[chats]);
 useEffect(()=>()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel();recognitionRef.current?.stop?.();},[]);

 function createChat(){
   const chat=makeChat();
   setChats(current=>[chat,...current]);
   setActiveId(chat.id);
   setText('');setFiles([]);setError('');
   if('speechSynthesis' in window)window.speechSynthesis.cancel();
   setSpeakingId(null);
 }
 function openChat(id){setActiveId(id);setText('');setFiles([]);setError('');}
 function deleteChat(id){
   setChats(current=>{
     const next=current.filter(chat=>chat.id!==id);
     if(!next.length){const fresh=makeChat();setActiveId(fresh.id);return [fresh];}
     if(activeId===id)setActiveId(next[0].id);
     return next;
   });
 }

 function startVoiceInput(){
   const SpeechRecognition=window.SpeechRecognition || window.webkitSpeechRecognition;
   if(!SpeechRecognition){setError('Voice typing is not supported in this browser. Try Chrome or Edge.');return;}
   if(listening){recognitionRef.current?.stop();setListening(false);return;}
   const recognition=new SpeechRecognition();
   recognition.lang=navigator.language || 'en-US';
   recognition.continuous=true;
   recognition.interimResults=true;
   recognition.onresult=(event)=>{
     let finalText='';
     for(let i=event.resultIndex;i<event.results.length;i++){
       if(event.results[i].isFinal)finalText+=event.results[i][0].transcript+' ';
     }
     if(finalText)setText(current=>(current ? current+' ' : '')+finalText.trim());
   };
   recognition.onerror=(event)=>{setListening(false);if(event.error!=='no-speech'&&event.error!=='aborted')setError('Microphone issue: '+event.error+'. Check browser microphone permission.');};
   recognition.onend=()=>setListening(false);
   recognitionRef.current=recognition;
   setError('');
   try{recognition.start();setListening(true);}catch{setListening(false);setError('Could not start voice typing. Try again.');}
 }

 async function shareDogeAI(){
   try{
     await navigator.clipboard.writeText(SHARE_URL);
     setShareCopied(true);
     window.setTimeout(()=>setShareCopied(false),1800);
   }catch{setError('Could not copy the link. Copy it from the address bar: '+SHARE_URL);}
 }

 async function addFiles(fileList){
   const incoming=Array.from(fileList || []);
   const next=[];
   for(const file of incoming){
     const ext=file.name.split('.').pop().toLowerCase();
     if(!ALLOWED_EXTENSIONS.has(ext)){setError(file.name+': unsupported file type. Use a text, code, CSV, or JSON file.');continue;}
     if(file.size>MAX_FILE_SIZE){setError(file.name+': file is over the 40 KB limit.');continue;}
     try{const content=await file.text();next.push({name:file.name,content});}
     catch{setError('Could not read '+file.name+'.');}
   }
   setFiles(current=>[...current,...next].slice(0,MAX_FILES));
   if(next.length)setError('');
   if(fileInput.current)fileInput.current.value='';
 }

 async function send(value=text){
   const clean=value.trim();
   if((!clean&&!files.length)||busy)return;
   const attached=[...files];
   const attachmentPrompt=attached.map(file=>'\\n\\n--- Attached file: '+file.name+' ---\\n'+file.content+'\\n--- End of '+file.name+' ---').join('');
   const prompt=clean+attachmentPrompt;
   const userMessage={role:'user',content:prompt,displayContent:clean,attachments:attached.map(file=>file.name)};
   const history=[...messages,userMessage];
   const chatId=activeChat.id;
   setChats(current=>current.map(chat=>chat.id===chatId?{...chat,title:chat.messages.length?chat.title:(clean.slice(0,42)||attached[0]?.name||'New chat'),messages:history,updatedAt:Date.now()}:chat));
   setText('');setFiles([]);setError('');setBusy(true);
   try{
     const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,advanced})});
     const data=await response.json();
     if(!response.ok)throw new Error(data.error||'Request failed');
     setChats(current=>current.map(chat=>chat.id===chatId?{...chat,messages:[...chat.messages,{role:'assistant',content:data.reply}],updatedAt:Date.now()}:chat));
   }catch(e){setError(e.message||'Could not reach Doge AI.');}
   finally{setBusy(false);}
 }

 function speak(content,id){
   if(!('speechSynthesis' in window)){setError('Text-to-speech is not supported in this browser.');return;}
   if(speakingId===id){window.speechSynthesis.cancel();setSpeakingId(null);return;}
   window.speechSynthesis.cancel();
   const utterance=new SpeechSynthesisUtterance(content);
   utterance.onend=()=>setSpeakingId(null);
   utterance.onerror=()=>setSpeakingId(null);
   setSpeakingId(id);window.speechSynthesis.speak(utterance);
 }

 return <div className="app">
  {sidebar&&<aside className="sidebar"><div className="brand"><div className="logo">d</div><span>Doge AI</span></div><button className="new-chat" onClick={createChat}><Plus size={16}/> New chat</button><div className="side-label">RECENT CHATS</div><div className="history-list">{[...chats].sort((a,b)=>b.updatedAt-a.updatedAt).map(chat=><div className={'history-row '+(chat.id===activeChat?.id?'active':'')} key={chat.id}><button className="history-open" onClick={()=>openChat(chat.id)}><MessageSquare size={14}/><span>{chat.title}</span></button><button className="history-delete" onClick={()=>deleteChat(chat.id)} title="Delete chat"><Trash2 size={13}/></button></div>)}</div><div className="side-label space-label">YOUR SPACE</div><button className="side-item" onClick={()=>setAdvanced(v=>!v)}><Sparkles size={16}/> Advanced mode <span className="toggle">{advanced?'ON':'OFF'}</span></button><div className="side-bottom"><button className="side-item" onClick={shareDogeAI}><Share2 size={16}/> Share Doge AI</button><div className="profile"><div className="avatar">D</div><div><b>Doge User</b><small>Free plan · Saved locally</small></div></div></div></aside>}
  <main className="main"><header><button className="icon-btn" onClick={()=>setSidebar(v=>!v)} title="Toggle sidebar"><PanelLeft size={18}/></button><div className="model">Doge <span>AI</span><span className="chevron">⌄</span></div><button className="share-top" onClick={shareDogeAI}>{shareCopied?<Check size={14}/>:<Share2 size={14}/>} {shareCopied?'Copied link':'Share AI'}</button><button className="mode" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Advanced':'Standard'} <span className="dot"/></button></header>
   <section className={`conversation ${messages.length?'has-messages':''}`}>{messages.length===0?<div className="welcome"><div className="big-logo">d</div><h1>What can I help with?</h1><p>Ask anything. Keep it simple.</p><div className="starter-grid">{starters.map(s=><button key={s} onClick={()=>send(s)}>{s}<span>↗</span></button>)}</div></div>:<div className="messages">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==='assistant'&&<div className="mini-logo">d</div>}<div className="message-body">{m.role==='assistant'&&<div className="message-actions"><button className="tool speak-button" onClick={()=>speak(m.content,i)} title={speakingId===i?'Stop speaking':'Read aloud'}>{speakingId===i?<VolumeX size={15}/>:<Volume2 size={15}/>}<span>{speakingId===i?'Stop':'Read aloud'}</span></button></div>}<div className="bubble">{m.role==='assistant'?<AssistantContent content={m.content}/>:<><div>{m.displayContent || m.content}</div>{m.attachments?.length>0&&<div className="message-attachments">{m.attachments.map(name=><span className="file-chip" key={name}><FileText size={13}/>{name}</span>)}</div>}</>}</div></div></div>)}</div>}</section>
   <div className="composer-wrap"><div className="composer">
    {files.length>0&&<div className="pending-files">{files.map((file,i)=><div className="pending-file" key={file.name+i}><FileText size={14}/><span>{file.name}</span><button onClick={()=>setFiles(current=>current.filter((_,index)=>index!==i))} title="Remove file"><X size={13}/></button></div>)}</div>}
    <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} placeholder={busy?'Doge AI is thinking…':'Message Doge AI…'} rows={1}/>
    <div className="composer-tools"><div><input ref={fileInput} className="file-input" type="file" multiple accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.toml,.ini" onChange={e=>addFiles(e.target.files)}/><button className="tool" title="Upload text or code files" onClick={()=>fileInput.current?.click()}><Paperclip size={17}/></button><button className={'tool voice-input '+(listening?'listening':'')} title={listening?'Stop voice typing':'Voice to text'} onClick={startVoiceInput}>{listening?<MicOff size={17}/>:<Mic size={17}/>}</button></div><button className="send" onClick={()=>send()} disabled={(!text.trim()&&!files.length)||busy}><ArrowUp size={18}/></button></div>
   </div>{error&&<div className="error">{error}</div>}<div className="disclaimer">Doge AI can make mistakes. Check important information.</div></div>
  </main></div>
}
