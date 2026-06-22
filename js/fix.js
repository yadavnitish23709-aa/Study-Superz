/**
 * Study Superz — COMPLETE FIX v3
 * Upload as: js/fix.js
 * Fixes ALL issues in one file
 */
(function(){
'use strict';

const GEMINI='AIzaSyB8RN6LwTx9Y0X9_Ahi3bNriHtguJVAi1CCrRu21wxoEUyagyg';

/* ═══════════════════════════════════════
   1. STUDY-ONLY AI FILTER
═══════════════════════════════════════ */
const STUDY_KEYWORDS=['study','learn','class','school','subject','chapter','exam','test','question','explain','solve','formula','definition','history','geography','biology','chemistry','physics','maths','math','english','hindi','science','economics','polity','civics','jee','neet','upsc','ssc','topic','concept','notes','quiz','syllabus','homework','assignment','doubt','answer','calculate','derive','prove','differentiate','integrate','atom','cell','force','energy','law','theory','element','equation','theorem','period','revolution','war','independence','constitution','parliament','river','mountain','climate','photosynthesis','respiration','evolution','genetics','acid','base','salt','metal','current','voltage','resistance','gravity','velocity','acceleration','momentum','work','power','profit','loss','percentage','ratio','trigonometry','algebra','geometry','calculus','probability','statistics','computer','programming','algorithm','database','network','democracy','government','budget','gdp','inflation','trade','map','culture','art','literature','poem','grammar','verb','noun','sentence','paragraph','composition','essay','french','mughal','british','freedom','gandhi','nehru','nehru','independence','partition','carbon','hydrogen','oxygen','nitrogen','periodic','bond','reaction','organic','inorganic','human body','heart','brain','kidney','lungs','blood','nerve','bone','muscle','digestive','reproduction'];

const NON_STUDY=['joke','funny','movie','song','cricket','ipl','football','recipe','cook','food','weather','girlfriend','boyfriend','love','romance','game','pubg','free fire','bollywood','actor','actress','news','politics','party','election','war current','russia','ukraine','stock market personal','crypto bitcoin','fashion','clothes','shopping','instagram','youtube trending'];

let lastQuestion='';
let sameCount=0;

function isStudyRelated(msg){
  const lower=msg.toLowerCase();
  // Allow greetings + intro
  if(/^(hi|hello|hey|who are you|what can you do|help me|namaste|good morning|good evening)/i.test(lower)) return true;
  // Block obvious non-study
  if(NON_STUDY.some(k=>lower.includes(k))) return false;
  // Check if contains study keyword
  if(STUDY_KEYWORDS.some(k=>lower.includes(k))) return true;
  // Short queries that could be study-related — allow
  if(msg.trim().length<30) return true;
  return false;
}

function isDuplicate(msg){
  const norm=msg.toLowerCase().trim();
  if(norm===lastQuestion){sameCount++;return sameCount>1;}
  lastQuestion=norm;sameCount=1;return false;
}

/* ═══════════════════════════════════════
   2. RATE LIMITING (only logged-in users)
═══════════════════════════════════════ */
const RL={
  KEY:'ss_ai_rl2',MAX:20,WINDOW:3600000,
  check(){
    const d=JSON.parse(localStorage.getItem(this.KEY)||'{"c":0,"s":'+Date.now()+'}');
    if(Date.now()-d.s>this.WINDOW){d.c=0;d.s=Date.now();}
    return{ok:d.c<this.MAX,rem:this.MAX-d.c,wait:Math.ceil((this.WINDOW-(Date.now()-d.s))/60000)};
  },
  consume(){
    const d=JSON.parse(localStorage.getItem(this.KEY)||'{"c":0,"s":'+Date.now()+'}');
    if(Date.now()-d.s>this.WINDOW){d.c=0;d.s=Date.now();}
    d.c++;localStorage.setItem(this.KEY,JSON.stringify(d));
    return this.MAX-d.c;
  }
};

/* ═══════════════════════════════════════
   3. AUTH CHECK
═══════════════════════════════════════ */
function isLoggedIn(){
  try{
    if(sessionStorage.getItem('ss_access_token'))return true;
    return Object.keys(localStorage).some(k=>k.includes('sb-mlpsqojltzkrsykhcico')||k.includes('supabase.auth'));
  }catch{return false;}
}

/* ═══════════════════════════════════════
   4. GEMINI CALL — STUDY ONLY
═══════════════════════════════════════ */
async function askGemini(msg,subject='General',isDup=false){
  const sysPrompt=`You are Superz — an AI study tutor ONLY for Study Superz, India's free learning platform built by Nitish Yadav.

STRICT RULES:
1. ONLY answer questions related to education, studies, school subjects, exams, learning.
2. For non-study questions (movies, jokes, cricket, food, personal life etc.) respond: "I'm Superz, your study buddy! I only help with educational topics. Ask me about Physics, Maths, History, Biology, Chemistry or any subject! 📚"
3. Be encouraging and use emojis appropriately.
4. Keep answers concise (under 200 words) and educational.
5. Subject context: ${subject}
6. You were built by Nitish Yadav for Study Superz.
${isDup?'7. User asked same question again — give a DIFFERENT angle/explanation/example.':''}`;

  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:sysPrompt+'\n\nStudent: '+msg}]}],generationConfig:{maxOutputTokens:600,temperature:isDup?0.9:0.7}})
  });
  if(!r.ok)throw new Error('Gemini '+r.status);
  const d=await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text||'Please try again!';
}

/* ═══════════════════════════════════════
   5. INJECT STYLES
═══════════════════════════════════════ */
const css=document.createElement('style');
css.textContent=`
/* Fix creator photo overlap on mobile */
@media(max-width:900px){.cr-mini{display:none!important;}}
.cr-mini:nth-child(1){top:5%!important;right:-135px!important;left:auto!important;}
.cr-mini:nth-child(2){bottom:10%!important;left:-140px!important;right:auto!important;}
.cr-mini:nth-child(3){top:45%!important;right:-145px!important;left:auto!important;}
/* AI Auth Gate */
#sz-gate{padding:14px 16px;text-align:center;border-top:1px solid rgba(124,58,237,.2);background:rgba(124,58,237,.04);}
#sz-gate p{font-size:12px;color:#94a3b8;margin-bottom:8px;}
#sz-gate button{padding:8px 18px;border-radius:8px;background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;}
.sz-rl{padding:5px 12px;font-size:11px;color:#f59e0b;background:rgba(245,158,11,.07);border-top:1px solid rgba(245,158,11,.15);text-align:center;}
/* Fix mobile AI window */
@media(max-width:520px){
  #szwin,#superz-window{width:calc(100vw - 20px)!important;left:10px!important;}
}`;
document.head.appendChild(css);

/* ═══════════════════════════════════════
   6. PATCH SUPERZ AI
═══════════════════════════════════════ */
function patchAI(){
  const win=document.getElementById('szwin')||document.getElementById('superz-window');
  if(!win)return;

  function getInput(){return document.getElementById('szinp')||document.getElementById('sz-input');}
  function getMsgs(){return document.getElementById('szmsgs')||document.getElementById('sz-msgs');}

  function addMsg(text,type){
    const m=getMsgs();if(!m)return;
    const d=document.createElement('div');
    d.className=`szmsg ${type}`;
    d.innerHTML=text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
    m.appendChild(d);m.scrollTop=m.scrollHeight;return d;
  }
  function addTyping(){
    const m=getMsgs();if(!m)return{remove:()=>{}};
    const d=document.createElement('div');d.className='sztyp';
    d.innerHTML='<div class="std"></div><div class="std"></div><div class="std"></div>';
    m.appendChild(d);m.scrollTop=m.scrollHeight;return d;
  }

  function showGate(){
    if(document.getElementById('sz-gate'))return;
    const g=document.createElement('div');g.id='sz-gate';
    g.innerHTML='<p>🔐 Please <strong>login or sign up</strong> (free!) to use Superz AI</p><button onclick="if(window.openAuth)openAuth(\'login\')">Login / Sign Up Free →</button>';
    const inp=win.querySelector('.szinp-area,.sz-input-area');
    if(inp)win.insertBefore(g,inp);
  }
  function removeGate(){const g=document.getElementById('sz-gate');if(g)g.remove();}

  function updateRL(){
    const old=win.querySelector('.sz-rl');if(old)old.remove();
    if(!isLoggedIn())return;
    const{ok,rem,wait}=RL.check();
    if(!ok){
      const d=document.createElement('div');d.className='sz-rl';
      d.textContent=`⏱️ Rate limit reached. Resets in ${wait} min`;
      const inp=win.querySelector('.szinp-area,.sz-input-area');
      if(inp)win.insertBefore(d,inp);
    } else if(rem<=5){
      const d=document.createElement('div');d.className='sz-rl';
      d.textContent=`⚡ ${rem}/20 AI requests left this hour`;
      const inp=win.querySelector('.szinp-area,.sz-input-area');
      if(inp)win.insertBefore(d,inp);
    }
  }

  // Override szSend
  window.szSend=async function(){
    const inp=getInput();const msg=(inp?.value||'').trim();if(!msg)return;
    if(!isLoggedIn()){showGate();return;}
    const{ok,wait}=RL.check();
    if(!ok){addMsg(`⏱️ AI rate limit reached (20/hour). Try again in ${wait} minutes. This keeps Study Superz free! 🙏`,'bot');return;}
    inp.value='';
    // Study filter
    if(!isStudyRelated(msg)){
      addMsg(msg,'user');
      addMsg('📚 I\'m Superz, your <strong>study buddy</strong>! I only help with educational topics.\n\nAsk me about Physics, Chemistry, Maths, Biology, History, Geography, or any school/exam subject! 🎓','bot');
      return;
    }
    const dup=isDuplicate(msg);
    addMsg(msg,'user');
    const typ=addTyping();
    try{
      const reply=await askGemini(msg,'General',dup);
      typ.remove();addMsg(reply,'bot');
      const rem=RL.consume();updateRL();
      if(rem<=3)addMsg(`⚠️ Only ${rem} AI requests left this hour.`,'bot');
    }catch(e){typ.remove();addMsg('⚠️ Connection error. Check internet and try again!','bot');}
  };

  // Override szQ
  window.szQ=function(q){
    if(!isLoggedIn()){showGate();return;}
    const inp=getInput();if(inp){inp.value=q;window.szSend();}
  };

  // Patch send button
  const sendBtn=win.querySelector('.szsend,.sz-send');
  if(sendBtn)sendBtn.onclick=window.szSend;
  const inp2=getInput();
  if(inp2)inp2.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.szSend();}};

  // Also patch subject page askAI
  window.askAI=async function(){
    const q=(document.getElementById('ap')?.value||'').trim();
    const ar=document.getElementById('ar');if(!q||!ar)return;
    if(!isStudyRelated(q)){ar.innerHTML='📚 I only answer study-related questions. Ask about this subject!';ar.classList.add('show');return;}
    ar.innerHTML='<span style="color:#94a3b8">🧠 Thinking...</span>';ar.classList.add('show');
    const subj=document.title.split('|')[0]?.trim()||'General';
    try{const r=await askGemini(q,subj,isDuplicate(q));ar.innerHTML=r.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');}
    catch(e){ar.innerHTML='⚠️ Error. Try again.';}
  };

  // Auth state change
  isLoggedIn()?removeGate():showGate();
  setInterval(()=>{isLoggedIn()?removeGate():showGate();updateRL();},3000);
}

/* ═══════════════════════════════════════
   7. INIT
═══════════════════════════════════════ */
const init=()=>{
  patchAI();
  // Fix Superz toggle
  const orig=window.toggleSZ||window.toggleSuperz;
  window.toggleSZ=window.toggleSuperz=function(){
    if(orig)orig();
    setTimeout(()=>{const win=document.getElementById('szwin')||document.getElementById('superz-window');if(win&&win.classList.contains('open')&&!isLoggedIn())document.getElementById('sz-gate')||patchAI();},200);
  };
  console.log('✅ Study Superz Fix v3 loaded');
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
else setTimeout(init,600);
})();
