const APP_VERSION="20260922-029";
const MODULES=[
  ["platform",`assets/js/platform.js?v=20260922-006`],
  ["GitHub auth",`assets/js/auth-github.js?v=20260922-003`],
  ["audit",`assets/js/audit.js?v=20260922-002`]
];

window.__mPanelBootStarted=Date.now();

function stringifyError(error){
  if(!error)return "Unknown startup error.";
  const name=error.name?error.name+": ":"";
  const message=error.message||String(error);
  return name+message;
}

function showBootError(stage,error){
  console.error("[mPanel boot] "+stage,error);
  const detail=stringifyError(error);
  let wrap=document.querySelector("#boot-error");
  if(!wrap){
    wrap=document.createElement("section");
    wrap.id="boot-error";
    wrap.className="boot-error";
    document.body.append(wrap);
  }
  wrap.innerHTML='<div class="boot-error-card"><h2>mPanel could not start</h2><p>The dashboard could not load its JavaScript application.</p><code id="boot-error-detail">'+detail.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))+'</code><div class="boot-error-actions"><button class="btn primary" id="boot-reload">Reload mPanel</button><button class="btn secondary" id="boot-clear-cache">Reload without service worker</button></div></div>';
  document.querySelector("#boot-reload")?.addEventListener("click",()=>window.location.reload());
  document.querySelector("#boot-clear-cache")?.addEventListener("click",async()=>{
    try{
      if("serviceWorker" in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r=>r.unregister()));
      }
      if("caches" in window){
        const keys=await caches.keys();
        await Promise.all(keys.map(k=>caches.delete(k)));
      }
    }finally{
      const u=new URL(window.location.href);
      u.searchParams.set("v",String(Date.now()));
      window.location.replace(u.href);
    }
  });
}

window.addEventListener("error",event=>{
  if(event?.error)console.error("[mPanel global error]",event.error);
});
window.addEventListener("unhandledrejection",event=>{
  console.error("[mPanel unhandled rejection]",event.reason);
});

async function start(){
  try{
    await import("./app.js?v="+APP_VERSION);
  }catch(error){
    showBootError("app",error);
    return;
  }
  for(const [name,url] of MODULES){
    try{
      await import("./"+url);
    }catch(error){
      console.error("[mPanel optional module] "+name,error);
    }
  }
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
