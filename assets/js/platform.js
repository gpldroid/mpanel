import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const db=createClient(SUPABASE_URL.trim().replace(/\/$/,""),SUPABASE_ANON_KEY.trim());
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const toast=(m,ok=false)=>{const r=document.querySelector("#toast-root");if(!r)return;const e=document.createElement("div");e.className="toast "+(ok?"toast-success":"");e.textContent=m;r.append(e);setTimeout(()=>e.remove(),4500)};
let user=null,site=null,settings={};

function css(){
 if(document.querySelector("#platform-css"))return;
 const s=document.createElement("style");s.id="platform-css";
 s.textContent=".platform-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.platform-card{min-width:0}.platform-head{display:flex;align-items:center;gap:12px;margin-bottom:14px}.platform-head .stat-icon{flex:0 0 42px}.platform-list{display:grid;gap:8px;margin:12px 0}.platform-row{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--border);border-radius:10px;padding:10px}.platform-row strong,.platform-row small{display:block}.platform-row small{color:var(--muted);margin-top:2px}.platform-actions{display:flex;gap:8px;flex-wrap:wrap}.platform-wide{grid-column:1/-1}.media-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.media-thumb{aspect-ratio:1;overflow:hidden;border-radius:10px;background:var(--surface-2);border:1px solid var(--border)}.media-thumb img{width:100%;height:100%;object-fit:cover}.media-meta{display:grid;gap:3px;padding-top:7px}.health-summary{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.verify-box{display:grid;gap:8px;padding:12px;border:1px dashed var(--border);border-radius:10px;background:var(--surface-2)}.verify-token{font:12px ui-monospace,monospace;word-break:break-all}.upload-input{display:none}@media(max-width:900px){.platform-grid{grid-template-columns:1fr}.platform-wide{grid-column:auto}.media-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}";
 document.head.append(s);
}
async function session(){const r=await db.auth.getSession();user=r.data.session?.user||null;return user}
async function loadSite(){
 if(!user)return null;
 const r=await db.from("sites").select("*").order("created_at",{ascending:false}).limit(1).maybeSingle();if(r.error)throw r.error;
 site=r.data||null;if(!site)return null;
 const [a,b,c]=await Promise.all([db.from("site_security_settings").select("*").eq("site_id",site.id).maybeSingle(),db.from("site_performance_settings").select("*").eq("site_id",site.id).maybeSingle(),db.from("site_seo_settings").select("*").eq("site_id",site.id).maybeSingle()]);
 settings={security:a.data,performance:b.data,seo:c.data};return site;
}
function mount(){
 css();if(document.querySelector("#view-platform"))return;
 const nav=document.querySelector(".sidebar nav");if(!nav)return;
 const label=document.createElement("div");label.className="nav-group-label";label.textContent="PLATFORM";
 const b=document.createElement("button");b.className="nav-item";b.innerHTML='<span data-lucide="shield-check"></span>Platform Center';
 nav.append(label,b);
 const v=document.createElement("div");v.id="view-platform";v.className="view hidden";document.querySelector(".content")?.append(v);
 b.onclick=()=>open();
 window.lucide?.createIcons();
}
function open(){
 document.querySelectorAll(".view").forEach(v=>v.classList.add("hidden"));document.querySelectorAll(".nav-item").forEach(v=>v.classList.remove("active"));
 [...document.querySelectorAll(".sidebar nav button")].find(x=>x.textContent.includes("Platform Center"))?.classList.add("active");
 document.querySelector("#page-title").textContent="Platform Center";document.querySelector("#view-platform").classList.remove("hidden");render();
}
const card=(i,t,d,b,wide=false)=>'<section class="card platform-card '+(wide?"platform-wide":"")+'"><div class="platform-head"><div class="stat-icon"><i data-lucide="'+i+'"></i></div><div><h3>'+t+'</h3><p class="muted">'+d+"</p></div></div>"+b+"</section>";

async function render(){
 const root=document.querySelector("#view-platform");if(!root)return;
 if(!user){root.innerHTML=card("lock","Platform Center","Sign in first.","");return}
 try{await loadSite()}catch(e){root.innerHTML=card("triangle-alert","Schema unavailable","Run the required Supabase migrations first.",'<p class="tiny muted">'+esc(e.message||e)+"</p>");return}
 if(!site){root.innerHTML=card("globe","No website","Create a website first.","");return}
 const [m,d,c,v]=await Promise.all([
  db.from("media_assets").select("*").eq("site_id",site.id).order("created_at",{ascending:false}).limit(24),
  db.from("seo_redirects").select("*").eq("site_id",site.id).order("created_at",{ascending:false}).limit(50),
  db.from("system_checks").select("*").eq("site_id",site.id).order("check_key"),
  db.from("domain_verifications").select("*,domains(domain)").eq("site_id",site.id).order("created_at",{ascending:false})
 ]);
 const media=m.data||[],redirects=d.data||[],checks=c.data||[],verifications=v.data||[];
 if(window.__mPanelState){window.__mPanelState.redirects=redirects;}
 const pass=checks.filter(x=>x.status==="pass").length,fail=checks.filter(x=>x.status==="fail").length;
 root.innerHTML='<div class="toolbar"><div><span class="eyebrow">PLATFORM CENTER</span><h3>'+esc(site.name)+'</h3><p class="muted">Production controls for media, builder output, redirects, domains, security, performance and deployment readiness.</p></div><button class="btn secondary" id="pf-refresh"><i data-lucide="refresh-cw"></i>Refresh</button></div><div class="platform-grid">'+
 card("images","Media Library","Real Supabase Storage uploads with reusable SEO metadata.",mediaHtml(media))+
 card("route","Redirect Manager","Manage 301/302/307/308 redirects and publish a compatible _redirects manifest.",redirectHtml(redirects))+
 card("shield","Security","Transport and browser security settings.",securityHtml())+
 card("gauge","Performance","HTML/CSS/JS optimization and caching controls.",performanceHtml())+
 card("activity","Production Health","Run a complete preflight against the selected site.",healthHtml(checks,pass,fail))+
 card("link-2","Domain Verification","Create and check DNS TXT/CNAME verification records.",domainHtml(verifications),true)+
 "</div>";
 bind();window.lucide?.createIcons();
}

function mediaHtml(media){
 return '<div class="platform-actions"><label class="btn primary"><i data-lucide="upload"></i>Upload files<input class="upload-input" id="pf-upload" type="file" accept="image/*" multiple></label><button class="btn secondary" id="pf-add-media"><i data-lucide="link"></i>Add external URL</button></div><div class="media-grid" style="margin-top:14px">'+(media.map(x=>'<div><div class="media-thumb">'+(x.url?'<img src="'+esc(x.url)+'" alt="'+esc(x.alt_text||"")+'" loading="lazy">':'<div class="empty">No preview</div>')+'</div><div class="media-meta"><strong>'+esc(x.title||x.original_name||"Media")+'</strong><small class="muted">'+esc(x.alt_text||"No alt text")+'</small><div class="platform-actions"><button class="icon-btn pf-edit-media" data-id="'+x.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn pf-copy-media" data-url="'+esc(x.url||"")+'"><i data-lucide="copy"></i></button><button class="icon-btn pf-del-media" data-id="'+x.id+'"><i data-lucide="trash-2"></i></button></div></div></div>').join("")||'<div class="empty">No media assets yet.</div>')+'</div>';
}
function redirectHtml(rows){
 return '<div class="platform-actions"><button class="btn primary" id="pf-add-redir"><i data-lucide="plus"></i>Add redirect</button></div><div class="platform-list">'+(rows.map(x=>'<div class="platform-row"><div><strong>'+esc(x.from_path)+' → '+esc(x.to_path)+'</strong><small>'+x.status_code+' · '+(x.enabled?"enabled":"disabled")+'</small></div><div class="platform-actions"><button class="icon-btn pf-edit-redir" data-id="'+x.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn pf-del-redir" data-id="'+x.id+'"><i data-lucide="trash-2"></i></button></div></div>').join("")||'<div class="empty">No redirects.</div>')+'</div>';
}
function securityHtml(){
 const x=settings.security||{};
 return '<form id="pf-security" class="form-grid"><label class="check"><input name="https_redirect" type="checkbox" '+(x.https_redirect!==false?"checked":"")+'>Force HTTPS</label><label class="check"><input name="hsts_enabled" type="checkbox" '+(x.hsts_enabled!==false?"checked":"")+'>HSTS</label><label>Frame policy<select name="x_frame_options"><option '+(x.x_frame_options==="DENY"?"selected":"")+'>DENY</option><option '+(x.x_frame_options==="SAMEORIGIN"?"selected":"")+'>SAMEORIGIN</option></select></label><label>Referrer policy<input name="referrer_policy" value="'+esc(x.referrer_policy||"strict-origin-when-cross-origin")+'"></label><label class="full-field">Content-Security-Policy<textarea name="content_security_policy" rows="3">'+esc(x.content_security_policy||"")+'</textarea></label><div class="full-field"><button class="btn primary">Save security</button></div></form>';
}
function performanceHtml(){
 const x=settings.performance||{};
 return '<form id="pf-performance" class="checklist"><label class="check"><input name="minify_html" type="checkbox" '+(x.minify_html!==false?"checked":"")+'>Minify HTML</label><label class="check"><input name="minify_css" type="checkbox" '+(x.minify_css!==false?"checked":"")+'>Minify CSS</label><label class="check"><input name="minify_js" type="checkbox" '+(x.minify_js!==false?"checked":"")+'>Minify JavaScript</label><label class="check"><input name="lazy_images" type="checkbox" '+(x.lazy_images!==false?"checked":"")+'>Lazy images</label><label class="check"><input name="preload_fonts" type="checkbox" '+(x.preload_fonts!==false?"checked":"")+'>Preload fonts</label><label class="check"><input name="compression" type="checkbox" '+(x.compression!==false?"checked":"")+'>Compression</label><button class="btn primary">Save performance</button></form>';
}
function healthHtml(rows,pass,fail){
 return '<div class="health-summary"><span class="badge success">'+pass+' pass</span><span class="badge '+(fail?"warning":"neutral")+'">'+fail+' fail</span><span class="badge neutral">'+rows.length+' checks</span></div><div class="platform-list">'+(rows.map(x=>'<div class="platform-row"><div><strong>'+esc(x.check_key)+'</strong><small>'+esc(x.message||"Not checked")+'</small></div><span class="badge '+(x.status==="pass"?"success":x.status==="fail"?"warning":"neutral")+'">'+esc(x.status)+'</span></div>').join("")||'<div class="empty">No checks yet.</div>')+'</div><button class="btn primary" id="pf-health"><i data-lucide="shield-check"></i>Run full preflight</button>';
}
function domainHtml(rows){
 return '<div class="platform-actions"><button class="btn primary" id="pf-new-domain-check"><i data-lucide="plus"></i>New verification</button></div><div class="platform-list">'+(rows.map(x=>'<div class="verify-box"><strong>'+esc(x.domains?.domain||"Domain")+'</strong><span class="badge '+(x.status==="verified"?"success":x.status==="failed"?"warning":"neutral")+'">'+esc(x.status)+'</span><small>Method: '+esc(x.method)+'</small><code class="verify-token">'+esc(x.token)+'</code><div class="platform-actions"><button class="btn secondary pf-check-domain" data-id="'+x.id+'">Check DNS</button></div></div>').join("")||'<div class="empty">No verification records.</div>')+'</div>';
}
function modal(html){document.querySelector("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal">'+html+"</div></div>";window.lucide?.createIcons()}
function close(){document.querySelector("#modal-root").innerHTML=""}

function bind(){
 document.querySelector("#pf-refresh")?.addEventListener("click",render);
 document.querySelector("#pf-upload")?.addEventListener("change",uploadFiles);
 document.querySelector("#pf-add-media")?.addEventListener("click",addExternal);
 document.querySelector("#pf-add-redir")?.addEventListener("click",addRedirect);
 document.querySelector("#pf-security")?.addEventListener("submit",saveSecurity);
 document.querySelector("#pf-performance")?.addEventListener("submit",savePerformance);
 document.querySelector("#pf-health")?.addEventListener("click",health);
 document.querySelector("#pf-new-domain-check")?.addEventListener("click",newVerification);
 document.querySelectorAll(".pf-del-media").forEach(b=>b.onclick=()=>deleteMedia(b.dataset.id));
 document.querySelectorAll(".pf-edit-media").forEach(b=>b.onclick=()=>editMedia(b.dataset.id));
 document.querySelectorAll(".pf-copy-media").forEach(b=>b.onclick=()=>navigator.clipboard?.writeText(b.dataset.url).then(()=>toast("URL copied",true)));
 document.querySelectorAll(".pf-del-redir").forEach(b=>b.onclick=()=>remove("seo_redirects",b.dataset.id));
 document.querySelectorAll(".pf-edit-redir").forEach(b=>b.onclick=()=>editRedirect(b.dataset.id));
 document.querySelectorAll(".pf-check-domain").forEach(b=>b.onclick=()=>checkVerification(b.dataset.id));
}

async function uploadFiles(e){
 const files=[...(e.target.files||[])];if(!files.length)return;
 for(const file of files){
  if(file.size>10*1024*1024){toast(file.name+" is larger than 10 MB");continue}
  const path=user.id+"/"+site.id+"/"+Date.now()+"-"+crypto.randomUUID()+"-"+file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
  const up=await db.storage.from("mpanel-media").upload(path,file,{contentType:file.type,upsert:false});
  if(up.error){toast(file.name+": "+up.error.message);continue}
  const pub=db.storage.from("mpanel-media").getPublicUrl(path).data.publicUrl;
  const meta=await imageMeta(file);
  const row={user_id:user.id,site_id:site.id,original_name:file.name,path:pub,url:pub,public_url:pub,mime_type:file.type,size_bytes:file.size,width:meta.width,height:meta.height,alt_text:file.name.replace(/\.[^.]+$/,""),title:file.name.replace(/\.[^.]+$/,""),storage_provider:"supabase",storage_bucket:"mpanel-media",storage_path:path,storage_object_path:path};
  const r=await db.from("media_assets").insert(row);if(r.error){await db.storage.from("mpanel-media").remove([path]);toast(file.name+": "+r.error.message)}
 }
 toast("Media upload completed",true);render();
}
function imageMeta(file){return new Promise(resolve=>{if(!file.type.startsWith("image/"))return resolve({});const img=new Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({});img.src=URL.createObjectURL(file)})}
async function addExternal(){
 const url=prompt("Media URL");if(!url)return;const title=prompt("Title",url.split("/").pop()||"Media")||"Media";const alt=prompt("Alt text",title)||"";
 const r=await db.from("media_assets").insert({user_id:user.id,site_id:site.id,url,path:url,public_url:url,title,alt_text:alt,original_name:title,storage_provider:"external"});
 if(r.error)toast(r.error.message);else{toast("Media added",true);render()}
}
async function editMedia(id){
 const r=await db.from("media_assets").select("*").eq("id",id).single();if(r.error)return toast(r.error.message);const x=r.data;
 modal('<div class="modal-head"><h3>Edit media</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><label>Title<input id="m-title" value="'+esc(x.title||"")+'"></label><label>Alt text<input id="m-alt" value="'+esc(x.alt_text||"")+'"></label><label>Caption<textarea id="m-caption" rows="3">'+esc(x.caption||"")+'</textarea></label><label>URL<input id="m-url" value="'+esc(x.url||"")+'"></label><div class="modal-actions"><button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="m-save">Save</button></div>');
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);document.querySelector("#m-save").onclick=async()=>{const u=await db.from("media_assets").update({title:document.querySelector("#m-title").value,alt_text:document.querySelector("#m-alt").value,caption:document.querySelector("#m-caption").value,url:document.querySelector("#m-url").value,public_url:document.querySelector("#m-url").value}).eq("id",id);if(u.error)toast(u.error.message);else{close();toast("Media updated",true);render()}};
}
async function deleteMedia(id){
 if(!confirm("Delete this media asset and its stored file when applicable?"))return;
 const r=await db.from("media_assets").select("storage_provider,storage_object_path,storage_path").eq("id",id).single();if(r.error)return toast(r.error.message);
 if(r.data.storage_provider==="supabase"&&r.data.storage_object_path)await db.storage.from("mpanel-media").remove([r.data.storage_object_path]);
 const d=await db.from("media_assets").delete().eq("id",id);if(d.error)toast(d.error.message);else{toast("Media deleted",true);render()}
}
async function addRedirect(){
 modal('<div class="modal-head"><h3>Add redirect</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><label>From path<input id="r-from" placeholder="/old-page"></label><label>To path<input id="r-to" placeholder="/new-page"></label><label>Status<select id="r-code"><option>301</option><option>302</option><option>307</option><option>308</option></select></label><label class="check"><input id="r-enabled" type="checkbox" checked> Enabled</label><div class="modal-actions"><button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="r-save">Save</button></div>');
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);document.querySelector("#r-save").onclick=async()=>{const from=normPath(document.querySelector("#r-from").value),to=normPath(document.querySelector("#r-to").value);if(!from||!to)return toast("Both paths are required");const r=await db.from("seo_redirects").insert({user_id:user.id,site_id:site.id,from_path:from,to_path:to,status_code:Number(document.querySelector("#r-code").value),enabled:document.querySelector("#r-enabled").checked});if(r.error)toast(r.error.message);else{close();toast("Redirect created",true);render()}};
}
async function editRedirect(id){
 const r=await db.from("seo_redirects").select("*").eq("id",id).single();if(r.error)return toast(r.error.message);const x=r.data;
 modal('<div class="modal-head"><h3>Edit redirect</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><label>From path<input id="r-from" value="'+esc(x.from_path)+'"></label><label>To path<input id="r-to" value="'+esc(x.to_path)+'"></label><label>Status<select id="r-code"><option '+(x.status_code===301?"selected":"")+'>301</option><option '+(x.status_code===302?"selected":"")+'>302</option><option '+(x.status_code===307?"selected":"")+'>307</option><option '+(x.status_code===308?"selected":"")+'>308</option></select></label><label class="check"><input id="r-enabled" type="checkbox" '+(x.enabled?"checked":"")+'> Enabled</label><div class="modal-actions"><button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="r-save">Save</button></div>');
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);document.querySelector("#r-save").onclick=async()=>{const u=await db.from("seo_redirects").update({from_path:normPath(document.querySelector("#r-from").value),to_path:normPath(document.querySelector("#r-to").value),status_code:Number(document.querySelector("#r-code").value),enabled:document.querySelector("#r-enabled").checked}).eq("id",id);if(u.error)toast(u.error.message);else{close();toast("Redirect updated",true);render()}};
}
function normPath(v){let x=String(v||"").trim();if(!x)return "";if(!x.startsWith("/"))x="/"+x;return x.replace(/\s/g,"-")}
async function saveSecurity(e){e.preventDefault();const f=new FormData(e.target);const r=await db.from("site_security_settings").upsert({user_id:user.id,site_id:site.id,https_redirect:f.get("https_redirect")==="on",hsts_enabled:f.get("hsts_enabled")==="on",x_frame_options:f.get("x_frame_options"),referrer_policy:f.get("referrer_policy"),content_security_policy:f.get("content_security_policy")},{onConflict:"site_id"});if(r.error)toast(r.error.message);else{toast("Security saved",true);render()}}
async function savePerformance(e){e.preventDefault();const f=new FormData(e.target);const r=await db.from("site_performance_settings").upsert({user_id:user.id,site_id:site.id,minify_html:f.get("minify_html")==="on",minify_css:f.get("minify_css")==="on",minify_js:f.get("minify_js")==="on",lazy_images:f.get("lazy_images")==="on",preload_fonts:f.get("preload_fonts")==="on",compression:f.get("compression")==="on"},{onConflict:"site_id"});if(r.error)toast(r.error.message);else{toast("Performance saved",true);render()}}
async function remove(t,id){if(!confirm("Delete this item?"))return;const r=await db.from(t).delete().eq("id",id);if(r.error)toast(r.error.message);else render()}

async function newVerification(){
 const domains=await db.from("domains").select("*").eq("site_id",site.id).order("created_at",{ascending:false});if(domains.error)return toast(domains.error.message);
 if(!domains.data?.length)return toast("Add a domain first from Domains");
 modal('<div class="modal-head"><h3>Domain verification</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><label>Domain<select id="dv-domain">'+domains.data.map(d=>'<option value="'+d.id+'">'+esc(d.domain)+'</option>').join("")+'</select></label><label>Method<select id="dv-method"><option value="dns_txt">DNS TXT</option><option value="dns_cname">DNS CNAME</option><option value="html_file">HTML file</option><option value="meta_tag">Meta tag</option></select></label><div class="modal-actions"><button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="dv-create">Generate verification</button></div>');
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);document.querySelector("#dv-create").onclick=async()=>{const domainId=document.querySelector("#dv-domain").value,method=document.querySelector("#dv-method").value;const token="mpanel-"+crypto.randomUUID().replace(/-/g,"");const r=await db.from("domain_verifications").upsert({user_id:user.id,site_id:site.id,domain_id:domainId,method,token,status:"pending",last_checked_at:new Date().toISOString()},{onConflict:"domain_id,method"}).select().single();if(r.error)toast(r.error.message);else{close();showVerification(r.data,domains.data.find(d=>d.id===domainId)?.domain)}};
}
function showVerification(x,domain){
 const name=x.method==="dns_txt"?"_mpanel-verification."+domain:domain;
 const instructions=x.method==="dns_txt"?"Create a DNS TXT record for "+name+" with value:":x.method==="dns_cname"?"Create a DNS CNAME record for "+name+" pointing to:":x.method==="html_file"?"Upload an HTML file containing the token to the website root:":"Add this meta tag to the website head:";
 const value=x.method==="html_file"?'<meta name="mpanel-verification" content="'+x.token+'">':x.method==="meta_tag"?'<meta name="mpanel-verification" content="'+x.token+'">':x.token;
 modal('<div class="modal-head"><h3>Verification instructions</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><p>'+esc(instructions)+'</p><code class="verify-token">'+esc(value)+'</code><p class="tiny muted">DNS TXT/CNAME can be checked automatically. HTML/meta verification requires the file or tag to be reachable from the domain.</p><div class="modal-actions"><button class="btn secondary" data-close>Close</button><button class="btn primary" id="dv-check-now">Check now</button></div>');
 document.querySelectorAll("[data-close]").forEach(b=>b.onclick=close);document.querySelector("#dv-check-now").onclick=async()=>{close();await verifyRecord(x,domain)};
}
async function checkVerification(id){const r=await db.from("domain_verifications").select("*,domains(domain)").eq("id",id).single();if(r.error)return toast(r.error.message);await verifyRecord(r.data,r.data.domains?.domain)}
async function verifyRecord(x,domain){
 if(!["dns_txt","dns_cname"].includes(x.method))return toast("Automatic verification is available for DNS TXT/CNAME only");
 const name=x.method==="dns_txt"?"_mpanel-verification."+domain:domain;
 const type=x.method==="dns_txt"?"TXT":"CNAME";
 try{
  const res=await fetch("https://dns.google/resolve?name="+encodeURIComponent(name)+"&type="+type,{cache:"no-store"});
  if(!res.ok)throw Error("DNS lookup failed");
  const data=await res.json();const answers=(data.Answer||[]).map(a=>String(a.data||"").replace(/^"|"$/g,""));
  const ok=answers.some(v=>v===x.token||v.includes(x.token));
  const u=await db.from("domain_verifications").update({status:ok?"verified":"failed",verified_at:ok?new Date().toISOString():null,last_checked_at:new Date().toISOString()}).eq("id",x.id);
  if(u.error)throw u.error;toast(ok?"Domain verified successfully":"Verification record not found yet",ok);render();
 }catch(e){toast("DNS check failed: "+(e.message||e))}
}

async function health(){
 const rows=[];
 const run=async(key,fn)=>{try{await fn();rows.push([key,"pass","OK"])}catch(e){rows.push([key,"fail",String(e.message||e)])}};
 await run("site_access",async()=>{if(!site?.id)throw Error("No site")});
 await run("site_seo",async()=>{if(!settings.seo)throw Error("SEO settings missing")});
 await run("site_security",async()=>{if(!settings.security)throw Error("Security settings missing")});
 await run("site_performance",async()=>{if(!settings.performance)throw Error("Performance settings missing")});
 await run("media_storage",async()=>{const r=await db.storage.from("mpanel-media").list(user.id,{limit:1});if(r.error)throw r.error});
 await run("media_library",async()=>{const r=await db.from("media_assets").select("id",{count:"exact",head:true}).eq("site_id",site.id);if(r.error)throw r.error});
 await run("builder",async()=>{const r=await db.from("builder_templates").select("id",{count:"exact",head:true}).eq("site_id",site.id);if(r.error||!r.count)throw Error("No builder template")});
 await run("redirects",async()=>{const r=await db.from("seo_redirects").select("id",{count:"exact",head:true}).eq("site_id",site.id);if(r.error)throw r.error});
 await run("domain_verification",async()=>{const r=await db.from("domains").select("id",{count:"exact",head:true}).eq("site_id",site.id);if(r.error)throw r.error});
 await run("github_integration",async()=>{const r=await db.from("site_integrations").select("id").eq("site_id",site.id).eq("provider","github").maybeSingle();if(r.error||!r.data)throw Error("GitHub integration missing")});
 await run("analytics",async()=>{const r=await db.from("site_analytics_settings").select("id").eq("site_id",site.id).maybeSingle();if(r.error)throw r.error;if(!r.data)throw Error("Analytics migration/settings missing")});
 await run("build_output",async()=>{if(!settings.seo?.site_title)throw Error("Site SEO title missing")});
 for(const [check_key,status,message] of rows)await db.from("system_checks").upsert({user_id:user.id,site_id:site.id,check_key,status,message,last_checked_at:new Date().toISOString()},{onConflict:"site_id,check_key"});
 toast("Full production preflight completed",true);render();
}
async function boot(){css();await session();mount()}boot();