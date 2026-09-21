import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL.trim().replace(/\/$/, ""),SUPABASE_ANON_KEY.trim());
const state={user:null,sites:[],domains:[],seo:[],view:"dashboard"};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const icons=()=>window.lucide?.createIcons();
const dt=v=>v?new Date(v).toLocaleDateString():"—";

function toast(m,type="error"){const e=document.createElement("div");e.className="toast "+(type==="success"?"toast-success":"");e.textContent=m;$("#toast-root").append(e);setTimeout(()=>e.remove(),5000)}
function authError(err){
 const msg=String(err?.message||err||"Unknown error");
 if(/failed to fetch|networkerror|load failed/i.test(msg)) return "Unable to connect to Supabase. Check your Supabase URL, publishable key, project status, and browser network connection.";
 if(/invalid api key|apikey/i.test(msg)) return "Supabase API key is invalid. Use the project's Publishable key in assets/js/config.js.";
 return msg;
}
function setConnectionState(type,title,detail){
 const box=$("#connection-box"),dot=$("#connection-dot"),heading=$("#connection-title"),text=$("#connection-detail");
 if(!box)return;
 box.className="connection-box "+type;
 dot.className="connection-dot "+type;
 heading.textContent=title;
 text.textContent=detail;
}
async function testSupabaseConnection(){
 const btn=$("#connection-test");
 if(!btn)return;
 btn.disabled=true;
 btn.textContent="Testing connection…";
 setConnectionState("testing","Testing Supabase connection","Contacting the Supabase Auth endpoint from this browser.");
 try{
  const base=SUPABASE_URL.trim().replace(/\/$/,"");
  const response=await fetch(base+"/auth/v1/settings",{method:"GET",headers:{apikey:SUPABASE_ANON_KEY.trim()},cache:"no-store"});
  if(response.ok){
   setConnectionState("success","Supabase connection is working","The browser can reach your Supabase project. You can now test account registration or sign in.");
  }else if(response.status===401){
   setConnectionState("error","Supabase key rejected","The project is reachable, but the Publishable key was rejected. Check assets/js/config.js.");
  }else{
   setConnectionState("error","Supabase returned an error","HTTP "+response.status+" — "+(response.statusText||"request failed")+". The project is reachable, but its endpoint returned an error.");
  }
 }catch(error){
  setConnectionState("error","Supabase connection failed",authError(error));
 }finally{
  btn.disabled=false;
  btn.textContent="Test Supabase connection";
 }
}
function stat(label,n,icon){return '<div class="card stat"><div><span class="muted">'+label+'</span><h3>'+n+'</h3></div><div class="stat-icon"><i data-lucide="'+icon+'"></i></div></div>'}
function siteRow(s){return '<div class="site-row"><div class="site-main"><div class="site-favicon"><i data-lucide="globe-2"></i></div><div><div class="site-name">'+esc(s.name)+'</div><div class="site-url">'+esc(s.url)+'</div></div></div><span class="badge '+(s.status==="active"?"success":"warning")+'">'+esc(s.status||"active")+'</span></div>'}

async function loadData(){
 if(!state.user)return;
 const [a,b,c]=await Promise.all([
  supabase.from("sites").select("*").order("created_at",{ascending:false}),
  supabase.from("domains").select("*,sites(name)").order("created_at",{ascending:false}),
  supabase.from("seo_checks").select("*").order("created_at",{ascending:false})
 ]);
 if(a.error)toast(authError(a.error)); if(b.error)toast(authError(b.error)); if(c.error)toast(authError(c.error));
 state.sites=a.data||[];state.domains=b.data||[];state.seo=c.data||[];renderAll();
}
function renderAll(){renderDashboard();renderSites();renderDomains();renderSeo();renderMonitoring();renderSettings();$("#plan-usage").textContent=state.sites.length+" / 3 sites";icons()}

function renderDashboard(){
 $("#view-dashboard").innerHTML='<div class="grid stats">'+
 stat("Total sites",state.sites.length,"globe-2")+stat("Active sites",state.sites.filter(s=>s.status==="active").length,"check-circle-2")+stat("Domains",state.domains.length,"link-2")+stat("SEO checks",state.seo.length,"search-check")+
 '</div><div class="grid two-col"><section class="card"><div class="section-head"><h3>Recent websites</h3><button class="btn secondary" data-go="sites">View all</button></div>'+
 (state.sites.length?'<div class="site-list">'+state.sites.slice(0,5).map(siteRow).join("")+'</div>':'<div class="empty"><i data-lucide="globe"></i><p>No websites yet.</p><button class="btn primary" id="dash-add-site">Add your first site</button></div>')+
 '</section><section class="card"><div class="section-head"><h3>Free plan</h3><span class="badge success">Active</span></div><p class="muted">Manage up to 3 websites with domains, SEO tasks and basic monitoring.</p><div class="progress"><i style="width:'+Math.min(100,state.sites.length/3*100)+'%"></i></div><p class="tiny muted">'+state.sites.length+' of 3 website slots used.</p></section></div>';
 $("#dash-add-site")?.addEventListener("click",()=>openSiteModal());
 $$("[data-go]").forEach(b=>b.onclick=()=>showView(b.dataset.go));
}

function renderSites(){
 $("#view-sites").innerHTML='<div class="toolbar"><div><h3>My Sites</h3><p class="muted">Manage your websites and basic settings.</p></div><button class="btn primary" id="add-site"><i data-lucide="plus"></i>Add site</button></div><div class="card">'+
 (state.sites.length?'<div class="site-list">'+state.sites.map(s=>'<div class="site-row"><div class="site-main"><div class="site-favicon"><i data-lucide="globe-2"></i></div><div><div class="site-name">'+esc(s.name)+'</div><div class="site-url">'+esc(s.url)+'</div><small class="muted">Added '+dt(s.created_at)+'</small></div></div><div style="display:flex;gap:8px;align-items:center"><span class="badge '+(s.status==="active"?"success":"warning")+'">'+esc(s.status||"active")+'</span><button class="icon-btn edit-site" data-id="'+s.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn delete-site" data-id="'+s.id+'"><i data-lucide="trash-2"></i></button></div></div>').join("")+'</div>':
 '<div class="empty"><i data-lucide="globe-2"></i><h3>No websites</h3><p>Add a website to start.</p></div>')+'</div>';
 $("#add-site").onclick=()=>openSiteModal();
 $$(".edit-site").forEach(b=>b.onclick=()=>openSiteModal(state.sites.find(s=>s.id===b.dataset.id)));
 $$(".delete-site").forEach(b=>b.onclick=()=>deleteSite(b.dataset.id));
}
async function deleteSite(id){if(!confirm("Delete this website and related data?"))return;const{error}=await supabase.from("sites").delete().eq("id",id);if(error)toast(authError(error));else{toast("Website deleted");loadData()}}

function openSiteModal(site=null){
 $("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>'+(site?"Edit website":"Add website")+'</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="site-form" class="form-grid"><label>Name<input name="name" required value="'+esc(site?.name||"")+'" placeholder="My Website"></label><label>URL<input name="url" type="url" required value="'+esc(site?.url||"")+'" placeholder="https://example.com"></label><label class="full-field">Description<textarea name="description" rows="4">'+esc(site?.description||"")+'</textarea></label><label>Status<select name="status"><option value="active" '+(site?.status==="active"?"selected":"")+' >Active</option><option value="paused" '+(site?.status==="paused"?"selected":"")+' >Paused</option></select></label><div></div><div class="modal-actions full-field"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Save website</button></div></form></div></div>';
 icons();$("#close-modal").onclick=closeModal;$("#cancel-modal").onclick=closeModal;
 $("#site-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const p={name:f.get("name"),url:f.get("url"),description:f.get("description"),status:f.get("status")};const q=site?supabase.from("sites").update(p).eq("id",site.id):supabase.from("sites").insert({...p,user_id:state.user.id});const{error}=await q;if(error)toast(error.message);else{toast(site?"Website updated":"Website added");closeModal();loadData()}};
}
function closeModal(){$("#modal-root").innerHTML=""}

function renderDomains(){
 $("#view-domains").innerHTML='<div class="toolbar"><div><h3>Domains</h3><p class="muted">Track domains connected to your websites.</p></div><button class="btn primary" id="add-domain"><i data-lucide="plus"></i>Add domain</button></div><div class="card table-wrap"><table class="table"><thead><tr><th>Domain</th><th>Website</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>'+
 (state.domains.length?state.domains.map(d=>'<tr><td><strong>'+esc(d.domain)+'</strong></td><td>'+esc(d.sites?.name||"—")+'</td><td><span class="badge '+(d.status==="verified"?"success":"warning")+'">'+esc(d.status||"pending")+'</span></td><td>'+dt(d.created_at)+'</td><td><button class="icon-btn delete-domain" data-id="'+d.id+'"><i data-lucide="trash-2"></i></button></td></tr>').join(""):'<tr><td colspan="5" class="empty">No domains added.</td></tr>')+'</tbody></table></div>';
 $("#add-domain").onclick=openDomainModal;$$(".delete-domain").forEach(b=>b.onclick=()=>deleteDomain(b.dataset.id));
}
function openDomainModal(){
 if(!state.sites.length){toast("Add a website first.");return}
 $("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Add domain</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="domain-form"><label>Domain<input name="domain" required placeholder="example.com"></label><label style="margin-top:14px">Website<select name="site_id" required>'+state.sites.map(s=>'<option value="'+s.id+'">'+esc(s.name)+'</option>').join("")+'</select></label><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Save domain</button></div></form></div></div>';
 icons();$("#close-modal").onclick=closeModal;$("#cancel-modal").onclick=closeModal;
 $("#domain-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const{error}=await supabase.from("domains").insert({user_id:state.user.id,site_id:f.get("site_id"),domain:f.get("domain").toLowerCase().trim()});if(error)toast(error.message);else{toast("Domain added");closeModal();loadData()}};
}
async function deleteDomain(id){if(!confirm("Delete this domain?"))return;const{error}=await supabase.from("domains").delete().eq("id",id);if(error)toast(error.message);else loadData()}

function renderSeo(){
 const done=state.seo.filter(x=>x.completed).length,total=state.seo.length,pct=total?Math.round(done/total*100):0;
 $("#view-seo").innerHTML='<div class="section-head"><div><h3>SEO checklist</h3><p class="muted">Track essential on-page SEO tasks.</p></div><span class="badge neutral">'+pct+'% complete</span></div><div class="grid two-col"><section class="card"><div class="progress"><i style="width:'+pct+'%"></i></div><div class="checklist" style="margin-top:16px">'+
 (total?state.seo.map(x=>'<label class="check"><input type="checkbox" data-seo="'+x.id+'" '+(x.completed?"checked":"")+'><span><strong>'+esc(x.title)+'</strong><small class="muted" style="display:block">'+esc(x.description||"")+'</small></span></label>').join(""):'<div class="empty">SEO tasks will appear after you add a site.</div>')+
 '</div></section><section class="card"><h3>Recommended basics</h3><ul class="muted"><li>Unique title and meta description</li><li>Canonical URL</li><li>Responsive/mobile layout</li><li>robots.txt and sitemap.xml</li><li>HTTPS and accessible navigation</li></ul></section></div>';
 $$("[data-seo]").forEach(c=>c.onchange=async()=>{const{error}=await supabase.from("seo_checks").update({completed:c.checked}).eq("id",c.dataset.seo);if(error)toast(error.message);else loadData()});
}

function renderMonitoring(){
 $("#view-monitoring").innerHTML='<div class="section-head"><div><h3>Monitoring</h3><p class="muted">Basic availability checks from your browser.</p></div><button class="btn primary" id="check-all"><i data-lucide="refresh-cw"></i>Check sites</button></div><div class="grid">'+
 (state.sites.length?state.sites.map(s=>'<div class="card site-row"><div class="site-main"><div class="site-favicon"><i data-lucide="activity"></i></div><div><div class="site-name">'+esc(s.name)+'</div><div class="site-url">'+esc(s.url)+'</div></div></div><span id="mon-'+s.id+'" class="badge neutral">Not checked</span></div>').join(""):'<div class="card empty">Add a website to monitor it.</div>')+'</div>';
 $("#check-all").onclick=async()=>{for(const s of state.sites){const e=$("#mon-"+s.id);e.textContent="Checking…";try{await fetch(s.url,{mode:"no-cors",cache:"no-store"});e.textContent="Reachable";e.className="badge success"}catch{e.textContent="Check failed";e.className="badge warning"}}};
}
function renderSettings(){
 $("#view-settings").innerHTML='<div class="section-head"><div><h3>Settings</h3><p class="muted">Account and dashboard preferences.</p></div></div><div class="grid two-col"><section class="card"><h3>Account</h3><div style="margin-top:15px"><label>Email<input value="'+esc(state.user?.email||"")+'" disabled></label></div><p class="tiny muted">Authentication is handled by Supabase Auth.</p></section><section class="card"><h3>Appearance</h3><p class="muted">Choose light or dark mode.</p><button class="btn secondary" id="settings-theme"><i data-lucide="moon"></i>Toggle theme</button></section></div>';
 $("#settings-theme").onclick=toggleTheme;
}
function showView(v){state.view=v;$$(".view").forEach(x=>x.classList.add("hidden"));$("#view-"+v).classList.remove("hidden");$$(".nav-item[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===v));const n={dashboard:"Dashboard",sites:"My Sites",domains:"Domains",seo:"SEO",monitoring:"Monitoring",settings:"Settings"};$("#page-title").textContent=n[v]||"Dashboard";$("#sidebar").classList.remove("open");icons()}
function toggleTheme(){document.body.classList.toggle("dark");localStorage.setItem("mpanel-theme",document.body.classList.contains("dark")?"dark":"light")}
if(localStorage.getItem("mpanel-theme")==="dark")document.body.classList.add("dark");

let signUp=false;
$("#connection-test")?.addEventListener("click",testSupabaseConnection);
$("#auth-toggle").onclick=()=>{signUp=!signUp;$("#auth-title").textContent=signUp?"Create your free account.":"Manage your websites in one place.";$("#auth-subtitle").textContent=signUp?"Start with the free mPanel plan.":"Sign in to manage sites, domains and SEO tasks.";$("#auth-submit").textContent=signUp?"Create account":"Sign in";$("#auth-toggle").textContent=signUp?"Already have an account? Sign in":"Create a free account"};
$("#auth-form").onsubmit=async e=>{
 e.preventDefault();
 const btn=$("#auth-submit"),email=$("#auth-email").value.trim(),password=$("#auth-password").value;
 btn.disabled=true;btn.textContent=signUp?"Creating…":"Signing in…";
 try{
  const r=signUp?await supabase.auth.signUp({email,password}):await supabase.auth.signInWithPassword({email,password});
  if(r.error){toast(authError(r.error));return}
  if(signUp&&!r.data.session){toast("Account created. Check your email to confirm the account.","success");return}
  await handleAuth();
 }catch(error){toast(authError(error))}
 finally{btn.disabled=false;btn.textContent=signUp?"Create account":"Sign in"}
};
$("#logout-btn").onclick=async()=>{await supabase.auth.signOut();state.user=null;handleAuth()};
$$(".nav-item[data-view]").forEach(b=>b.onclick=()=>showView(b.dataset.view));
$("#theme-btn").onclick=toggleTheme;$("#menu-btn").onclick=()=>$("#sidebar").classList.toggle("open");$("#profile-btn").onclick=()=>showView("settings");

async function handleAuth(){
 try{
  const{data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(session){state.user=session.user;$("#auth-view").classList.add("hidden");$("#app-view").classList.remove("hidden");$("#avatar-letter").textContent=(session.user.email||"U")[0].toUpperCase();await loadData();showView("dashboard")}
  else{$("#auth-view").classList.remove("hidden");$("#app-view").classList.add("hidden")}
 }catch(error){
  state.user=null;
  $("#auth-view").classList.remove("hidden");$("#app-view").classList.add("hidden");
  toast(authError(error));
 }
}
supabase.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(session&&!state.user)handleAuth();if(event==="SIGNED_OUT"){state.user=null;handleAuth()}},0)});
handleAuth().catch(error=>toast(authError(error)));icons();