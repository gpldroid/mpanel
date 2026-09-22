let ctx=null;
const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const types=["html","text","recent_posts","categories","tags","search","social","custom"];

async function loadDesign(){
  const s=ctx.state.selectedSite;
  if(!s)return;
  if(ctx.state.design.loadedSiteId===s.id)return;
  const [l,w,m,t]=await Promise.all([
    ctx.supabase.from("layout_sections").select("*").eq("site_id",s.id).order("position"),
    ctx.supabase.from("widgets").select("*").eq("site_id",s.id).order("section_key").order("position"),
    ctx.supabase.from("menus").select("*").eq("site_id",s.id).order("name"),
    ctx.supabase.from("theme_settings").select("*").eq("site_id",s.id).maybeSingle()
  ]);
  if(l.error||w.error||m.error||t.error){ctx.toast((l.error||w.error||m.error||t.error).message);return}
  if(!(l.data||[]).length){
    const defaults=["header","main","sidebar","footer"].map((key,i)=>({user_id:ctx.state.user.id,site_id:s.id,section_key:key,name:key==="main"?"Main Content":key[0].toUpperCase()+key.slice(1),position:i}));
    await ctx.supabase.from("layout_sections").insert(defaults);
  }
  if(!t.data)await ctx.supabase.from("theme_settings").insert({user_id:ctx.state.user.id,site_id:s.id});
  if(!(m.data||[]).length)await ctx.supabase.from("menus").insert({user_id:ctx.state.user.id,site_id:s.id,name:"Main Menu",slug:"main-menu",location:"header"});
  const [l2,w2,m2,t2]=await Promise.all([
    ctx.supabase.from("layout_sections").select("*").eq("site_id",s.id).order("position"),
    ctx.supabase.from("widgets").select("*").eq("site_id",s.id).order("section_key").order("position"),
    ctx.supabase.from("menus").select("*").eq("site_id",s.id).order("name"),
    ctx.supabase.from("theme_settings").select("*").eq("site_id",s.id).maybeSingle()
  ]);
  let items=[];
  const menuIds=(m2.data||[]).map(x=>x.id);
  if(menuIds.length){const q=await ctx.supabase.from("menu_items").select("*").in("menu_id",menuIds).order("position");if(!q.error)items=q.data||[]}
  ctx.state.design={loadedSiteId:s.id,layout:l2.data||[],widgets:w2.data||[],menus:m2.data||[],menuItems:items,theme:t2.data||null};
}
function layoutView(){
  const rows=ctx.state.design.layout||[];
  return '<div class="toolbar"><div><h3>Layout</h3><p class="muted">Arrange the main regions of your website.</p></div><span class="badge neutral">'+rows.length+' sections</span></div><div class="layout-canvas">'+
    (rows.length?rows.map((x,i)=>'<div class="layout-section '+(x.enabled?"":"is-disabled")+'"><div class="layout-section-main"><span class="drag-handle"><i data-lucide="grip-vertical"></i></span><div><strong>'+esc(x.name)+'</strong><div class="tiny muted">'+esc(x.section_key)+' · position '+(i+1)+'</div></div></div><div class="layout-actions"><button class="icon-btn layout-up" data-id="'+x.id+'" title="Move up"><i data-lucide="chevron-up"></i></button><button class="icon-btn layout-down" data-id="'+x.id+'" title="Move down"><i data-lucide="chevron-down"></i></button><button class="btn secondary layout-toggle" data-id="'+x.id+'">'+(x.enabled?"Enabled":"Disabled")+'</button></div></div>').join(""):'<div class="card empty">No layout sections yet.</div>')+'</div>';
}
async function saveLayoutOrder(){
  const rows=ctx.state.design.layout;
  for(let i=0;i<rows.length;i++)await ctx.supabase.from("layout_sections").update({position:i}).eq("id",rows[i].id);
}
async function moveLayout(id,dir){
  const a=ctx.state.design.layout,i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;
  const tmp=a[i];a[i]=a[j];a[j]=tmp;await saveLayoutOrder();renderDesignViews();
}
async function toggleLayout(id){
  const x=ctx.state.design.layout.find(v=>v.id===id);if(!x)return;
  const r=await ctx.supabase.from("layout_sections").update({enabled:!x.enabled}).eq("id",id);
  if(r.error){ctx.toast(r.error.message);return}x.enabled=!x.enabled;renderDesignViews();
}
function widgetsView(){
  const rows=ctx.state.design.widgets||[];
  return '<div class="toolbar"><div><h3>Widgets / Gadgets</h3><p class="muted">Add reusable blocks to Header, Sidebar, Main or Footer.</p></div><button class="btn primary" id="new-widget"><i data-lucide="plus"></i>Add widget</button></div><div class="card table-wrap"><table class="table"><thead><tr><th>Widget</th><th>Type</th><th>Region</th><th>Status</th><th></th></tr></thead><tbody>'+
    (rows.length?rows.map(x=>'<tr><td><strong>'+esc(x.title||x.widget_type)+'</strong></td><td>'+esc(x.widget_type)+'</td><td>'+esc(x.section_key)+'</td><td><span class="badge '+(x.enabled?"success":"neutral")+'">'+(x.enabled?"Enabled":"Disabled")+'</span></td><td><button class="icon-btn edit-widget" data-id="'+x.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn delete-widget" data-id="'+x.id+'"><i data-lucide="trash-2"></i></button></td></tr>').join(""):'<tr><td colspan="5" class="empty">No widgets yet.</td></tr>')+
    '</tbody></table></div>';
}
function openWidget(item=null){
  const d=item?.config||{}, regions=(ctx.state.design.layout||[]).map(x=>x.section_key);
  ctx.openModal('<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>'+(item?"Edit widget":"Add widget")+'</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="widget-form"><label>Title<input name="title" value="'+esc(item?.title||"")+'" required></label><label style="margin-top:14px">Widget type<select name="widget_type">'+types.map(x=>'<option '+(item?.widget_type===x?"selected":"")+'>'+x+'</option>').join("")+'</select></label><label style="margin-top:14px">Region<select name="section_key">'+regions.map(x=>'<option '+(item?.section_key===x?"selected":"")+'>'+x+'</option>').join("")+'</select></label><label style="margin-top:14px">Configuration JSON<textarea name="config" rows="8" class="code-editor" style="min-height:150px">'+esc(JSON.stringify(d,null,2))+'</textarea></label><label style="display:flex;align-items:center;gap:8px;margin-top:14px"><input name="enabled" type="checkbox" '+(item?.enabled!==false?"checked":"")+' style="width:auto"> Enabled</label><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Save</button></div></form></div></div>');
  ctx.icons();document.querySelector("#close-modal").onclick=ctx.closeModal;document.querySelector("#cancel-modal").onclick=ctx.closeModal;
  document.querySelector("#widget-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);let config={};try{config=JSON.parse(f.get("config")||"{}")}catch{ctx.toast("Configuration must be valid JSON.");return}const payload={user_id:ctx.state.user.id,site_id:ctx.state.selectedSite.id,title:f.get("title").trim(),widget_type:f.get("widget_type"),section_key:f.get("section_key"),config,enabled:e.target.elements.enabled.checked,position:item?.position??ctx.state.design.widgets.length};const r=item?await ctx.supabase.from("widgets").update(payload).eq("id",item.id).select().single():await ctx.supabase.from("widgets").insert(payload).select().single();if(r.error){ctx.toast(r.error.message);return}if(item)ctx.state.design.widgets=ctx.state.design.widgets.map(x=>x.id===item.id?r.data:x);else ctx.state.design.widgets.push(r.data);ctx.closeModal();renderDesignViews();ctx.toast("Widget saved","success")};
}
async function deleteWidget(id){if(!confirm("Delete this widget?"))return;const r=await ctx.supabase.from("widgets").delete().eq("id",id);if(r.error){ctx.toast(r.error.message);return}ctx.state.design.widgets=ctx.state.design.widgets.filter(x=>x.id!==id);renderDesignViews();ctx.toast("Widget deleted","success")}
function navigationView(){
  const menus=ctx.state.design.menus||[], menu=menus[0], items=menu?(ctx.state.design.menuItems||[]).filter(x=>x.menu_id===menu.id):[];
  return '<div class="toolbar"><div><h3>Navigation</h3><p class="muted">Build header menus and custom links.</p></div><div class="workspace-actions"><button class="btn secondary" id="new-menu"><i data-lucide="plus"></i>New menu</button><button class="btn primary" id="new-menu-item" '+(menu?"":"disabled")+'><i data-lucide="plus"></i>Add link</button></div></div>'+
  '<div class="card" style="margin-bottom:18px"><label>Menu<select id="menu-select">'+menus.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' · '+esc(x.location)+'</option>').join("")+'</select></label></div>'+
  '<div class="card"><div class="section-head"><h3>'+(menu?esc(menu.name):"No menu")+'</h3><span class="badge neutral">'+items.length+' items</span></div><div class="menu-builder">'+(items.length?items.map((x,i)=>'<div class="menu-item-row"><div><strong>'+esc(x.label)+'</strong><div class="tiny muted">'+esc(x.url)+'</div></div><div class="layout-actions"><button class="icon-btn menu-up" data-id="'+x.id+'"><i data-lucide="chevron-up"></i></button><button class="icon-btn menu-down" data-id="'+x.id+'"><i data-lucide="chevron-down"></i></button><button class="icon-btn edit-menu-item" data-id="'+x.id+'"><i data-lucide="pencil"></i></button><button class="icon-btn delete-menu-item" data-id="'+x.id+'"><i data-lucide="trash-2"></i></button></div></div>').join(""):'<div class="empty">Add your first navigation link.</div>')+'</div></div>';
}
function currentMenu(){return ctx.state.design.menus?.[0]||null}
function openMenu(){
  ctx.openModal('<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>Create menu</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="menu-form"><label>Name<input name="name" required></label><label style="margin-top:14px">Slug<input name="slug" placeholder="main-menu"></label><label style="margin-top:14px">Location<select name="location"><option>header</option><option>footer</option><option>sidebar</option></select></label><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Create</button></div></form></div></div>');ctx.icons();document.querySelector("#close-modal").onclick=ctx.closeModal;document.querySelector("#cancel-modal").onclick=ctx.closeModal;document.querySelector("#menu-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),name=f.get("name").trim(),slug=(f.get("slug")||name.toLowerCase().replace(/[^a-z0-9]+/g,"-")).replace(/^-|-$/g,"-");const r=await ctx.supabase.from("menus").insert({user_id:ctx.state.user.id,site_id:ctx.state.selectedSite.id,name,slug,location:f.get("location")}).select().single();if(r.error){ctx.toast(r.error.message);return}ctx.state.design.menus.push(r.data);ctx.closeModal();renderDesignViews();ctx.toast("Menu created","success")}};
function openMenuItem(item=null){
  const menu=currentMenu();if(!menu)return;
  ctx.openModal('<div class="modal-backdrop"><div class="modal"><div class="modal-head"><h3>'+(item?"Edit navigation link":"Add navigation link")+'</h3><button class="icon-btn" id="close-modal"><i data-lucide="x"></i></button></div><form id="menu-item-form"><label>Label<input name="label" required value="'+esc(item?.label||"")+'"></label><label style="margin-top:14px">URL<input name="url" required value="'+esc(item?.url||"/")+'"></label><label style="margin-top:14px">Target<select name="target"><option value="_self" '+(item?.target!=="_blank"?"selected":"")+'>Same tab</option><option value="_blank" '+(item?.target==="_blank"?"selected":"")+'>New tab</option></select></label><div class="modal-actions"><button type="button" class="btn secondary" id="cancel-modal">Cancel</button><button class="btn primary">Save</button></div></form></div></div>');ctx.icons();document.querySelector("#close-modal").onclick=ctx.closeModal;document.querySelector("#cancel-modal").onclick=ctx.closeModal;document.querySelector("#menu-item-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),payload={user_id:ctx.state.user.id,site_id:ctx.state.selectedSite.id,menu_id:menu.id,label:f.get("label").trim(),url:f.get("url").trim(),target:f.get("target"),position:item?.position??ctx.state.design.menuItems.filter(x=>x.menu_id===menu.id).length};const r=item?await ctx.supabase.from("menu_items").update(payload).eq("id",item.id).select().single():await ctx.supabase.from("menu_items").insert(payload).select().single();if(r.error){ctx.toast(r.error.message);return}if(item)ctx.state.design.menuItems=ctx.state.design.menuItems.map(x=>x.id===item.id?r.data:x);else ctx.state.design.menuItems.push(r.data);ctx.closeModal();renderDesignViews();ctx.toast("Navigation saved","success")};
}
async function moveMenu(id,dir){
  const menu=currentMenu();if(!menu)return;const a=ctx.state.design.menuItems.filter(x=>x.menu_id===menu.id),i=a.findIndex(x=>x.id===id),j=i+dir;if(i<0||j<0||j>=a.length)return;const tmp=a[i];a[i]=a[j];a[j]=tmp;for(let k=0;k<a.length;k++)await ctx.supabase.from("menu_items").update({position:k}).eq("id",a[k].id);ctx.state.design.menuItems=ctx.state.design.menuItems.map(x=>{const n=a.find(v=>v.id===x.id);return n||x});renderDesignViews();
}
async function deleteMenuItem(id){if(!confirm("Delete this link?"))return;const r=await ctx.supabase.from("menu_items").delete().eq("id",id);if(r.error){ctx.toast(r.error.message);return}ctx.state.design.menuItems=ctx.state.design.menuItems.filter(x=>x.id!==id);renderDesignViews()}
function themeView(){
  const t=ctx.state.design.theme||{};
  return '<section class="card theme-settings-card"><div class="section-head"><div><h3>Theme settings</h3><p class="muted">Global visual settings for the selected website.</p></div><span class="badge neutral">Design tokens</span></div><form id="theme-settings-form"><div class="form-grid"><label>Primary color<input type="color" name="primary_color" value="'+esc(t.primary_color||"#4f46e5")+'"></label><label>Accent color<input type="color" name="accent_color" value="'+esc(t.accent_color||"#7c3aed")+'"></label><label>Background<input type="color" name="background_color" value="'+esc(t.background_color||"#f6f8fc")+'"></label><label>Surface<input type="color" name="surface_color" value="'+esc(t.surface_color||"#ffffff")+'"></label><label>Text<input type="color" name="text_color" value="'+esc(t.text_color||"#111827")+'"></label><label>Font family<select name="font_family"><option>system-ui</option><option>Inter</option><option>Arial</option><option>Georgia</option><option>Verdana</option></select></label><label>Container width<input type="number" name="container_width" min="800" max="1800" value="'+(t.container_width||1200)+'"></label><label>Border radius<input type="number" name="border_radius" min="0" max="40" value="'+(t.border_radius||16)+'"></label><label class="full-field">Custom CSS<textarea name="custom_css" rows="6" class="cms-code">'+esc(t.custom_css||"")+'</textarea></label></div><div class="modal-actions"><button class="btn primary">Save theme settings</button></div></form></section>';
}
function renderDesignViews(){
  const s=ctx.state.selectedSite;
  if(!s){for(const id of ["layout","widgets","navigation"]){const el=document.querySelector("#view-"+id);if(el)el.innerHTML='<div class="card empty">Select a website first.</div>'}return}
  const l=document.querySelector("#view-layout");if(l)l.innerHTML=layoutView();
  const w=document.querySelector("#view-widgets");if(w)w.innerHTML=widgetsView();
  const n=document.querySelector("#view-navigation");if(n)n.innerHTML=navigationView();
  const theme=document.querySelector("#view-theme");if(theme&&!theme.querySelector(".theme-settings-card"))theme.insertAdjacentHTML("afterbegin",themeView());
  bind();
  ctx.icons();
}
function bind(){
  const qs=(s)=>document.querySelector(s);
  const qsa=(s)=>document.querySelectorAll(s);
  qsa(".layout-up").forEach(b=>b.onclick=()=>moveLayout(b.dataset.id,-1));
  qsa(".layout-down").forEach(b=>b.onclick=()=>moveLayout(b.dataset.id,1));
  qsa(".layout-toggle").forEach(b=>b.onclick=()=>toggleLayout(b.dataset.id));
  qs("#new-widget")?.addEventListener("click",()=>openWidget());
  qsa(".edit-widget").forEach(b=>b.onclick=()=>openWidget(ctx.state.design.widgets.find(x=>x.id===b.dataset.id)));
  qsa(".delete-widget").forEach(b=>b.onclick=()=>deleteWidget(b.dataset.id));
  qs("#new-menu")?.addEventListener("click",openMenu);
  qs("#new-menu-item")?.addEventListener("click",()=>openMenuItem());
  qsa(".edit-menu-item").forEach(b=>b.onclick=()=>openMenuItem(ctx.state.design.menuItems.find(x=>x.id===b.dataset.id)));
  qsa(".delete-menu-item").forEach(b=>b.onclick=()=>deleteMenuItem(b.dataset.id));
  qsa(".menu-up").forEach(b=>b.onclick=()=>moveMenu(b.dataset.id,-1));
  qsa(".menu-down").forEach(b=>b.onclick=()=>moveMenu(b.dataset.id,1));
  qs("#menu-select")?.addEventListener("change",e=>{const selected=ctx.state.design.menus.find(x=>x.id===e.target.value);if(selected){ctx.state.design.menus=[selected,...ctx.state.design.menus.filter(x=>x.id!==selected.id)]}renderDesignViews()});
  qs("#theme-settings-form")?.addEventListener("submit",async e=>{e.preventDefault();const f=new FormData(e.target),payload={primary_color:f.get("primary_color"),accent_color:f.get("accent_color"),background_color:f.get("background_color"),surface_color:f.get("surface_color"),text_color:f.get("text_color"),font_family:f.get("font_family"),container_width:Number(f.get("container_width")),border_radius:Number(f.get("border_radius")),custom_css:f.get("custom_css")};const r=await ctx.supabase.from("theme_settings").upsert({...payload,user_id:ctx.state.user.id,site_id:ctx.state.selectedSite.id},{onConflict:"site_id"}).select().single();if(r.error){ctx.toast(r.error.message);return}ctx.state.design.theme=r.data;ctx.closeModal();renderDesignViews();ctx.toast("Theme settings saved","success")});
}
function renderDesign(state,supabase){
  if(!ctx)return;
  if(ctx.state.selectedSite&&ctx.state.design.loadedSiteId!==ctx.state.selectedSite.id){loadDesign().then(renderDesignViews).catch(e=>ctx.toast(e.message));}
  renderDesignViews();
}
function initDesign(c){
  ctx={...c,openModal:html=>{document.querySelector("#modal-root").innerHTML=html},closeModal:()=>{document.querySelector("#modal-root").innerHTML=""}};
}
export {renderDesign,initDesign};
