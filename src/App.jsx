import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { ArrowUp, Plus, PanelLeft, Sparkles, Settings2, MessageSquare, Mic, Paperclip, Volume2, VolumeX, X, Copy, Check, FileText } from 'lucide-react';

const starters = ['Explain something complicated simply','Help me brainstorm ideas','Write or improve something'];
const MAX_FILE_SIZE = 40 * 1024;
const MAX_FILES = 3;
const ALLOWED_EXTENSIONS = new Set(['txt','md','csv','json','js','jsx','ts','tsx','py','html','css','xml','yaml','yml','log','sql','sh','toml','ini']);

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const codeElement = Array.isArray(children) ? children[0] : children;
  const className = codeElement?.props?.className || '';
  const language = className.match(/language-([\w-]+)/)?.[1] || 'code';
  const codeText = String(codeElement?.props?.children ?? '');
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
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
 const [messages,setMessages]=useState(()=>{try{return JSON.parse(localStorage.getItem('doge-ai-current')||'[]')}catch{return []}});
 const scrollRef=useRef(null);
 const [text,setText]=useState('');
 const [savedChats,setSavedChats]=useState(()=>{try{return JSON.parse(localStorage.getItem('doge-ai-chats')||'[]')}catch{return []}});
 const [sidebar,setSidebar]=useState(true);
 const [advanced,setAdvanced]=useState(false);
 const [busy,setBusy]=useState(false);
 const [thinkingLabel,setThinkingLabel]=useState('Thinking through your message…');
 const [error,setError]=useState('');
 const [files,setFiles]=useState([]);
 const [speakingId,setSpeakingId]=useState(null);
 const fileInput=useRef(null);

 useEffect(()=>()=>{ if ('speechSynthesis' in window) window.speechSynthesis.cancel(); },[]);
 useEffect(()=>{localStorage.setItem('doge-ai-current',JSON.stringify(messages));},[messages]);
 useEffect(()=>{localStorage.setItem('doge-ai-chats',JSON.stringify(savedChats));},[savedChats]);
 function startNewChat(){if(messages.length){setSavedChats(list=>[{id:Date.now(),title:(messages.find(m=>m.role==='user')?.displayContent||'Previous chat').slice(0,42),messages},...list].slice(0,30));}setMessages([]);setText('');setFiles([]);setError('');if('speechSynthesis' in window)window.speechSynthesis.cancel();setSpeakingId(null);}
 useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'});},[messages,busy]);

 async function addFiles(fileList){
   const incoming=Array.from(fileList || []);
   const next=[];
   for(const file of incoming){
     const ext=file.name.split('.').pop().toLowerCase();
     if(!ALLOWED_EXTENSIONS.has(ext)){setError(file.name+': unsupported file type. Use a text, code, CSV, or JSON file.');continue;}
     if(file.size>MAX_FILE_SIZE){setError(file.name+': file is over the 500 KB limit.');continue;}
     try{
       const content=await file.text();
       next.push({name:file.name,content});
     }catch{setError('Could not read '+file.name+'.');}
   }
   setFiles(current=>[...current,...next].slice(0,MAX_FILES));
   if(next.length)setError('');
   if(fileInput.current)fileInput.current.value='';
 }

 async function send(value=text){
   const clean=value.trim();
   if((!clean&&!files.length)||busy)return;
   const attached=[...files];
   const attachmentPrompt=attached.map(file=>'\n\n--- Attached file: '+file.name+' ---\n'+file.content+'\n--- End of '+file.name+' ---').join('');
   const prompt=clean+attachmentPrompt;
   const history=[...messages,{role:'user',content:prompt,displayContent:clean,attachments:attached.map(file=>file.name)}];
   setMessages(history);setText('');setFiles([]);setError('');setThinkingLabel('Thinking through your message…');setBusy(true);
   try{
     let data=null;
     let lastError=null;
     for(let attempt=0;attempt<3;attempt++){
       try{
         const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:history,advanced})});
         const payload=await response.json().catch(()=>({}));
         if(!response.ok){
           const failure=new Error(payload.error||'Request failed');
           if(response.status<500&&response.status!==429)throw failure;
           throw failure;
         }
         if(typeof payload.reply!=='string'||!payload.reply.trim())throw new Error('The AI returned an empty answer.');
         data=payload;
         break;
       }catch(err){
         lastError=err;
         if(attempt===2)break;
         setThinkingLabel('That response failed. Retrying…');
         await new Promise(resolve=>setTimeout(resolve,600*(attempt+1)));
       }
     }
     if(!data)throw lastError||new Error('Could not reach Doge AI.');
     setMessages(m=>[...m,{role:'assistant',content:data.reply}]);
   }catch(e){setError((e.message||'Could not reach Doge AI.')+' Please try again.');}
   finally{setBusy(false);setThinkingLabel('Thinking through your message…');}
 }

 function speak(content,id){
   if(!('speechSynthesis' in window)){setError('Text-to-speech is not supported in this browser.');return;}
   if(speakingId===id){window.speechSynthesis.cancel();setSpeakingId(null);return;}
   window.speechSynthesis.cancel();
   const utterance=new SpeechSynthesisUtterance(content);
   utterance.onend=()=>setSpeakingId(null);
   utterance.onerror=()=>setSpeakingId(null);
   setSpeakingId(id);
   window.speechSynthesis.speak(utterance);
 }

 return <div className="app">
  {sidebar&&<aside className="sidebar"><div className="brand"><div className="logo">d</div><div className="brand-text"><span>Doge AI</span><small>Advik Kumar</small></div></div><button className="new-chat" onClick={startNewChat}><Plus size={16}/> New chat</button><div className="side-label">YOUR SPACE</div><button className="side-item"><MessageSquare size={16}/> Chat</button><button className="side-item" onClick={()=>setAdvanced(v=>!v)}><Sparkles size={16}/> Advanced mode <span className="toggle">{advanced?'ON':'OFF'}</span></button><div className="side-label history-label">RECENT CHATS</div>{savedChats.map(chat=><button className="side-item history-chat" key={chat.id} title={chat.title} onClick={()=>setMessages(chat.messages)}><MessageSquare size={14}/><span>{chat.title}</span></button>)}<div className="side-bottom"><button className="side-item"><Settings2 size={16}/> Settings</button><div className="profile"><div className="avatar">D</div><div><b>Doge User</b><small>Free plan</small></div></div></div></aside>}
  <main className="main"><header><button className="icon-btn" onClick={()=>setSidebar(v=>!v)} title="Toggle sidebar"><PanelLeft size={18}/></button><div className="model">Doge <span>AI</span><span className="chevron">⌄</span></div><button className="mode" onClick={()=>setAdvanced(v=>!v)}>{advanced?'Advanced':'Standard'} <span className="dot"/></button></header>
   <section ref={scrollRef} className={`conversation ${messages.length?'has-messages':''}`}>{messages.length===0?<div className="welcome"><div className="big-logo">d</div><h1>What can I help with?</h1><p>Ask anything. Keep it simple.</p><div className="starter-grid">{starters.map(s=><button key={s} onClick={()=>send(s)}>{s}<span>↗</span></button>)}</div></div>:<div className="messages">{messages.map((m,i)=><div className={`message ${m.role}`} key={i}>{m.role==='assistant'&&<div className="mini-logo">d</div>}<div className="message-body">{m.role==='assistant'&&<div className="message-actions"><button className="tool speak-button" onClick={()=>speak(m.content,i)} title={speakingId===i?'Stop speaking':'Read aloud'}>{speakingId===i?<VolumeX size={15}/>:<Volume2 size={15}/>}<span>{speakingId===i?'Stop':'Read aloud'}</span></button></div>}<div className="bubble">{m.role==='assistant'?<AssistantContent content={m.content}/>:<><div>{m.displayContent || m.content}</div>{m.attachments?.length>0&&<div className="message-attachments">{m.attachments.map(name=><span className="file-chip" key={name}><FileText size={13}/>{name}</span>)}</div>}</>}</div></div></div>)}</div>}{busy&&<div className="thinking-indicator"><div className="mini-logo">d</div><div className="thinking-content"><div className="thinking-title">{thinkingLabel}</div><div className="thinking-dots"><i></i><i></i><i></i></div></div></div>}</section>
   <div className="composer-wrap"><div className="composer">
    {files.length>0&&<div className="pending-files">{files.map((file,i)=><div className="pending-file" key={file.name+i}><FileText size={14}/><span>{file.name}</span><button onClick={()=>setFiles(current=>current.filter((_,index)=>index!==i))} title="Remove file"><X size={13}/></button></div>)}</div>}
    <textarea value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder={busy?'Doge AI is thinking…':'Message Doge AI…'} rows={1}/>
    <div className="composer-tools"><div><input ref={fileInput} className="file-input" type="file" multiple accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml,.log,.sql,.sh,.toml,.ini" onChange={e=>addFiles(e.target.files)}/><button className="tool" title="Upload text or code files" onClick={()=>fileInput.current?.click()}><Paperclip size={17}/></button></div><button className="send" onClick={()=>send()} disabled={(!text.trim()&&!files.length)||busy}><ArrowUp size={18}/></button></div>
   </div>{error&&<div className="error">{error}</div>}<div className="disclaimer">Doge AI can make mistakes. Check important information.</div></div>
  </main></div>
}
