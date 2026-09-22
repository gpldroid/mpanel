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
async function loadGitHubIntegration(){
  const site=ctx.state.selectedSite;if(!site)return;
  const r=await ctx.supabase.from("site_integrations").select("*").eq("site_id",site.id).eq("provider","github").maybeSingle();
  if(r.error)return;
  if(r.data&&r.data.github_repo){
    ctx.state.github.repo={full_name:r.data.github_repo,branch:r.data.github_branch||"main"};
  }else ctx.state.github.repo=null;
}
async function saveGitHubIntegration(repo,branch){
  const site=ctx.state.selectedSite;if(!site)throw new Error("Select a website first.");
  const payload={user_id:ctx.state.user.id,site_id:site.id,provider:"github",github_repo:repo,github_branch:branch||"main",enabled:true,updated_at:new Date().toISOString()};
  const r=await ctx.supabase.from("site_integrations").upsert(payload,{onConflict:"site_id,provider"}).select().single();
  if(r.error)throw r.error;
  ctx.state.github.repo={full_name:repo,branch:branch||"main"};
}
async function publishGeneratedSite(files,message="mPanel: publish website"){
  const repo=ctx.state.github.repo;
  if(!repo)throw new Error("Choose and save a GitHub repository first.");
  const [owner,name]=repo.full_name.split("/");
  const ref=await githubRequest("/repos/"+owner+"/"+name+"/git/ref/heads/"+encodeURIComponent(repo.branch));
  const parent=ref.object.sha;
  const commit=await githubRequest("/repos/"+owner+"/"+name+"/git/commits/"+parent);
  const generated=files.filter(f=>isTextPath(f.path));
  const manifestPath=".mpanel-manifest.json";
  const previous=[];
  try{
    const old=await githubRequest("/repos/"+owner+"/"+name+"/contents/"+manifestPath+"?ref="+encodeURIComponent(repo.branch));
    const raw=decodeBase64(old.content);
    const parsed=JSON.parse(raw);
    if(Array.isArray(parsed.paths))previous.push(...parsed.paths.filter(Boolean));
  }catch{}
  const currentPaths=generated.map(f=>f.path).filter(Boolean);
  const manifest={version:1,managed_by:"mPanel",generated_at:new Date().toISOString(),paths:currentPaths};
  generated.push({path:manifestPath,content:JSON.stringify(manifest,null,2),mime_type:"application/json"});
  const entries=[];
  for(const f of generated){
    const blob=await githubRequest("/repos/"+owner+"/"+name+"/git/blobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({content:encodeBase64(f.content),encoding:"base64"})});
    entries.push({path:f.path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const stale=previous.filter(p=>!currentPaths.includes(p)&&p!==manifestPath);
  for(const p of stale)entries.push({path:p,mode:"100644",type:"blob",sha:null});
  const tree=await githubRequest("/repos/"+owner+"/"+name+"/git/trees",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({base_tree:commit.tree.sha,tree:entries})});
  const created=await githubRequest("/repos/"+owner+"/"+name+"/git/commits",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,tree:tree.sha,parents:[parent]})});
  await githubRequest("/repos/"+owner+"/"+name+"/git/refs/heads/"+encodeURIComponent(repo.branch),{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({sha:created.sha,force:false})});
  const verified=await verifyPublishedSite(repo,created.sha,currentPaths);
  return {sha:created.sha,files:generated.length,deleted:stale.length,repository:repo.full_name,branch:repo.branch,verified:verified.ok,verification_message:verified.message,manifest_sha:verified.manifest_sha||null,previous_commit_sha:parent};
}
async function verifyPublishedSite(repo,expectedCommit,expectedPaths){
  const [owner,name]=repo.full_name.split("/");
  try{
    const ref=await githubRequest("/repos/"+owner+"/"+name+"/git/ref/heads/"+encodeURIComponent(repo.branch));
    if(ref.object?.sha!==expectedCommit)return {ok:false,message:"Branch ref did not reach the published commit."};
    const manifestBlob=await githubRequest("/repos/"+owner+"/"+name+"/contents/.mpanel-manifest.json?ref="+encodeURIComponent(repo.branch));
    const manifest=JSON.parse(decodeBase64(manifestBlob.content));
    const paths=Array.isArray(manifest.paths)?manifest.paths:[];
    const missing=expectedPaths.filter(p=>!paths.includes(p));
    if(missing.length)return {ok:false,message:"Published manifest is missing "+missing.length+" generated path(s).",manifest_sha:manifestBlob.sha};
    const index=await githubRequest("/repos/"+owner+"/"+name+"/contents/index.html?ref="+encodeURIComponent(repo.branch));
    if(!index.sha)return {ok:false,message:"Published index.html could not be verified.",manifest_sha:manifestBlob.sha};
    return {ok:true,message:"GitHub branch, manifest and index.html verified.",manifest_sha:manifestBlob.sha};
  }catch(e){return {ok:false,message:"Repository verification failed: "+String(e.message||e)}}
}
function renderGitHub(state){
  const el=document.querySelector("#view-github");if(!el)return;
  const connected=!!state.github.connected, repo=state.github.repo;
  el.innerHTML='<div class="toolbar"><div><h3>GitHub</h3><p class="muted">Repository connection, import, preview and atomic publishing.</p></div><div class="workspace-actions">'+(connected?'<span class="connection-pill"><i></i>'+esc(state.github.login||"Connected")+'</span><button class="btn secondary" id="github-disconnect">Disconnect</button>':'<button class="btn primary" id="github-connect"><i data-lucide="github"></i>Connect GitHub</button>')+'</div></div>'+
  '<div class="grid two-col"><section class="card"><h3>Repository workspace</h3><p class="muted">Select the repository and branch used for imports and publishing.</p>'+
  (connected?'<div class="form-grid"><label>Repository<select id="github-repo-select"><option value="">Loading repositories…</option></select></label><label>Branch<input id="github-branch" value="'+esc(repo?.branch||"main")+'"></label></div><div class="workspace-actions" style="margin-top:14px"><button class="btn secondary" id="github-refresh-repos"><i data-lucide="refresh-cw"></i>Refresh repositories</button><button class="btn primary" id="github-save-repo"><i data-lucide="save"></i>Save repository</button></div><div class="github-repo-box">'+(repo?'<span class="badge success">Selected: '+esc(repo.full_name)+' / '+esc(repo.branch)+'</span>':'<span class="badge warning">No repository selected</span>')+'<div class="workspace-actions"><button class="btn secondary" id="github-import-main"><i data-lucide="download"></i>Import project</button><button class="btn primary" id="github-publish-main"><i data-lucide="rocket"></i>Publish website</button></div></div>':'<div class="empty"><i data-lucide="github"></i><p>Connect GitHub to unlock repository access.</p></div>')+
  '</section><section class="card"><h3>Publishing pipeline</h3><ol class="muted"><li>Content → Posts / Pages</li><li>SEO → metadata / sitemap / robots</li><li>Design → Layout / Widgets / Theme</li><li>Build → static HTML files</li><li>GitHub → one atomic commit</li></ol><p class="tiny muted">Publishing uses GitHub Git Trees + Commit + Ref APIs so a release is grouped into one commit rather than one commit per file.</p></section></div>';
  document.querySelector("#github-connect")?.addEventListener("click",connectGitHub);
  document.querySelector("#github-disconnect")?.addEventListener("click",disconnectGitHub);
  document.querySelector("#github-import-main")?.addEventListener("click",openGitHubImport);
  document.querySelector("#github-refresh-repos")?.addEventListener("click",async()=>{try{await fillRepoSelect()}catch(e){ctx.toast(e.message)}});
  document.querySelector("#github-save-repo")?.addEventListener("click",async()=>{try{const sel=document.querySelector("#github-repo-select"),repoName=sel?.value,branch=document.querySelector("#github-branch")?.value.trim()||"main";if(!repoName)throw new Error("Select a repository.");await saveGitHubIntegration(repoName,branch);ctx.toast("GitHub repository saved","success");renderGitHub(ctx.state)}catch(e){ctx.toast("Save failed: "+e.message)}});
  document.querySelector("#github-publish-main")?.addEventListener("click",()=>ctx.publishWebsite?.());
  async function fillRepoSelect(){const sel=document.querySelector("#github-repo-select");if(!sel)return;const repos=await loadRepos();sel.innerHTML='<option value="">Select repository</option>'+repoOptions(repos,ctx.state.github.repo?.full_name||"");if(ctx.state.github.repo)sel.value=ctx.state.github.repo.full_name}
  if(connected)fillRepoSelect().catch(e=>ctx.toast("Repository load failed: "+e.message));
}
function initGitHub(c){
  ctx=c;
  ctx.openModal=ctx.openModal||function(html){document.querySelector("#modal-root").innerHTML=html};
  ctx.closeModal=ctx.closeModal||function(){document.querySelector("#modal-root").innerHTML=""};
  ctx.reloadSiteFiles=ctx.reloadSiteFiles||async function(){if(!ctx.state.selectedSite)return;const r=await ctx.supabase.from("site_files").select("*").eq("site_id",ctx.state.selectedSite.id).order("path");ctx.state.files=r.data||[]};
  ctx.supabase.auth.getSession().then(async({data})=>{await syncSession(data.session);await loadGitHubIntegration();renderGitHub(ctx.state)}).catch(()=>{});
  ctx.supabase.auth.onAuthStateChange((_event,session)=>setTimeout(()=>syncSession(session),0));
}
export {renderGitHub,initGitHub,openGitHubImport,pushSiteToGitHub,publishGeneratedSite,loadGitHubIntegration,verifyPublishedSite};
