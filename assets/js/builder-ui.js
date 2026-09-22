import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const db=createClient(SUPABASE_URL.trim().replace(/\/$/,""),SUPABASE_ANON_KEY.trim());
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const uid=()=>crypto.randomUUID();

let ctx={supabase:db,state:null,showView:null,toast:null,icons:null};
let templates=[],blocks=[],activeTemplate=null;

const blockTypes=[
 ["hero","Hero","Large heading, copy and optional CTA"],
 ["html","HTML","Raw HTML block"],
 ["text","Text","Plain text content"],
 ["posts","Posts","Latest published posts"],
 ["menu","Menu","Site navigation"],
 ["image","Image","Image with alt text and link"],
 ["cta","CTA","Call-to-action panel"],
 ["content","Content","Current post or page content"],
 ["custom","Custom","Custom block configuration"]
];

function css(){
 if(document.querySelector("#builder-ui-css"))return;
 const s=document.createElement("style");
 s.id="builder-ui-css";
 s.textContent=".builder-shell{display:grid;gap:18px}.builder-toolbar{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.builder-actions{display:flex;gap:8px;flex-wrap:wrap}.builder-grid{display:grid;grid-template-columns:300px minmax(0,1fr) 340px;gap:14px;min-height:650px}.builder-panel{min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);padding:14px}.builder-list{display:grid;gap:7px}.builder-item{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);cursor:pointer}.builder-item.active{outline:2px solid var(--primary)}.builder-item small{display:block;color:var(--muted);margin-top:2px}.builder-blocks{display:grid;gap:10px;min-height:420px}.builder-block{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:13px;border:1px solid var(--border);border-radius:12px;background:var(--surface-2)}.builder-block .drag{color:var(--muted)}.builder-block .block-actions{display:flex;gap:5px}.builder-empty{min-height:420px;display:grid;place-items:center;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:12px}.builder-preview{width:100%;min-height:540px;border:1px solid var(--border);border-radius:12px;background:#fff}.builder-field{display:grid;gap:6px;margin-bottom:12px}.builder-field input,.builder-field textarea,.builder-field select{width:100%}.builder-check{display:flex;gap:8px;align-items:center;margin:10px 0}.builder-check input{width:auto}.builder-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.builder-template-meta{display:flex;gap:6px;flex-wrap:wrap}.builder-code{min-height:180px;font:12px/1.6 ui-monospace,monospace;direction:ltr;text-align:left;background:#0b1220;color:#e2e8f0}@media(max-width:1200px){.builder-grid{grid-template-columns:240px minmax(0,1fr)}.builder-preview-panel{grid-column:1/-1}}@media(max-width:760px){.builder-toolbar{flex-direction:column}.builder-grid{grid-template-columns:1fr}.builder-preview-panel{grid-column:auto}}";
 document.head.append(s);
}

function site(){return ctx.state?.selectedSite||null}
function toast(m,type="error"){ctx.toast?.(m,type)}
function icons(){ctx.icons?.()}

async function load(){
 const s=site(); if(!s){templates=[];blocks=[];activeTemplate=null;return}
 const [a,b]=await Promise.all([
  db.from("builder_templates").select("*").eq("site_id",s.id).order("created_at",{ascending:true}),
  db.from("builder_blocks").select("*").eq("site_id",s.id).order("position",{ascending:true})
 ]);
 if(a.error)throw a.error;if(b.error)throw b.error;
 templates=a.data||[];blocks=b.data||[];
 activeTemplate=templates.find(x=>x.is_default)||templates[0]||null;
 if(activeTemplate)blocks=blocks.filter(x=>x.template_id===activeTemplate.id).sort((a,b)=>a.position-b.position);
 if(ctx.state){ctx.state.builderTemplates=templates;ctx.state.builderBlocks=blocks;}
}

function templateList(){
 return '<div class="builder-list">'+(templates.map(t=>'<div class="builder-item '+(activeTemplate?.id===t.id?"active":"")+'" data-template="'+t.id+'"><div><strong>'+esc(t.name)+'</strong><small>'+esc(t.template_type)+' · '+(t.is_default?"default":"custom")+'</small></div><button class="icon-btn builder-delete-template" data-id="'+t.id+'" title="Delete"><i data-lucide="trash-2"></i></button></div>').join("")||'<div class="empty">No templates.</div>')+'</div>';
}

function render(){
 const root=document.querySelector("#view-builder");if(!root)return;
 if(!site()){root.innerHTML='<div class="empty"><i data-lucide="layout-template"></i><h3>No website selected</h3><p>Create or select a website first.</p></div>';icons();return}
 root.innerHTML='<div class="builder-shell"><div class="builder-toolbar"><div><span class="eyebrow">VISUAL SITE BUILDER</span><h3>'+esc(site().name)+'</h3><p class="muted">Build templates from reusable blocks, preview them, then publish through the existing GitHub pipeline.</p></div><div class="builder-actions"><button class="btn secondary" id="builder-refresh"><i data-lucide="refresh-cw"></i>Refresh</button><button class="btn secondary" id="builder-theme-presets"><i data-lucide="palette"></i>Theme presets</button><button class="btn primary" id="builder-publish"><i data-lucide="rocket"></i>Publish</button><button class="btn primary" id="builder-new-template"><i data-lucide="plus"></i>New template</button></div></div><div class="builder-grid"><section class="builder-panel"><div class="section-head"><h3>Templates</h3><span class="badge neutral">'+templates.length+'</span></div>'+templateList()+'</section><section class="builder-panel"><div class="section-head"><div><h3>'+esc(activeTemplate?.name||"Template")+'</h3><div class="builder-template-meta"><span class="badge neutral">'+esc(activeTemplate?.template_type||"page")+'</span>'+(activeTemplate?.is_default?'<span class="badge success">Default</span>':"")+'</div></div><button class="btn secondary" id="builder-edit-template"><i data-lucide="settings-2"></i>Settings</button></div><div class="builder-tabs">'+blockTypes.map(x=>'<button class="btn secondary add-block" data-type="'+x[0]+'"><i data-lucide="plus"></i>'+esc(x[1])+'</button>').join("")+'</div><div class="builder-blocks">'+(blocks.length?blocks.map((b,i)=>blockRow(b,i)).join(""):'<div class="builder-empty"><div><i data-lucide="blocks"></i><p>Add a block to start building this template.</p></div></div>')+'</div></section><section class="builder-panel builder-preview-panel"><div class="section-head"><h3>Live Preview</h3><button class="icon-btn" id="builder-preview-refresh" title="Refresh"><i data-lucide="refresh-cw"></i></button></div><iframe id="builder-preview" class="builder-preview" title="Builder preview"></iframe></section></div></div>';
 bind();preview();icons();
}

function blockRow(b,i){
 const title=b.content?.title||b.block_type;
 return '<div class="builder-block" data-id="'+b.id+'"><span class="drag"><i data-lucide="grip-vertical"></i></span><div><strong>'+esc(title)+'</strong><small class="muted">'+esc(b.area)+' · '+esc(b.block_type)+' · '+(b.enabled?"enabled":"disabled")+'</small></div><div class="block-actions"><button class="icon-btn move-up" data-id="'+b.id+'" '+(i===0?"disabled":"")+'><i data-lucide="chevron-up"></i></button><button class="icon-btn move-down" data-id="'+b.id+'" '+(i===blocks.length-1?"disabled":"")+'><i data-lucide="chevron-down"></i></button><button class="icon-btn edit-block" data-id="'+b.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn delete-block" data-id="'+b.id+'"><i data-lucide="trash-2"></i></button></div></div>';
}

function bind(){
 document.querySelector("#builder-refresh")?.addEventListener("click",async()=>{try{await load();render()}catch(e){toast(e.message)}});
 document.querySelector("#builder-preview-refresh")?.addEventListener("click",preview);
 document.querySelector("#builder-new-template")?.addEventListener("click",newTemplate);document.querySelector("#builder-theme-presets")?.addEventListener("click",themePresetsModal);document.querySelector("#builder-publish")?.addEventListener("click",()=>ctx.publishWebsite?.());
 document.querySelector("#builder-edit-template")?.addEventListener("click",editTemplate);
 document.querySelectorAll("[data-template]").forEach(b=>b.addEventListener("click",async e=>{if(e.target.closest(".builder-delete-template"))return;activeTemplate=templates.find(x=>x.id===b.dataset.template)||activeTemplate;blocks=(await loadBlocks(activeTemplate.id));render()}));
 document.querySelectorAll(".builder-delete-template").forEach(b=>b.addEventListener("click",()=>deleteTemplate(b.dataset.id)));
 document.querySelectorAll(".add-block").forEach(b=>b.addEventListener("click",()=>addBlock(b.dataset.type)));
 document.querySelectorAll(".edit-block").forEach(b=>b.addEventListener("click",()=>editBlock(b.dataset.id)));
 document.querySelectorAll(".delete-block").forEach(b=>b.addEventListener("click",()=>deleteBlock(b.dataset.id)));
 document.querySelectorAll(".move-up").forEach(b=>b.addEventListener("click",()=>moveBlock(b.dataset.id,-1)));
 document.querySelectorAll(".move-down").forEach(b=>b.addEventListener("click",()=>moveBlock(b.dataset.id,1)));
}

async function loadBlocks(templateId){
 const r=await db.from("builder_blocks").select("*").eq("site_id",site().id).eq("template_id",templateId).order("position",{ascending:true});
 if(r.error)throw r.error;return r.data||[];
}

async function themePresetsModal(){
 const presets=ctx.state.themePresets||[];
 const theme=ctx.state.design?.theme||{};
 const rows=presets.map(p=>'<div class="site-row"><div><strong>'+esc(p.name)+'</strong><small class="muted">'+esc(p.slug)+'</small></div><div class="workspace-actions"><button class="btn secondary preset-apply" data-id="'+p.id+'">Apply</button><button class="icon-btn preset-delete" data-id="'+p.id+'"><i data-lucide="trash-2"></i></button></div></div>').join("");
 document.querySelector("#modal-root").innerHTML='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><div><h3>Theme Presets</h3><p class="muted">Reusable visual settings shared with the Theme editor.</p></div><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><div class="site-list">'+(rows||'<div class="empty">No presets yet.</div>')+'</div><div class="modal-actions"><button class="btn secondary" data-close>Close</button><button class="btn primary" id="builder-save-preset">Save current theme</button></div></div></div>';
 icons();document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);
 document.querySelector("#builder-save-preset")?.addEventListener("click",async()=>{const name=prompt("Preset name","My Theme");if(!name)return;const slug=name.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-+|-+$/g,"")||uid();const r=await db.from("theme_presets").insert({user_id:ctx.state.user.id,name,slug,settings:theme,is_system:false}).select().single();if(r.error){toast(r.error.message);return}ctx.state.themePresets=[...(ctx.state.themePresets||[]),r.data].sort((a,b)=>a.name.localeCompare(b.name));closeModal();toast("Theme preset saved","success");themePresetsModal()});
 document.querySelectorAll(".preset-apply").forEach(x=>x.onclick=async()=>{const p=presets.find(v=>v.id===x.dataset.id);if(!p)return;const r=await db.from("theme_settings").upsert({...p.settings,user_id:ctx.state.user.id,site_id:site().id},{onConflict:"site_id"}).select().single();if(r.error){toast(r.error.message);return}ctx.state.design=ctx.state.design||{};ctx.state.design.theme=r.data;ctx.state.activeThemePresetId=p.id;closeModal();toast("Theme preset applied","success");render()});
 document.querySelectorAll(".preset-delete").forEach(x=>x.onclick=async()=>{if(!confirm("Delete this theme preset?"))return;const r=await db.from("theme_presets").delete().eq("id",x.dataset.id);if(r.error){toast(r.error.message);return}ctx.state.themePresets=(ctx.state.themePresets||[]).filter(v=>v.id!==x.dataset.id);themePresetsModal()});
}
function closeModal(){document.querySelector("#modal-root").innerHTML=""}

async function newTemplate(){
 const name=prompt("Template name","New Template");if(!name)return;
 const type=prompt("Template type: site, page, post, archive, 404","page")||"page";
 if(!["site","page","post","archive","404"].includes(type))return toast("Invalid template type");
 const slug=String(name).toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-+|-+$/g,"")||uid();
 const r=await db.from("builder_templates").insert({user_id:ctx.state.user.id,site_id:site().id,name,slug,template_type:type,settings:{},is_default:templates.length===0}).select().single();
 if(r.error)throw r.error;activeTemplate=r.data;toast("Template created","success");await load();render();
}

async function editTemplate(){
 if(!activeTemplate)return;
 const name=prompt("Template name",activeTemplate.name);if(!name)return;
 const type=prompt("Template type",activeTemplate.template_type)||activeTemplate.template_type;
 const settings=activeTemplate.settings||{};
 const width=prompt("Container width",settings.container_width||1200);if(width)settings.container_width=Number(width)||1200;
 const r=await db.from("builder_templates").update({name,template_type:type,settings}).eq("id",activeTemplate.id);
 if(r.error)throw r.error;toast("Template updated","success");await load();render();
}

async function deleteTemplate(id){
 if(templates.length<=1)return toast("Keep at least one template");
 if(!confirm("Delete this template and its blocks?"))return;
 const r=await db.from("builder_templates").delete().eq("id",id);if(r.error)throw r.error;toast("Template deleted","success");await load();render();
}

function defaultContent(type){
 if(type==="content")return {title:"Content"};
 if(type==="hero")return {title:"Your headline",text:"Build a beautiful section for your website.",button_text:"Learn more",button_url:"#"};
 if(type==="text")return {text:"Write your content here."};
 if(type==="html")return {html:"<section><h2>Custom HTML</h2><p>Edit this block from mPanel.</p></section>"};
 if(type==="posts")return {title:"Latest posts",limit:6};
 if(type==="menu")return {title:"Navigation"};
 if(type==="image")return {url:"",alt:"",link:""};
 if(type==="cta")return {title:"Ready to get started?",text:"Add a clear call to action.",button_text:"Get started",button_url:"#"};
 return {title:"Custom block",html:""};
}

async function addBlock(type){
 if(!activeTemplate)return toast("Select a template first");
 const content=defaultContent(type);
 const r=await db.from("builder_blocks").insert({user_id:ctx.state.user.id,site_id:site().id,template_id:activeTemplate.id,area:"main",block_type:type,content,position:blocks.length,enabled:true}).select().single();
 if(r.error)throw r.error;toast("Block added","success");await load();render();
}

function fieldsFor(type,c){
 if(type==="html")return '<label class="builder-field">HTML<textarea id="block-html" class="builder-code" rows="10">'+esc(c.html||"")+'</textarea></label>';
 if(type==="text")return '<label class="builder-field">Text<textarea id="block-text" rows="7">'+esc(c.text||"")+'</textarea></label>';
 if(type==="hero"||type==="cta")return '<label class="builder-field">Title<input id="block-title" value="'+esc(c.title||"")+'"></label><label class="builder-field">Text<textarea id="block-text" rows="4">'+esc(c.text||"")+'</textarea></label><label class="builder-field">Button text<input id="block-button" value="'+esc(c.button_text||"")+'"></label><label class="builder-field">Button URL<input id="block-url" value="'+esc(c.button_url||"")+'"></label>';
 if(type==="posts")return '<label class="builder-field">Title<input id="block-title" value="'+esc(c.title||"Latest posts")+'"></label><label class="builder-field">Limit<input id="block-limit" type="number" min="1" max="20" value="'+Number(c.limit||6)+'"></label>';
 if(type==="menu")return '<label class="builder-field">Title<input id="block-title" value="'+esc(c.title||"Navigation")+'"></label>';
 if(type==="image")return '<label class="builder-field">Image URL<input id="block-url" value="'+esc(c.url||"")+'"></label><label class="builder-field">Alt text<input id="block-alt" value="'+esc(c.alt||"")+'"></label><label class="builder-field">Link<input id="block-link" value="'+esc(c.link||"")+'"></label>';
 return '<label class="builder-field">Title<input id="block-title" value="'+esc(c.title||"Custom block")+'"></label><label class="builder-field">HTML<textarea id="block-html" class="builder-code" rows="8">'+esc(c.html||"")+'</textarea></label>';
}

async function editBlock(id){
 const b=blocks.find(x=>x.id===id);if(!b)return;
 const html='<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Edit '+esc(b.block_type)+'</h3><button class="icon-btn" data-close><i data-lucide="x"></i></button></div><div class="builder-field"><label>Area<select id="block-area"><option '+(b.area==="header"?"selected":"")+'>header</option><option '+(b.area==="main"?"selected":"")+'>main</option><option '+(b.area==="sidebar"?"selected":"")+'>sidebar</option><option '+(b.area==="footer"?"selected":"")+'>footer</option></select></label></div>'+fieldsFor(b.block_type,b.content||{})+'<label class="builder-check"><input id="block-enabled" type="checkbox" '+(b.enabled?"checked":"")+'> Enabled</label><div class="modal-actions"><button class="btn secondary" data-close>Cancel</button><button class="btn primary" id="save-builder-block">Save block</button></div></div></div>';
 document.querySelector("#modal-root").innerHTML=html;icons();
 document.querySelectorAll("[data-close]").forEach(x=>x.onclick=closeModal);
 document.querySelector("#save-builder-block").onclick=async()=>{
  const c={...(b.content||{})};const get=id=>document.querySelector(id)?.value||"";
  if(["hero","cta","posts","menu","custom"].includes(b.block_type))c.title=get("#block-title");
  if(["hero","cta"].includes(b.block_type)){c.text=get("#block-text");c.button_text=get("#block-button");c.button_url=get("#block-url")}
  if(b.block_type==="text")c.text=get("#block-text");
  if(b.block_type==="html"||b.block_type==="custom")c.html=get("#block-html");
  if(b.block_type==="posts")c.limit=Number(get("#block-limit"))||6;
  if(b.block_type==="image"){c.url=get("#block-url");c.alt=get("#block-alt");c.link=get("#block-link")}
  const r=await db.from("builder_blocks").update({area:document.querySelector("#block-area").value,content:c,enabled:document.querySelector("#block-enabled").checked}).eq("id",b.id);
  if(r.error)throw r.error;closeModal();toast("Block saved","success");await load();render();
 };
}

function closeModal(){document.querySelector("#modal-root").innerHTML=""}

async function deleteBlock(id){if(!confirm("Delete this block?"))return;const r=await db.from("builder_blocks").delete().eq("id",id);if(r.error)throw r.error;toast("Block deleted","success");await load();render()}

async function moveBlock(id,delta){
 const i=blocks.findIndex(x=>x.id===id),j=i+delta;if(i<0||j<0||j>=blocks.length)return;
 [blocks[i],blocks[j]]=[blocks[j],blocks[i]];
 for(let n=0;n<blocks.length;n++){const r=await db.from("builder_blocks").update({position:n}).eq("id",blocks[n].id);if(r.error)throw r.error}
 toast("Block order saved","success");await load();render();
}

function blockPreview(b){
 const c=b.content||{};
 if(b.block_type==="hero")return '<section class="mp-hero"><h1>'+esc(c.title||"")+'</h1><p>'+esc(c.text||"")+'</p>'+(c.button_text?'<a href="'+esc(c.button_url||"#")+'">'+esc(c.button_text)+'</a>':"")+'</section>';
 if(b.block_type==="text")return '<section><p>'+esc(c.text||"")+'</p></section>';
 if(b.block_type==="html"||b.block_type==="custom")return c.html||"";
 if(b.block_type==="image")return c.url?'<img src="'+esc(c.url)+'" alt="'+esc(c.alt||"")+'">':"";
 if(b.block_type==="cta")return '<section class="mp-cta"><h2>'+esc(c.title||"")+'</h2><p>'+esc(c.text||"")+'</p>'+(c.button_text?'<a href="'+esc(c.button_url||"#")+'">'+esc(c.button_text)+'</a>':"")+'</section>';
 if(b.block_type==="posts")return '<section><h2>'+esc(c.title||"Latest posts")+'</h2><div><p>Published posts are rendered from the current CMS data when the site is generated.</p></div></section>';
 if(b.block_type==="menu")return '<nav><strong>'+esc(c.title||"Navigation")+'</strong></nav>';
 return "";
}

function preview(){
 const frame=document.querySelector("#builder-preview");if(!frame)return;
 const body=blocks.filter(x=>x.enabled).sort((a,b)=>a.position-b.position).map(blockPreview).join("");
 frame.srcdoc='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:system-ui;margin:0;padding:22px;background:#f8fafc;color:#0f172a}section{background:#fff;border-radius:16px;padding:24px;margin-bottom:14px;border:1px solid #e2e8f0}a{display:inline-block;padding:10px 14px;background:#4f46e5;color:#fff;text-decoration:none;border-radius:9px}img{max-width:100%;height:auto}</style></head><body>'+body+'</body></html>';
}

export async function initBuilder(options){
 ctx={...ctx,...options,supabase:options.supabase||db};
 css();
 try{await load()}catch(e){toast(e.message)}
 render();
}
export async function renderBuilder(){try{await load()}catch(e){toast(e.message)}render()}
