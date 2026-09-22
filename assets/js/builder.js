const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug=v=>String(v||"").trim().toLowerCase().normalize("NFKD").replace(/[\\u0300-\\u036f]/g,"").replace(/[^a-z0-9\\u0600-\\u06ff]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||"page";

function theme(state){
  const t=state.design.theme||{};
  return {
    primary:t.primary_color||"#4f46e5",accent:t.accent_color||"#7c3aed",
    bg:t.background_color||"#f6f8fc",surface:t.surface_color||"#fff",
    text:t.text_color||"#111827",font:t.font_family||"system-ui",
    width:Number(t.container_width)||1200,radius:Number(t.border_radius)||16,custom:t.custom_css||""
  };
}
function navHtml(state){
  const items=(state.design.menuItems||[]).filter(x=>x.enabled).sort((a,b)=>a.position-b.position);
  return items.map(x=>'<a href="'+esc(x.url)+'" target="'+esc(x.target||"_self")+'">'+esc(x.label)+'</a>').join("");
}
function widgetHtml(w,state){
  const c=w.config||{}, type=w.widget_type;
  if(type==="html")return c.html||"";
  if(type==="text")return "<p>"+esc(c.text||w.title||"")+"</p>";
  if(type==="recent_posts")return '<div class="widget-list">'+state.posts.filter(p=>p.status==="published").slice(0,Number(c.limit)||5).map(p=>'<a href="/posts/'+esc(p.slug)+'.html">'+esc(p.title)+'</a>').join("")+"</div>";
  if(type==="categories")return '<div class="widget-list">'+state.categories.map(x=>'<a href="/category/'+esc(x.slug)+'.html">'+esc(x.name)+'</a>').join("")+"</div>";
  if(type==="tags")return '<div class="widget-list">'+state.tags.map(x=>'<a href="/tag/'+esc(x.slug)+'.html">'+esc(x.name)+'</a>').join("")+"</div>";
  if(type==="search")return '<form action="/search.html"><input name="q" placeholder="'+esc(c.placeholder||"Search")+'"><button>Search</button></form>';
  if(type==="social")return '<div class="social-links">'+(c.links||[]).map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label||x.url)+'</a>').join("")+"</div>";
  return c.html||"";
}
function region(state,key){
  const sec=(state.design.layout||[]).find(x=>x.section_key===key);
  if(sec&&!sec.enabled)return "";
  return (state.design.widgets||[]).filter(w=>w.enabled&&w.section_key===key).sort((a,b)=>a.position-b.position).map(w=>'<section class="widget"><h3>'+esc(w.title||"")+'</h3>'+widgetHtml(w,state)+'</section>').join("");
}
function shell(state,title,description,content){
  const t=theme(state), seo=state.siteSeo||{}, canonical=seo.canonical_base||state.selectedSite?.url||"";
  const robots=(seo.robots_index===false?"noindex":"index")+", "+(seo.robots_follow===false?"nofollow":"follow");
  const schema=seo.schema_json&&Object.keys(seo.schema_json).length?JSON.stringify(seo.schema_json):JSON.stringify({"@context":"https://schema.org","@type":seo.schema_type||"WebSite","name":seo.site_title||state.selectedSite?.name||"Website","url":canonical});
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><meta name="robots" content="'+robots+'">'+(canonical?'<link rel="canonical" href="'+esc(canonical)+'">':"")+(seo.og_image?'<meta property="og:image" content="'+esc(seo.og_image)+'">':"")+'<meta property="og:title" content="'+esc(seo.og_title||title)+'"><meta property="og:description" content="'+esc(seo.og_description||description)+'"><meta name="twitter:card" content="'+esc(seo.twitter_card||"summary_large_image")+'"><meta name="twitter:title" content="'+esc(seo.twitter_title||title)+'"><meta name="twitter:description" content="'+esc(seo.twitter_description||description)+'">'+(seo.twitter_image?'<meta name="twitter:image" content="'+esc(seo.twitter_image)+'">':"")+'<script type="application/ld+json">'+schema.replace(/<\\/script/gi,"<\\\\/script")+'</script>'+(seo.custom_head||"")+'<style>'+baseCss(t)+'</style></head><body><header class="site-header"><div class="container"><a class="brand" href="/">'+esc(state.selectedSite?.name||"Website")+'</a><nav>'+navHtml(state)+'</nav></div></header><div class="container page-grid"><main class="content">'+content+'</main><aside>'+region(state,"sidebar")+'</aside></div><footer class="site-footer"><div class="container">'+region(state,"footer")+'<small>© '+new Date().getFullYear()+" "+esc(state.selectedSite?.name||"Website")+'</small></div></footer></body></html>';
}
function baseCss(t){
 return ':root{--primary:'+t.primary+';--accent:'+t.accent+';--bg:'+t.bg+';--surface:'+t.surface+';--text:'+t.text+';--radius:'+t.radius+'px}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'+t.font+',system-ui,sans-serif;line-height:1.7}.container{width:min('+t.width+'px,calc(100% - 32px));margin:auto}.site-header{background:var(--surface);border-bottom:1px solid #e2e8f0}.site-header .container{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:900;color:var(--text);text-decoration:none}.site-header nav{display:flex;gap:16px;flex-wrap:wrap}.site-header nav a,.widget a{color:var(--primary);text-decoration:none}.page-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:28px;padding-top:32px;padding-bottom:40px}.content{background:var(--surface);padding:28px;border-radius:var(--radius)}aside{display:grid;align-content:start;gap:16px}.widget{background:var(--surface);padding:18px;border-radius:var(--radius);border:1px solid #e2e8f0}.widget h3{margin-top:0}.widget-list{display:grid;gap:7px}.social-links{display:flex;gap:10px;flex-wrap:wrap}.site-footer{padding:28px 0;background:var(--surface);border-top:1px solid #e2e8f0}.post-list{display:grid;gap:20px}.post-card{padding:18px;border:1px solid #e2e8f0;border-radius:var(--radius)}input,button{font:inherit;padding:10px;border:1px solid #cbd5e1;border-radius:8px}button{background:var(--primary);color:#fff;cursor:pointer}img{max-width:100%;height:auto}@media(max-width:800px){.page-grid{grid-template-columns:1fr}.site-header .container{align-items:flex-start;flex-direction:column;padding:14px 0}}'+t.custom;
}
function postContent(p){return '<article><header><h1>'+esc(p.title)+'</h1>'+(p.published_at?'<small>'+esc(new Date(p.published_at).toLocaleDateString())+'</small>':"")+'</header><div>'+p.content+'</div></article>'}
function pageContent(p){return '<article><h1>'+esc(p.title)+'</h1><div>'+p.content+'</div></article>'}
export function buildSiteFiles(state){
 const files=[], published=(state.posts||[]).filter(p=>p.status==="published"), pages=(state.pages||[]).filter(p=>p.status==="published");
 const home='<section><h1>'+esc(state.siteSeo?.site_title||state.selectedSite?.name||"Website")+'</h1><p>'+esc(state.siteSeo?.meta_description||state.selectedSite?.description||"")+'</p><div class="post-list">'+published.slice(0,10).map(p=>'<article class="post-card"><h2><a href="/posts/'+esc(p.slug)+'.html">'+esc(p.title)+'</a></h2><p>'+esc(p.excerpt||p.meta_description||"")+'</p></article>').join("")+'</div></section>';
 files.push({path:"index.html",content:shell(state,state.siteSeo?.site_title||state.selectedSite?.name||"Website",state.siteSeo?.meta_description||"",home),mime_type:"text/html"});
 files.push({path:"style.css",content:baseCss(theme(state)),mime_type:"text/css"});
 for(const p of published)files.push({path:"posts/"+slug(p.slug)+".html",content:shell(state,p.meta_title||p.title,p.meta_description||p.excerpt||"",postContent(p)),mime_type:"text/html"});
 for(const p of pages)files.push({path:"pages/"+slug(p.slug)+".html",content:shell(state,p.meta_title||p.title,p.meta_description||"",pageContent(p)),mime_type:"text/html"});
 const base=(state.siteSeo?.canonical_base||state.selectedSite?.url||"").replace(/\\/$/,"");
 const urls=[base+"/",...published.map(p=>base+"/posts/"+slug(p.slug)+".html"),...pages.map(p=>base+"/pages/"+slug(p.slug)+".html")].filter(Boolean);
 if(state.siteSeo?.sitemap_enabled!==false)files.push({path:"sitemap.xml",content:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>'<url><loc>'+esc(u)+'</loc></url>').join("")+"</urlset>",mime_type:"application/xml"});
 files.push({path:"robots.txt",content:state.siteSeo?.robots_txt||"User-agent: *\\nAllow: /\\n\\nSitemap: /sitemap.xml",mime_type:"text/plain"});
 return files;
}
export function buildPreview(state){const files=buildSiteFiles(state);return files.find(x=>x.path==="index.html")?.content||"";}
