import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL.trim().replace(/\/$/, ""),SUPABASE_ANON_KEY.trim());
const state={user:null,sites:[],domains:[],seo:[],files:[],selectedSite:null,selectedFile:null,view:"dashboard"};
const $=s=>document.querySelector(s);
const $=s=>Array.from(document.querySelectorAll(s));
const each=(selector,callback)=>{
  const nodes=document.querySelectorAll(selector);
  for(let i=0;i<nodes.length;i++)callback(nodes[i],i,nodes);
};
window.addEventListener("error",event=>{
  console.error("[mPanel runtime error]",event.message,event.filename,event.lineno,event.colno,event.error);
});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
function icons(){try{if(window.lucide&&typeof window.lucide.createIcons==="function")window.lucide.createIcons()}catch(error){console.warn("mPanel icon rendering skipped:",error)}}
const dt=v=>v?new Date(v).toLocaleDateString():"—";

function getAuthRedirectUrl(){
  const url=new URL(window.location.href);
  url.hash="";
  url.search="";
  return url.href;
}
function cleanAuthHash(){
  const hash=window.location.hash;
  if(!hash)return false;
  const params=new URLSearchParams(hash.slice(1));
  return params.has("access_token")||params.has("refresh_token")||params.has("type")||params.has("error");
}
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
 state.sites=a.data||[];state.domains=b.data||[];state.seo=c.data||[];if(!state.selectedSite||!state.sites.some(x=>x.id===state.selectedSite.id))state.selectedSite=state.sites[0]||null;renderAll();
}
function renderAll(){renderDashboard();renderManager();renderFiles();renderTheme();renderSites();renderDomains();renderSeo();renderMonitoring();renderSettings();$("#plan-usage").textContent=state.sites.length+" / 3 sites";icons()}

function renderDashboard(){
 $("#view-dashboard").innerHTML='<div class="grid stats">'+
 stat("Total sites",state.sites.length,"globe-2")+stat("Active sites",state.sites.filter(s=>s.status==="active").length,"check-circle-2")+stat("Domains",state.domains.length,"link-2")+stat("SEO checks",state.seo.length,"search-check")+
 '</div><div class="grid two-col"><section class="card"><div class="section-head"><h3>Recent websites</h3><button class="btn secondary" data-go="sites">View all</button></div>'+
 (state.sites.length?'<div class="site-list">'+state.sites.slice(0,5).map(siteRow).join("")+'</div>':'<div class="empty"><i data-lucide="globe"></i><p>No websites yet.</p><button class="btn primary" id="dash-add-site">Add your first site</button></div>')+
 '</section><section class="card"><div class="section-head"><h3>Free plan</h3><span class="badge success">Active</span></div><p class="muted">Manage up to 3 websites with domains, SEO tasks and basic monitoring.</p><div class="progress"><i style="width:'+Math.min(100,state.sites.length/3*100)+'%"></i></div><p class="tiny muted">'+state.sites.length+' of 3 website slots used.</p></section></div>';
 $("#dash-add-site")?.addEventListener("click",()=>openSiteModal());
 each("[data-go]",b=>b.onclick=()=>showView(b.dataset.go));
}

function renderSites(){
 $("#view-sites").innerHTML='<div class="toolbar"><div><h3>My Sites</h3><p class="muted">Manage your websites and basic settings.</p></div><button class="btn primary" id="add-site"><i data-lucide="plus"></i>Add site</button></div><div class="card">'+
 (state.sites.length?'<div class="site-list">'+state.sites.map(s=>'<div class="site-row"><div class="site-main"><div class="site-favicon"><i data-lucide="globe-2"></i></div><div><div class="site-name">'+esc(s.name)+'</div><div class="site-url">'+esc(s.url)+'</div><small class="muted">Added '+dt(s.created_at)+'</small></div></div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="badge '+(s.status==="active"?"success":"warning")+'">'+esc(s.status||"active")+'</span><button class="btn secondary manage-site" data-id="'+s.id+'"><i data-lucide="panel-top"></i>Manage</button><button class="icon-btn edit-site" data-id="'+s.id+'" title="Edit"><i data-lucide="pencil"></i></button><button class="icon-btn delete-site" data-id="'+s.id+'" title="Delete"><i data-lucide="trash-2"></i></button></div></div>').join("")+'</div>':
 '<div class="empty"><i data-lucide="globe-2"></i><h3>No websites</h3><p>Add a website to start.</p></div>')+'</div>';
 $("#add-site").onclick=()=>openSiteModal();
 each(".manage-site",b=>b.onclick=()=>openWebsiteManager(b.dataset.id));
 each(".edit-site",b=>b.onclick=()=>openSiteModal(state.sites.find(s=>s.id===b.dataset.id)));
 each(".delete-site",b=>b.onclick=()=>deleteSite(b.dataset.id));
}

async function ensureWorkspaceFiles(site){
 if(!site)return;
 const {data,error}=await supabase.from("site_files").select("*").eq("site_id",site.id).order("path");
 if(error){toast(authError(error));return}
 if(!data?.length){
  const defaults=[
   {user_id:state.user.id,site_id:site.id,path:"index.html",content:"<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>"+esc(site.name)+"</title>\n<link rel=\"stylesheet\" href=\"style.css\">\n</head>\n<body>\n<main>\n<h1>"+esc(site.name)+"</h1>\n<p>Welcome to your website. Edit this page from mPanel.</p>\n</main>\n<script src=\"script.js\"></script>\n</body>\n</html>",mime_type:"text/html",is_protected:true},
   {user_id:state.user.id,site_id:site.id,path:"style.css",content:"body{font-family:system-ui,sans-serif;margin:0;padding:48px;background:#f8fafc;color:#0f172a}main{max-width:900px;margin:auto;background:#fff;padding:40px;border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.08)}h1{font-size:42px;margin-top:0}",mime_type:"text/css",is_protected:false},
   {user_id:state.user.id,site_id:site.id,path:"script.js",content:"document.documentElement.dataset.mpanel=\"preview\";",mime_type:"text/javascript",is_protected:false}
  ];
  const {error:insertError}=await supabase.from("site_files").insert(defaults);
  if(insertError)toast(authError(insertError));
  const again=await supabase.from("site_files").select("*").eq("site_id",site.id).order("path");
  state.files=again.data||[];
 }else state.files=data;
 if(!state.selectedFile||!state.files.some(x=>x.id===state.selectedFile.id))state.selectedFile=state.files.find(x=>x.path==="index.html")||state.files[0]||null;
 renderFiles();renderTheme();updatePreview();
}
function openWebsiteManager(id){
 state.selectedSite=state.sites.find(s=>s.id===id)||state.sites[0]||null;
 if(!state.selectedSite){toast("Add a website first.");return}
 showView("manager");
 ensureWorkspaceFiles(state.selectedSite);
}
function managerTab(view){
 if(!state.selectedSite){toast("Select a website first.");showView("sites");return}
 showView(view);ensureWorkspaceFiles(state.selectedSite);
}
function renderManager(){
 const s=state.selectedSite;
 if(!s){$("#view-manager").innerHTML='<div class="card workspace-empty"><div><i data-lucide="panel-top"></i><h3>Select a website</h3><p class="muted">Add a website first, then open Website Manager.</p><button class="btn primary" data-go="sites">Go to My Sites</button></div></div>';$("#view-manager").querySelector("[data-go]")?.addEventListener("click",()=>showView("sites"));return}
 $("#view-manager").innerHTML='<div class="workspace-head"><div class="workspace-title"><div class="workspace-icon"><i data-lucide="panel-top"></i></div><div><span class="eyebrow">WEBSITE CONTROL CENTER</span><h3 style="margin:3px 0">'+esc(s.name)+'</h3><div class="site-url">'+esc(s.url)+'</div></div></div><div class="workspace-actions"><span class="connection-pill"><i></i>Managed workspace</span><button class="btn secondary" id="manager-refresh"><i data-lucide="refresh-cw"></i>Refresh</button></div></div>'+
 '<div class="card" style="margin-bottom:18px"><div class="workspace-tabs"><button class="btn active" data-workspace="manager">Overview</button><button class="btn secondary" data-workspace="files"><i data-lucide="folder-code"></i>Files</button><button class="btn secondary" data-workspace="theme"><i data-lucide="palette"></i>Theme & Preview</button><button class="btn secondary" id="manager-site-settings"><i data-lucide="settings"></i>Site settings</button></div></div>'+
 '<div class="manager-cards"><div class="manager-card"><i data-lucide="folder-code"></i><h4>File Manager</h4><p>Create, edit, rename and remove text files stored for this website.</p><button class="btn secondary" style="margin-top:14px" data-workspace="files">Open files</button></div><div class="manager-card"><i data-lucide="palette"></i><h4>Theme Editor</h4><p>Edit HTML, CSS and JavaScript with an isolated live preview.</p><button class="btn secondary" style="margin-top:14px" data-workspace="theme">Open editor</button></div><div class="manager-card"><i data-lucide="history"></i><h4>Version safety</h4><p>Every saved file change creates a server-side previous version in Supabase.</p><button class="btn secondary" style="margin-top:14px" id="manager-history">View history</button></div></div>'+
 '<div class="grid two-col" style="margin-top:18px"><section class="card"><h3>Website status</h3><p class="muted">This workspace is connected to your mPanel database. Publishing to an external host requires a future GitHub/deployment connector.</p><div class="site-list" style="margin-top:14px"><div class="site-row"><span>Files</span><strong>'+state.files.length+'</strong></div><div class="site-row"><span>Last updated</span><strong>'+dt(state.files.reduce((a,b)=>new Date(a.updated_at)>new Date(b.updated_at)?a:b,{updated_at:s.updated_at}).updated_at)+'</strong></div></div></section><section class="card"><h3>Safe editing</h3><p class="muted">index.html is protected from deletion. CSS and JavaScript can be changed and previewed before you save.</p><span class="badge success">Supabase RLS enabled</span></section></div>';
 each("[data-workspace]",b=>b.onclick=()=>managerTab(b.dataset.workspace));
 $("#manager-refresh").onclick=()=>ensureWorkspaceFiles(state.selectedSite);
 $("#manager-site-settings").onclick=()=>openSiteModal(s);
 $("#manager-history").onclick=()=>openFileHistory();
}
async function loadSiteFiles(){
 if(!state.selectedSite){state.files=[];return}
 const {data,error}=await supabase.from("site_files").select("*").eq("site_id",state.selectedSite.id).order("path");
 if(error){toast(authError(error));state.files=[]}else state.files=data||[];
}
function renderFiles(){
 const s=state.selectedSite;
 if(!s){$("#view-files").innerHTML='<div class="card workspace-empty"><div><h3>No website selected</h3><button class="btn primary" id="files-go-sites">Choose a website</button></div></div>';$("#files-go-sites")?.addEventListener("click",()=>showView("sites"));return}
 const file=state.selectedFile;
 $("#view-files").innerHTML='<div class="workspace-head"><div><span class="eyebrow">FILE MANAGER</span><h3 style="margin:3px 0">'+esc(s.name)+'</h3><p class="muted">Edit website source files safely with version snapshots.</p></div><div class="workspace-actions"><button class="btn secondary" id="files-back"><i data-lucide="arrow-left"></i>Overview</button><button class="btn primary" id="new-file"><i data-lucide="file-plus-2"></i>New file</button></div></div>'+
 '<div class="workspace-grid"><aside class="file-tree"><div class="file-tree-head"><h3>Website files</h3><span class="badge neutral">'+state.files.length+'</span></div><input class="file-search" id="file-search" placeholder="Search files…"><div class="file-list" id="file-list">'+state.files.map(x=>'<button class="file-item '+(file?.id===x.id?"active":"")+'" data-file-id="'+x.id+'"><i data-lucide="'+(x.mime_type==="text/html"?"file-code-2":x.mime_type==="text/css"?"file-cog":"file-text")+'"></i><span>'+esc(x.path)+'</span>'+(x.is_protected?'<span class="protected-file">PROTECTED</span>':"")+'</button>').join("")+'</div></aside>'+
 '<section class="editor-card"><div class="editor-toolbar"><div class="editor-file">'+esc(file?.path||"Select a file")+'</div><div class="editor-actions">'+(file?'<button class="btn secondary" id="history-file"><i data-lucide="history"></i>History</button><button class="btn primary" id="save-file"><i data-lucide="save"></i>Save</button>'+(!file.is_protected?'<button class="btn secondary danger-text" id="delete-file"><i data-lucide="trash-2"></i>Delete</button>':""):"")+'</div></div><textarea id="code-editor" class="code-editor" spellcheck="false" '+(file?"":"disabled")+'>'+esc(file?.content||"")+'</textarea></section>'+
 '<aside class="preview-card"><div class="preview-head"><strong>Live preview</strong><div class="preview-tools"><button class="icon-btn" id="refresh-preview" title="Refresh"><i data-lucide="refresh-cw"></i></button><button class="icon-btn" id="open-preview" title="Open preview"><i data-lucide="external-link"></i></button></div></div><iframe id="workspace-preview" class="preview-frame" sandbox="allow-scripts"></iframe></aside></div>';
 $("#files-back").onclick=()=>showView("manager");
 $("#new-file").onclick=openNewFileModal;
 each(".file-item",b=>{state.selectedFile=state.files.find(x=>x.id===b.dataset.fileId)||null;renderFiles();updatePreview()});
 $("#file-search").oninput=e=>{each(".file-item",b=>b.style.display=b.textContent.toLowerCase().includes(e.target.value.toLowerCase())?"flex":"none")};
 $("#save-file")?.addEventListener("click",saveSelectedFile);
 $("#history-file")?.addEventListener("click",openFileHistory);
 $("#delete-file")?.addEventListener("click",deleteSelectedFile);
 $("#refresh-preview")?.addEventListener("click",updatePreview);
 $("#open-preview")?.addEventListener("click",()=>{const src=$("#workspace-preview")?.srcdoc;if(src)window.open(URL.createObjectURL(new Blob([src],{type:"text/html"})),"_blank","noopener")});
}
async function deleteSelectedFile(){
 if(!state.selectedFile||state.selectedFile.is_protected)return;
 if(!confirm("Delete "+state.selectedFile.path+"? This cannot be undone."))return;
 const id=state.selectedFile.id;
 const {error}=await supabase.from("site_files").delete().eq("id",id);
 if(error){toast(authError(error));return}
 await supabase.rpc("write_audit_log",{p_action:"delete_file",p_entity_type:"site_file",p_entity_id:id,p_details:{path:state.selectedFile.path,site_id:state.selectedFile.site_id}});
 state.files=state.files.filter(x=>x.id!==id);state.selectedFile=state.files.find(x=>x.path==="index.html")||state.files[0]||null;
 toast("File deleted","success");renderFiles();renderTheme();renderManager();updatePreview();
}
async function saveSelectedFile(){
 if(!state.selectedFile)return;
 const content=$("#code-editor").value;
 const {data,error}=await supabase.from("site_files").update({content,updated_at:new Date().toISOString()}).eq("id",state.selectedFile.id).select().single();
 if(error){toast(authError(error));return}
 state.selectedFile=data;const i=state.files.findIndex(x=>x.id===data.id);if(i>=0)state.files[i]=data;
 await supabase.rpc("write_audit_log",{p_action:"update_file",p_entity_type:"site_file",p_entity_id:data.id,p_details:{path:data.path,site_id:data.site_id}});
 toast("File saved and previous version recorded","success");renderFiles();renderTheme();renderManager();updatePreview();
}
function previewDocument(){
 const html=state.files.find(x=>x.path==="index.html")?.content||"";
 const css=state.files.find(x=>x.path==="style.css")?.content||"";
 const js=state.files.find(x=>x.path==="script.js")?.content||"";
 const withCss=html.replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>').replace('<link rel="stylesheet" href="./style.css">','<style>'+css+'</style>');
 return withCss.replace('<script src="script.js"></script>','<script>'+js+'</script>').replace('<script src="./script.js"></script>','<script>'+js+'</script>');
}
function updatePreview(){
 const frame=$("#workspace-preview")||$("#theme-preview");if(!frame)return;
 frame.srcdoc=previewDocument();
}
function openNewFileModal(){
 $("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal file-modal"><div class="modal-head"><h3>New website file</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="new-file-form"><label>File path<input name="path" required pattern="[A-Za-z0-9_./-]+" placeholder="pages/about.html"></label><label style="margin-top:14px">Type<select name="mime"><option value="text/html">HTML</option><option value="text/css">CSS</option><option value="text/javascript">JavaScript</option><option value="text/plain">Text</option></select></label><label style="margin-top:14px">Initial content<textarea name="content" placeholder="Start writing…"></textarea></label><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Create file</button></div></form></div></div>';
 icons();$("#close-modal").onclick=closeModal;$("#cancel-modal").onclick=closeModal;
 $("#new-file-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const path=f.get("path").trim().replace(/^\/+/,"");if(state.files.some(x=>x.path===path)){toast("A file with this path already exists.");return}const {data,error}=await supabase.from("site_files").insert({user_id:state.user.id,site_id:state.selectedSite.id,path,content:f.get("content"),mime_type:f.get("mime")}).select().single();if(error){toast(authError(error));return}state.files.push(data);state.files.sort((a,b)=>a.path.localeCompare(b.path));state.selectedFile=data;closeModal();renderFiles();renderTheme();updatePreview();toast("File created","success")};
}
async function openFileHistory(){
 const file=state.selectedFile;
 if(!file){toast("Select a file first.");return}
 const {data,error}=await supabase.from("site_file_versions").select("*").eq("file_id",file.id).order("created_at",{ascending:false}).limit(10);
 if(error){toast(authError(error));return}
 $("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Version history — '+esc(file.path)+'</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div>'+(data?.length?'<div class="site-list">'+data.map(v=>'<div class="site-row"><div><strong>'+dt(v.created_at)+'</strong><small class="muted" style="display:block">Previous saved version</small></div><button class="btn secondary restore-version" data-id="'+v.id+'">Restore</button></div>').join("")+'</div>':'<div class="empty">No previous versions yet. Save the file to create one.</div>')+'</div></div>';
 icons();$("#close-modal").onclick=closeModal;
 each(".restore-version",b=>b.onclick=async()=>{const v=data.find(x=>x.id===b.dataset.id);if(!v)return;if(!confirm("Restore this previous version? The current content will be snapshotted first."))return;const {data:updated,error:restoreError}=await supabase.from("site_files").update({content:v.content,updated_at:new Date().toISOString()}).eq("id",file.id).select().single();if(restoreError){toast(authError(restoreError));return}state.selectedFile=updated;await loadSiteFiles();closeModal();renderFiles();renderTheme();updatePreview();toast("Version restored","success")});
}
function renderTheme(){
 const s=state.selectedSite;
 if(!s){$("#view-theme").innerHTML='<div class="card workspace-empty"><div><h3>No website selected</h3><button class="btn primary" id="theme-go-sites">Choose a website</button></div></div>';$("#theme-go-sites")?.addEventListener("click",()=>showView("sites"));return}
 const options=["index.html","style.css","script.js"].filter(p=>state.files.some(x=>x.path===p));
 const file=state.selectedFile&&options.includes(state.selectedFile.path)?state.selectedFile:(state.files.find(x=>x.path==="index.html")||state.files[0]);
 state.selectedFile=file||null;
 $("#view-theme").innerHTML='<div class="workspace-head"><div><span class="eyebrow">THEME EDITOR</span><h3 style="margin:3px 0">'+esc(s.name)+'</h3><p class="muted">Edit the core template files and see the result before saving.</p></div><div class="workspace-actions"><button class="btn secondary" id="theme-back"><i data-lucide="arrow-left"></i>Overview</button><button class="btn primary" id="theme-save"><i data-lucide="save"></i>Save changes</button></div></div>'+
 '<div class="workspace-grid"><aside class="file-tree"><div class="file-tree-head"><h3>Theme files</h3></div><div class="file-list">'+options.map(p=>'<button class="file-item '+(file?.path===p?"active":"")+'" data-theme-file="'+p+'"><i data-lucide="'+(p.endsWith(".html")?"file-code-2":p.endsWith(".css")?"file-cog":"file-text")+'"></i><span>'+p+'</span></button>').join("")+'</div><div class="card" style="margin-top:12px;padding:12px"><small class="muted">Tip: edit HTML structure, CSS design or JavaScript behavior. The preview is sandboxed and does not publish changes.</small></div></aside>'+
 '<section class="editor-card"><div class="editor-toolbar"><div class="editor-file">'+esc(file?.path||"")+'</div><div class="editor-actions"><span class="badge neutral">Live draft</span></div></div><textarea id="theme-editor" class="code-editor" spellcheck="false">'+esc(file?.content||"")+'</textarea></section>'+
 '<aside class="preview-card"><div class="preview-head"><strong>Live preview</strong><button class="icon-btn" id="theme-refresh"><i data-lucide="refresh-cw"></i></button></div><iframe id="theme-preview" class="preview-frame" sandbox="allow-scripts"></iframe></aside></div>';
 $("#theme-back").onclick=()=>showView("manager");
 each("#view-theme [data-theme-file]",b=>b.onclick=()=>{state.selectedFile=state.files.find(x=>x.path===b.dataset.themeFile)||null;renderTheme();updatePreview()});
 $("#theme-save").onclick=saveThemeFile;
 $("#theme-editor").oninput=()=>{const draft=state.files.find(x=>x.id===state.selectedFile?.id);if(draft)draft.content=$("#theme-editor").value;updatePreview()};
 $("#theme-refresh").onclick=updatePreview;updatePreview();
}
async function saveThemeFile(){
 if(!state.selectedFile)return;
 const content=$("#theme-editor").value;
 const {data,error}=await supabase.from("site_files").update({content,updated_at:new Date().toISOString()}).eq("id",state.selectedFile.id).select().single();
 if(error){toast(authError(error));return}
 state.selectedFile=data;const i=state.files.findIndex(x=>x.id===data.id);if(i>=0)state.files[i]=data;
 await supabase.rpc("write_audit_log",{p_action:"update_theme_file",p_entity_type:"site_file",p_entity_id:data.id,p_details:{path:data.path,site_id:data.site_id}});
 toast("Theme changes saved","success");renderTheme();renderManager();updatePreview();
}

async function deleteSite(id){if(!confirm("Delete this website and related data?"))return;const{error}=await supabase.from("sites").delete().eq("id",id);if(error)toast(authError(error));else{toast("Website deleted","success");await loadData()}}
function openSiteModal(site=null){
 $("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>'+(site?"Edit website":"Add website")+'</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="site-form" class="form-grid"><label>Name<input name="name" required value="'+esc(site?.name||"")+'" placeholder="My Website"></label><label>URL<input name="url" type="url" required value="'+esc(site?.url||"")+'" placeholder="https://example.com"></label><label class="full-field">Description<textarea name="description" rows="4">'+esc(site?.description||"")+'</textarea></label><label>Status<select name="status"><option value="active" '+(site?.status==="active"?"selected":"")+' >Active</option><option value="paused" '+(site?.status==="paused"?"selected":"")+' >Paused</option></select></label><div></div><div class="modal-actions full-field"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Save website</button></div></form></div></div>';
 icons();$("#close-modal").onclick=closeModal;$("#cancel-modal").onclick=closeModal;
 $("#site-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const p={name:f.get("name"),url:f.get("url"),description:f.get("description"),status:f.get("status")};const q=site?supabase.from("sites").update(p).eq("id",site.id):supabase.from("sites").insert({...p,user_id:state.user.id});const{error}=await q;if(error)toast(error.message);else{toast(site?"Website updated":"Website added");closeModal();loadData()}};
}
function closeModal(){$("#modal-root").innerHTML=""}

function renderDomains(){
 $("#view-domains").innerHTML='<div class="toolbar"><div><h3>Domains</h3><p class="muted">Track domains connected to your websites.</p></div><button class="btn primary" id="add-domain"><i data-lucide="plus"></i>Add domain</button></div><div class="card table-wrap"><table class="table"><thead><tr><th>Domain</th><th>Website</th><th>Status</th><th>Added</th><th></th></tr></thead><tbody>'+
 (state.domains.length?state.domains.map(d=>'<tr><td><strong>'+esc(d.domain)+'</strong></td><td>'+esc(d.sites?.name||"—")+'</td><td><span class="badge '+(d.status==="verified"?"success":"warning")+'">'+esc(d.status||"pending")+'</span></td><td>'+dt(d.created_at)+'</td><td><button class="icon-btn delete-domain" data-id="'+d.id+'"><i data-lucide="trash-2"></i></button></td></tr>').join(""):'<tr><td colspan="5" class="empty">No domains added.</td></tr>')+'</tbody></table></div>';
 $("#add-domain").onclick=openDomainModal;each(".delete-domain",b=>b.onclick=()=>deleteDomain(b.dataset.id));
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
 each("[data-seo]",c=>c.onchange=async()=>{const{error}=await supabase.from("seo_checks").update({completed:c.checked}).eq("id",c.dataset.seo);if(error)toast(error.message);else loadData()});
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
function showView(v){state.view=v;each(".view",x=>x.classList.add("hidden"));$("#view-"+v).classList.remove("hidden");each(".nav-item[data-view]",b=>b.classList.toggle("active",b.dataset.view===v));const n={dashboard:"Dashboard",manager:"Website Manager",files:"File Manager",theme:"Theme Editor",sites:"My Sites",domains:"Domains",seo:"SEO",monitoring:"Monitoring",settings:"Settings"};$("#page-title").textContent=n[v]||"Dashboard";$("#sidebar").classList.remove("open");icons()}
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
  const redirectTo=getAuthRedirectUrl();
  const r=signUp
   ?await supabase.auth.signUp({email,password,options:{emailRedirectTo:redirectTo,data:{email}}})
   :await supabase.auth.signInWithPassword({email,password});
  if(r.error){toast(authError(r.error));return}
  if(signUp&&!r.data.session){toast("Account created. Check your email to confirm the account.","success");return}
  await handleAuth();
 }catch(error){toast(authError(error))}
 finally{btn.disabled=false;btn.textContent=signUp?"Create account":"Sign in"}
};
$("#logout-btn").onclick=async()=>{await supabase.auth.signOut();state.user=null;handleAuth()};
each(".nav-item[data-view]",b=>b.onclick=()=>showView(b.dataset.view));
$("#theme-btn").onclick=toggleTheme;$("#menu-btn").onclick=()=>$("#sidebar").classList.toggle("open");$("#profile-btn").onclick=()=>showView("settings");

async function handleAuth(){
 try{
  const{data:{session},error}=await supabase.auth.getSession();
  if(error)throw error;
  if(session){
   state.user=session.user;
   if(cleanAuthHash()) history.replaceState({},document.title,getAuthRedirectUrl());
   $("#auth-view").classList.add("hidden");$("#app-view").classList.remove("hidden");$("#avatar-letter").textContent=(session.user.email||"U")[0].toUpperCase();await loadData();showView("dashboard")}
  else{$("#auth-view").classList.remove("hidden");$("#app-view").classList.add("hidden")}
 }catch(error){
  state.user=null;
  $("#auth-view").classList.remove("hidden");$("#app-view").classList.add("hidden");
  toast(authError(error));
 }
}
supabase.auth.onAuthStateChange((event,session)=>{setTimeout(()=>{if(session&&!state.user)handleAuth();if(event==="SIGNED_OUT"){state.user=null;handleAuth()}},0)});
handleAuth().catch(error=>toast(authError(error)));icons();