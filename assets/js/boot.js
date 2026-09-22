const started=Date.now();
const check=()=>{
  if(window.__mPanelState)return;
  if(Date.now()-started<8000){setTimeout(check,500);return;}
  if(document.querySelector("#boot-error"))return;
  const wrap=document.createElement("section");
  wrap.id="boot-error";
  wrap.className="boot-error";
  wrap.innerHTML='<div class="boot-error-card"><h2>mPanel could not start</h2><p>The dashboard module did not finish loading. This usually means a browser cache, blocked module request, or a JavaScript dependency failed.</p><code id="boot-error-detail">No application boot marker was detected.</code><button class="btn primary" id="boot-reload">Reload mPanel</button></div>';
  document.body.append(wrap);
  document.querySelector("#boot-reload")?.addEventListener("click",()=>window.location.reload());
};
check();
