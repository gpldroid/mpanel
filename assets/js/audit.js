import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const db=createClient(SUPABASE_URL.trim().replace(/\/$/,""),SUPABASE_ANON_KEY.trim());
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
let state=null;

function style(){
 if(document.querySelector("#audit-center-css"))return;
 const s=document.createElement("style");s.id="audit-center-css";
 s.textContent=".audit-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:18px}.audit-list{display:grid;gap:8px;max-height:520px;overflow:auto}.audit-row{display:grid;grid-template-columns:130px minmax(0,1fr);gap:12px;padding:11px 12px;border:1px solid var(--border);border-radius:11px;background:var(--surface-2)}.audit-row strong,.audit-row small{display:block}.audit-row small{color:var(--muted);margin-top:3px;word-break:break-word}.audit-meta{color:var(--muted);font-size:11px}.audit-health{display:flex;gap:8px;flex-wrap:wrap}.audit-actions{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:900px){.audit-grid{grid-template-columns:1fr}.audit-row{grid-template-columns:1fr}}";
 document.head.append(s);
}

function mount(){
 style();
 if(document.querySelector("#view-audit"))return;
 const nav=document.querySelector(".sidebar nav"); const content=document.querySelector(".content");
 if(!nav||!content)return;
 const label=document.createElement("div");label.className="nav-group-label";label.textContent="SYSTEM";
 const button=document.createElement("button");button.className="nav-item";button.dataset.auditNav="true";button.innerHTML='<span data-lucide="shield-check"></span>Audit & Health';
 nav.append(label,button);
 const view=document.createElement("div");view.id="view-audit";view.className="view hidden";content.append(view);
 button.addEventListener("click",open);
 window.lucide?.createIcons();
}

function open(){
 document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));
 document.querySelectorAll(".nav-item").forEach(v=>v.classList.remove("active"));
 document.querySelector('[data-audit-nav="true"]')?.classList.add("active");
 const title=document.querySelector("#page-title");if(title)title.textContent="Audit & Health";
 const view=document.querySelector("#view-audit");if(view)view.classList.remove("hidden");
 render();
}

async function render(){
 mount();
 const root=document.querySelector("#view-audit");if(!root)return;
 state=window.__mPanelState;
 const user=state?.user,site=state?.selectedSite;
 if(!user||!site){root.innerHTML='<section class="card empty"><i data-lucide="shield"></i><p>Select a website and sign in to inspect production health.</p></section>';window.lucide?.createIcons();return;}
 root.innerHTML='<div class="toolbar"><div><span class="eyebrow">PRODUCTION HARDENING</span><h3>Audit & Health</h3><p class="muted">Security, performance, deployment queue and audit history for the selected website.</p></div><div class="audit-actions"><button class="btn secondary" id="audit-refresh"><i data-lucide="refresh-cw"></i>Refresh</button></div></div><div class="audit-grid"><section class="card"><div class="section-head"><div><h3>Audit log</h3><p class="muted">Recent actions recorded by mPanel.</p></div></div><div id="audit-log-list" class="audit-list"><div class="empty">Loading…</div></div></section><section class="card"><div class="section-head"><div><h3>Production controls</h3><p class="muted">Current security, performance and automation state.</p></div></div><div id="audit-health"><div class="empty">Loading…</div></div></section></div>';
 document.querySelector("#audit-refresh")?.addEventListener("click",render);
 try{
  const [logs,runs,queue,security,performance,checks]=await Promise.all([
   db.from("audit_logs").select("*").order("created_at",{ascending:false}).limit(80),
   db.from("scheduled_publish_runs").select("*").eq("site_id",site.id).order("ran_at",{ascending:false}).limit(12),
   db.from("deployment_queue").select("*").eq("site_id",site.id).order("created_at",{ascending:false}).limit(12),
   db.from("site_security_settings").select("*").eq("site_id",site.id).maybeSingle(),
   db.from("site_performance_settings").select("*").eq("site_id",site.id).maybeSingle(),
   db.from("system_checks").select("*").eq("site_id",site.id).order("check_key")
  ]);
  if(logs.error)throw logs.error;
  document.querySelector("#audit-log-list").innerHTML=logs.data?.length?logs.data.map(x=>'<div class="audit-row"><div class="audit-meta">'+esc(new Date(x.created_at).toLocaleString())+'</div><div><strong>'+esc(x.action)+'</strong><small>'+esc(x.entity_type||"system")+' · '+esc(JSON.stringify(x.details||{}))+'</small></div></div>').join(""):'<div class="empty">No audit events recorded yet.</div>';
  const sec=security.data||{},perf=performance.data||{},q=queue.data||[],r=runs.data||[],ch=checks.data||[];
  const pass=ch.filter(x=>x.status==="pass").length,fail=ch.filter(x=>x.status==="fail").length,pending=q.filter(x=>x.status==="pending").length;
  document.querySelector("#audit-health").innerHTML='<div class="audit-health"><span class="badge '+(sec.https_redirect!==false?"success":"warning")+'">HTTPS '+(sec.https_redirect!==false?"on":"off")+'</span><span class="badge '+(sec.hsts_enabled!==false?"success":"warning")+'">HSTS '+(sec.hsts_enabled!==false?"on":"off")+'</span><span class="badge '+(perf.minify_html!==false?"success":"warning")+'">HTML minify '+(perf.minify_html!==false?"on":"off")+'</span><span class="badge '+(perf.lazy_images!==false?"success":"warning")+'">Lazy images '+(perf.lazy_images!==false?"on":"off")+'</span><span class="badge '+(fail?"warning":"success")+'">Checks '+pass+'/'+ch.length+'</span><span class="badge '+(pending?"warning":"success")+'">Queue '+pending+' pending</span></div><div class="audit-list" style="margin-top:14px">'+(r.length?r.map(x=>'<div class="audit-row"><div class="audit-meta">'+esc(new Date(x.ran_at).toLocaleString())+'</div><div><strong>Scheduler: '+esc(x.status)+'</strong><small>'+esc(x.message||"No scheduled posts")+'</small></div></div>').join(""):'<div class="empty">No scheduler runs recorded yet.</div>')+'</div><div class="audit-actions" style="margin-top:14px"><button class="btn secondary" id="audit-run-due">Run due posts now</button><button class="btn secondary" id="audit-purge">Purge expired analytics</button></div>';
  document.querySelector("#audit-run-due")?.addEventListener("click",async()=>{const {data,error}=await db.rpc("publish_due_posts",{p_site_id:site.id});if(error)alert(error.message);else{await db.rpc("write_audit_log",{p_action:"scheduler.manual_run",p_entity_type:"site",p_entity_id:site.id,p_details:{published_count:Number(data||0)}});render()}});
  document.querySelector("#audit-purge")?.addEventListener("click",async()=>{const {error}=await db.rpc("purge_expired_analytics",{p_site_id:site.id});if(error)alert(error.message);else render()});
 }catch(e){root.innerHTML+='<div class="card" style="margin-top:18px"><strong>Audit data unavailable</strong><p class="muted">'+esc(e.message||e)+'</p></div>';}
 window.lucide?.createIcons();
}

mount();
export {mount,open,render};
