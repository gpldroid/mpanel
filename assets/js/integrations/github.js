const API="https://api.github.com";
const TEXT_EXT=new Set(["html","htm","css","js","mjs","cjs","json","xml","txt","md","mdx","svg","yml","yaml","toml","ini","env.example","ts","tsx","jsx","vue","astro","php","py","rb","java","go","rs","sql"]);
const isTextPath=path=>{const n=path.toLowerCase().split("/").pop();if(!n)return false;const i=n.lastIndexOf(".");return i>0&&TEXT_EXT.has(n.slice(i+1))||n.startsWith(".")||n.endsWith(".example")};
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
let ctx=null;

async function githubRequest(path,options={}){
  if(!ctx?.state?.github?.token)throw new Error("GitHub is not connected. Connect GitHub first.");
  const headers={Accept:"application/vnd.github+json",Authorization:"Bearer "+ctx.state.github.token,"X-GitHub-Api-Version":"2022-11-28",...(options.headers||{})};
  const r=await fetch(API+path,{...options,headers});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.message||("GitHub API error "+r.status));
  return data;
}
function tokenFromSession(session){return session?.provider_token||null}
async function syncSession(session){
  if(session?.provider_token){
    ctx.state.github.token=session.provider_token;
    try{const u=await githubRequest("/user");ctx.state.github.connected=true;ctx.state.github.login=u.login}catch{ctx.state.github.connected=false}
  }else if(!ctx.state.github.token){
    ctx.state.github.connected=false;ctx.state.github.login=null;
  }
  renderGitHub(ctx.state);
}
async function connectGitHub(){
  try{
    const redirectTo=window.location.href.split("#")[0];
    const {data,error}=await ctx.supabase.auth.signInWithOAuth({
      provider:"github",
      options:{redirectTo,scopes:"repo read:user user:email"}
    });
    if(error)throw error;
    if(data?.url)window.location.href=data.url;
  }catch(e){ctx.toast("GitHub connection failed: "+e.message)}
}
async function disconnectGitHub(){
  ctx.state.github={connected:false,login:null,token:null,repo:null};
  ctx.toast("GitHub disconnected","success");
  renderGitHub(ctx.state);
}
async function loadRepos(){
  const repos=await githubRequest("/user/repos?per_page=100&sort=updated&direction=desc");
  return repos;
}
function repoOptions(repos,current){
  return repos.map(r=>'<option value="'+esc(r.full_name)+'" data-default="'+esc(r.default_branch||"main")+'" '+(current===r.full_name?"selected":"")+'>'+esc(r.full_name)+(r.private?" · private":"")+'</option>').join("");
}
async function openGitHubImport(){
  if(!ctx.state.github.token){ctx.showView("github");ctx.toast("Connect your GitHub account first.");return}
  const site=ctx.state.selectedSite;
  if(!site){ctx.showView("sites");ctx.toast("Select a website first.");return}
  try{
    const repos=await loadRepos();
    ctx.openModal('<div class="modal-backdrop"><div class="modal github-modal"><div class="modal-head"><div><h3>Import project from GitHub</h3><p class="muted">Import text source files into the selected mPanel website.</p></div><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="github-import-form"><label>Repository<select name="repo">'+repoOptions(repos,ctx.state.github.repo?.full_name||"")+'</select></label><label style="margin-top:14px">Branch<input name="branch" value="" placeholder="default branch"></label><div class="github-import-info"><span class="badge neutral">HTML / CSS / JS / JSON / Markdown</span><span class="badge neutral">Binary assets are skipped</span></div><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Import project</button></div></form></div></div>');
    ctx.icons();
    const form=document.querySelector("#github-import-form"),select=form.elements.repo,branch=form.elements.branch;
    const setBranch=()=>{const o=select.options[select.selectedIndex];branch.value=o?.dataset.default||"main"};
    select.onchange=setBranch;setBranch();
    document.querySelector("#close-modal").onclick=ctx.closeModal;document.querySelector("#cancel-modal").onclick=ctx.closeModal;
    form.onsubmit=async e=>{
      e.preventDefault();const full=select.value,br=branch.value.trim()||"main";const [owner,name]=full.split("/");
      const tree=await githubRequest("/repos/"+owner+"/"+name+"/git/trees/"+encodeURIComponent(br)+"?recursive=1");
      const entries=(tree.tree||[]).filter(x=>x.type==="blob"&&isTextPath(x.path)).slice(0,400);
      if(!entries.length)throw new Error("No supported text files were found in this repository.");
      const files=[];
      for(let i=0;i<entries.length;i++){
        const blob=await githubRequest("/repos/"+owner+"/"+name+"/git/blobs/"+entries[i].sha);
        if(blob.encoding!=="base64")continue;
        try{files.push({user_id:ctx.state.user.id,site_id:site.id,path:entries[i].path,content:decodeBase64(blob.content),mime_type:mime(entries[i].path),is_protected:entries[i].path==="index.html"})}catch{}
      }
      const existing=await ctx.supabase.from("site_files").select("id,path").eq("site_id",site.id);
      if(existing.error)throw existing.error;
      const byPath=new Map((existing.data||[]).map(x=>[x.path,x.id]));
      for(let i=0;i<files.length;i++){
        const f=files[i],id=byPath.get(f.path);
        const payload={content:f.content,mime_type:f.mime_type,is_protected:f.is_protected,updated_at:new Date().toISOString()};
        const q=id?ctx.supabase.from("site_files").update(payload).eq("id",id):ctx.supabase.from("site_files").insert(f);
        const res=await q;if(res.error)throw res.error;
      }
      ctx.state.github.repo={full_name:full,branch:br};
      await ctx.supabase.from("sites").update({updated_at:new Date().toISOString()}).eq("id",site.id);
      ctx.closeModal();ctx.toast("Imported "+files.length+" text files from "+full,"success");
      await ctx.reloadSiteFiles();ctx.renderAll();ctx.showView("files");
    };
  }catch(e){ctx.toast("GitHub import failed: "+e.message)}
}
function decodeBase64(v){const bin=atob(String(v).replace(/\s/g,""));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
function encodeBase64(v){const bytes=new TextEncoder().encode(v);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
function mime(path){const p=path.toLowerCase();return p.endsWith(".html")||p.endsWith(".htm")?"text/html":p.endsWith(".css")?"text/css":p.endsWith(".js")||p.endsWith(".mjs")?"text/javascript":p.endsWith(".json")?"application/json":p.endsWith(".svg")?"image/svg+xml":"text/plain"}
async function pushSiteToGitHub(){
  const site=ctx.state.selectedSite,repo=ctx.state.github.repo;
  if(!site){ctx.toast("Select a website first.");return}
  if(!repo){ctx.toast("Choose a GitHub repository first.");ctx.showView("github");return}
  if(!confirm("Push the current mPanel files to "+repo.full_name+" on branch "+repo.branch+"?"))return;
  try{
    const [owner,name]=repo.full_name.split("/"),files=ctx.state.files.filter(x=>isTextPath(x.path));
    for(const f of files){
      let sha;
      try{const old=await githubRequest("/repos/"+owner+"/"+name+"/contents/"+f.path+"?ref="+encodeURIComponent(repo.branch));sha=old.sha}catch{}
      const body={message:"mPanel: update "+f.path,content:encodeBase64(f.content),branch:repo.branch};if(sha)body.sha=sha;
      await githubRequest("/repos/"+owner+"/"+name+"/contents/"+f.path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    }
    ctx.toast("Pushed "+files.length+" files to GitHub","success");
  }catch(e){ctx.toast("GitHub push failed: "+e.message)}
}
function renderGitHub(state){
  const el=document.querySelector("#view-github");if(!el)return;
  const connected=!!state.github.connected;
  el.innerHTML='<div class="toolbar"><div><h3>GitHub</h3><p class="muted">Connect GitHub to import repositories into File Manager and push edits back.</p></div><div class="workspace-actions">'+(connected?'<span class="connection-pill"><i></i>'+esc(state.github.login||"Connected")+'</span><button class="btn secondary" id="github-disconnect">Disconnect</button>':'<button class="btn primary" id="github-connect"><i data-lucide="github"></i>Connect GitHub</button>')+'</div></div>'+
  '<div class="grid two-col"><section class="card"><h3>Repository workspace</h3><p class="muted">A GitHub connection lets mPanel read repository trees, import source files and write edited text files. No GitHub token is stored in the database.</p>'+
  (connected?'<div class="github-repo-box"><span class="badge success">Connected</span><p class="tiny muted">Account: '+esc(state.github.login||"GitHub user")+'</p><button class="btn secondary" id="github-import-main"><i data-lucide="download"></i>Import project</button><button class="btn primary" id="github-push-main"><i data-lucide="upload"></i>Push current files</button></div>':'<div class="empty"><i data-lucide="github"></i><p>Connect GitHub to unlock repository access.</p></div>')+
  '</section><section class="card"><h3>Security</h3><ul class="muted"><li>OAuth is handled by Supabase Auth.</li><li>Tokens are kept only in the browser session.</li><li>Supabase database stores repository metadata, not the GitHub token.</li><li>Write access requires GitHub authorization with repository write scope.</li></ul><p class="tiny muted">Before using this feature, enable GitHub OAuth in Supabase Authentication → Providers → GitHub and configure the OAuth callback URL.</p></section></div>';
  document.querySelector("#github-connect")?.addEventListener("click",connectGitHub);
  document.querySelector("#github-disconnect")?.addEventListener("click",disconnectGitHub);
  document.querySelector("#github-import-main")?.addEventListener("click",openGitHubImport);
  document.querySelector("#github-push-main")?.addEventListener("click",pushSiteToGitHub);
}
function initGitHub(c){
  ctx=c;
  ctx.openModal=ctx.openModal||function(html){document.querySelector("#modal-root").innerHTML=html};
  ctx.closeModal=ctx.closeModal||function(){document.querySelector("#modal-root").innerHTML=""};
  ctx.reloadSiteFiles=ctx.reloadSiteFiles||async function(){if(!ctx.state.selectedSite)return;const r=await ctx.supabase.from("site_files").select("*").eq("site_id",ctx.state.selectedSite.id).order("path");ctx.state.files=r.data||[]};
  ctx.supabase.auth.getSession().then(({data})=>syncSession(data.session)).catch(()=>{});
  ctx.supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>syncSession(session),0));
}
export {renderGitHub,initGitHub,openGitHubImport,pushSiteToGitHub};
