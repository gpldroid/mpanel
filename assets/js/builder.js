const esc=v=>String(v??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const slug=v=>String(v||"").trim().toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\u0600-\u06ff]+/g,"-").replace(/^-+|-+$/g,"").slice(0,100)||"page";

function theme(state){
 const preset=(state.themePresets||[]).find(x=>x.id===state.activeThemePresetId)?.settings||{};
 const t={...(state.design?.theme||{}),...preset};
 return {primary:t.primary_color||"#4f46e5",accent:t.accent_color||"#7c3aed",bg:t.background_color||"#f6f8fc",surface:t.surface_color||"#fff",text:t.text_color||"#111827",font:t.font_family||"system-ui",width:Number(t.container_width)||1200,radius:Number(t.border_radius)||16,custom:t.custom_css||""};
}
function depth(path){return String(path||"").split("/").filter(Boolean).length>1?1:0}
function href(path,current="index.html"){
 const clean=String(path||"").replace(/^\//,"");
 const d=current==="index.html"?0:1;
 return (d?"../":"./")+clean;
}
function navHtml(state,current){
 const items=(state.design?.menuItems||[]).filter(x=>x.enabled).sort((a,b)=>a.position-b.position);
 return items.map(x=>'<a href="'+esc(normalizeLink(x.url,current))+'" target="'+esc(x.target||"_self")+'">'+esc(x.label)+'</a>').join("");
}
function normalizeLink(url,current){
 if(!url)return "#";
 if(/^(https?:|mailto:|tel:|#)/i.test(url))return url;
 return href(url,current);
}
function widgetHtml(w,state,current){
 const c=w.config||{},type=w.widget_type;
 if(type==="html")return c.html||"";
 if(type==="text")return "<p>"+esc(c.text||w.title||"")+"</p>";
 if(type==="recent_posts")return '<div class="widget-list">'+(state.posts||[]).filter(p=>p.status==="published").slice(0,Number(c.limit)||5).map(p=>'<a href="'+esc(href("posts/"+slug(p.slug)+".html",current))+'">'+esc(p.title)+'</a>').join("")+"</div>";
 if(type==="categories")return '<div class="widget-list">'+(state.categories||[]).map(x=>'<a href="'+esc(href("category/"+slug(x.slug)+".html",current))+'">'+esc(x.name)+'</a>').join("")+"</div>";
 if(type==="tags")return '<div class="widget-list">'+(state.tags||[]).map(x=>'<a href="'+esc(href("tag/"+slug(x.slug)+".html",current))+'">'+esc(x.name)+'</a>').join("")+"</div>";
 if(type==="search")return '<form action="'+esc(href("search.html",current))+'"><input name="q" placeholder="'+esc(c.placeholder||"Search")+'"><button>Search</button></form>';
 if(type==="social")return '<div class="social-links">'+(c.links||[]).map(x=>'<a href="'+esc(x.url)+'" target="_blank" rel="noopener">'+esc(x.label||x.url)+'</a>').join("")+"</div>";
 return c.html||"";
}
function region(state,key,current){
 const sec=(state.design?.layout||[]).find(x=>x.section_key===key);
 if(sec&&!sec.enabled)return "";
 return (state.design?.widgets||[]).filter(w=>w.enabled&&w.section_key===key).sort((a,b)=>a.position-b.position).map(w=>'<section class="widget"><h3>'+esc(w.title||"")+'</h3>'+widgetHtml(w,state,current)+"</section>").join("");
}
function blockHtml(b,state,current,context={}){
 const c=b.content||{};
 if(b.block_type==="content")return context.content||"";
 if(b.block_type==="hero")return '<section class="builder-hero"><h1>'+esc(c.title||"")+'</h1><p>'+esc(c.text||"")+'</p>'+(c.button_text?'<a class="btn" href="'+esc(normalizeLink(c.button_url||"#",current))+'">'+esc(c.button_text)+'</a>':"")+"</section>";
 if(b.block_type==="text")return "<section><p>"+esc(c.text||"")+"</p></section>";
 if(b.block_type==="html"||b.block_type==="custom")return c.html||"";
 if(b.block_type==="image")return c.url?'<section><a href="'+esc(normalizeLink(c.link||"#",current))+'"><img src="'+esc(c.url)+'" alt="'+esc(c.alt||"")+'" loading="lazy"></a></section>':"";
 if(b.block_type==="cta")return '<section class="builder-cta"><h2>'+esc(c.title||"")+'</h2><p>'+esc(c.text||"")+'</p>'+(c.button_text?'<a class="btn" href="'+esc(normalizeLink(c.button_url||"#",current))+'">'+esc(c.button_text)+'</a>':"")+"</section>";
 if(b.block_type==="menu")return '<nav class="builder-menu">'+navHtml(state,current)+"</nav>";
 if(b.block_type==="posts")return '<section><h2>'+esc(c.title||"Latest posts")+'</h2><div class="post-list">'+(state.posts||[]).filter(p=>p.status==="published").slice(0,Number(c.limit)||6).map(p=>'<article class="post-card"><h3><a href="'+esc(href("posts/"+slug(p.slug)+".html",current))+'">'+esc(p.title)+'</a></h3><p>'+esc(p.excerpt||p.meta_description||"")+"</p></article>").join("")+"</div></section>";
 return "";
}
function templateBlocks(state,type,area,context={}){
 const t=(state.builderTemplates||[]).find(x=>x.template_type===type&&x.is_default)|| (state.builderTemplates||[]).find(x=>x.template_type===type)|| (state.builderTemplates||[]).find(x=>x.template_type==="site"&&x.is_default);
 if(!t)return "";
 return (state.builderBlocks||[]).filter(x=>x.template_id===t.id&&x.enabled&&(!area||x.area===area)).sort((a,b)=>a.position-b.position).map(x=>blockHtml(x,state,context.current||"index.html",context)).join("");
}
function baseCss(t){
 return ':root{--primary:'+t.primary+';--accent:'+t.accent+';--bg:'+t.bg+';--surface:'+t.surface+';--text:'+t.text+';--radius:'+t.radius+'px}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font-family:'+t.font+',system-ui,sans-serif;line-height:1.7}.container{width:min('+t.width+'px,calc(100% - 32px));margin:auto}.site-header{background:var(--surface);border-bottom:1px solid #e2e8f0}.site-header .container{min-height:70px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{font-weight:900;color:var(--text);text-decoration:none}.site-header nav{display:flex;gap:16px;flex-wrap:wrap}.site-header nav a,.widget a,a{color:var(--primary);text-decoration:none}.page-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:28px;padding-top:32px;padding-bottom:40px}.content{background:var(--surface);padding:28px;border-radius:var(--radius)}aside{display:grid;align-content:start;gap:16px}.widget{background:var(--surface);padding:18px;border-radius:var(--radius);border:1px solid #e2e8f0}.widget h3{margin-top:0}.widget-list{display:grid;gap:7px}.social-links{display:flex;gap:10px;flex-wrap:wrap}.site-footer{padding:28px 0;background:var(--surface);border-top:1px solid #e2e8f0}.post-list{display:grid;gap:20px}.post-card{padding:18px;border:1px solid #e2e8f0;border-radius:var(--radius)}input,button{font:inherit;padding:10px;border:1px solid #cbd5e1;border-radius:8px}button,.btn{background:var(--primary);color:#fff;cursor:pointer}img{max-width:100%;height:auto}.builder-hero,.builder-cta{padding:34px;border-radius:var(--radius);background:linear-gradient(135deg,var(--surface),#eef2ff);margin-bottom:18px}.builder-menu{display:flex;gap:16px;flex-wrap:wrap;padding:12px 0}.builder-menu a{color:var(--primary)}@media(max-width:800px){.page-grid{grid-template-columns:1fr}.site-header .container{align-items:flex-start;flex-direction:column;padding:14px 0}}'+t.custom;
}
function analyticsTracker(state){
 const a=state.analyticsSettings;if(!a?.enabled||a.track_page_views===false||!a.public_key)return "";
 const key=JSON.stringify(a.public_key),endpoint=JSON.stringify("https://rzlginzjvakxboeacscd.supabase.co"),apiKey=JSON.stringify("sb_publishable_welr6vOLG1OHqsSyhF8MbQ_ps-k4deE");
 const ref=a.track_referrers===false?"":"document.referrer";
 return '<script>(function(){try{var k='+key+',u='+endpoint+',a='+apiKey+',s=sessionStorage.getItem("mpanel-analytics-session");if(!s){s=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random();sessionStorage.setItem("mpanel-analytics-session",s)};fetch(u+"/rest/v1/rpc/record_analytics_event",{method:"POST",headers:{"Content-Type":"application/json",apikey:a},body:JSON.stringify({p_public_key:k,p_path:location.pathname,p_referrer:'+ref+',p_session_id:s,p_user_agent:navigator.userAgent,p_event_type:"page_view"})}).catch(function(){})}catch(e){}})();</script>';
}
function canonicalFor(state,path){
 const base=(state.siteSeo?.canonical_base||state.selectedSite?.url||"").replace(/\/$/,"");
 if(!base)return "";
 return base+(path==="index.html"?"/":"/"+path);
}
function shell(state,title,description,content,current,options={}){
 const t=theme(state),seo=state.siteSeo||{},canonical=canonicalFor(state,current),robots=options.robots||((seo.robots_index===false?"noindex":"index")+", "+(seo.robots_follow===false?"nofollow":"follow"));
 const schemaObject=options.schema||((seo.schema_json&&Object.keys(seo.schema_json).length)?seo.schema_json:{"@context":"https://schema.org","@type":seo.schema_type||"WebSite","name":seo.site_title||state.selectedSite?.name||"Website","url":canonical||state.selectedSite?.url||""});
 const schema=JSON.stringify(schemaObject);
 const cssHref=href("style.css",current);
 return '<!doctype html><html lang="'+esc(state.siteSeo?.language||"en")+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(title)+'</title><meta name="description" content="'+esc(description)+'"><meta name="robots" content="'+robots+'">'+(canonical?'<link rel="canonical" href="'+esc(canonical)+'">':"")+(seo.og_image?'<meta property="og:image" content="'+esc(seo.og_image)+'">':"")+'<meta property="og:title" content="'+esc(seo.og_title||title)+'"><meta property="og:description" content="'+esc(seo.og_description||description)+'"><meta name="twitter:card" content="'+esc(seo.twitter_card||"summary_large_image")+'"><meta name="twitter:title" content="'+esc(seo.twitter_title||title)+'"><meta name="twitter:description" content="'+esc(seo.twitter_description||description)+'">'+(seo.twitter_image?'<meta name="twitter:image" content="'+esc(seo.twitter_image)+'">':"")+'<script type="application/ld+json">'+schema.replace(/<\/script/gi,"<\\/script")+'</script>'+(seo.custom_head||"")+'<link rel="stylesheet" href="'+esc(cssHref)+'"></head><body><header class="site-header"><div class="container"><a class="brand" href="'+esc(href("index.html",current))+'">'+esc(state.selectedSite?.name||"Website")+'</a><nav>'+navHtml(state,current)+'</nav></div></header><div class="container page-grid"><main class="content">'+content+'</main><aside>'+region(state,"sidebar",current)+'</aside></div><footer class="site-footer"><div class="container">'+region(state,"footer",current)+'<small>© '+new Date().getFullYear()+" "+esc(state.selectedSite?.name||"Website")+'</small></div></footer>'+analyticsTracker(state)+'</body></html>';
}
function renderTemplateContent(state,type,fallback,current,context={}){
 const generated=templateBlocks(state,type,null,{...context,current});
 return generated||fallback;
}
function postContent(p,state,current){
 const fallback="<article><header><h1>"+esc(p.title)+"</h1>"+(p.published_at?"<small>"+esc(new Date(p.published_at).toLocaleDateString())+"</small>":"")+(p.featured_image?"<img src=\""+esc(p.featured_image)+"\" alt=\""+esc(p.title)+"\" loading=\"eager\">":"")+"</header><div>"+p.content+"</div></article>";
 const schema={"@context":"https://schema.org","@type":p.schema_type||"BlogPosting","headline":p.title,"description":p.meta_description||p.excerpt||"","datePublished":p.published_at||undefined,"dateModified":p.updated_at||undefined,"mainEntityOfPage":canonicalFor(state,current)||undefined,"image":p.featured_image?[p.featured_image]:undefined};
 Object.keys(schema).forEach(k=>schema[k]===undefined&&delete schema[k]);
 return {content:renderTemplateContent(state,"post",fallback,current,{content:fallback}),schema};
}
function pageContent(p,state,current){
 const fallback="<article><h1>"+esc(p.title)+"</h1><div>"+p.content+"</div></article>";
 const schema={"@context":"https://schema.org","@type":"WebPage","name":p.title,"description":p.meta_description||"","url":canonicalFor(state,current)||undefined,"dateModified":p.updated_at||undefined};
 Object.keys(schema).forEach(k=>schema[k]===undefined&&delete schema[k]);
 return {content:renderTemplateContent(state,"page",fallback,current,{content:fallback}),schema};
}
function archiveContent(state,current){
 const posts=(state.posts||[]).filter(p=>p.status==="published");
 const fallback="<section><h1>Archive</h1><div class=\"post-list\">"+posts.map(p=>"<article class=\"post-card\"><h2><a href=\""+esc(href("posts/"+slug(p.slug)+".html",current))+"\">"+esc(p.title)+"</a></h2><p>"+esc(p.excerpt||p.meta_description||"")+"</p></article>").join("")+"</div></section>";
 return {content:renderTemplateContent(state,"archive",fallback,current,{content:fallback}),schema:{"@context":"https://schema.org","@type":"CollectionPage","name":"Archive","url":canonicalFor(state,current)||undefined}};
}
function notFoundContent(state,current){
 const fallback="<section><h1>Page not found</h1><p>The page you requested could not be found.</p><a class=\"btn\" href=\""+esc(href("index.html",current))+"\">Back to home</a></section>";
 return {content:renderTemplateContent(state,"404",fallback,current,{content:fallback}),schema:{"@context":"https://schema.org","@type":"WebPage","name":"Page not found"}};
}

export function buildSiteFiles(state){
 const files=[],published=(state.posts||[]).filter(p=>p.status==="published"),pages=(state.pages||[]).filter(p=>p.status==="published");
 const homeFallback='<section><h1>'+esc(state.siteSeo?.site_title||state.selectedSite?.name||"Website")+'</h1><p>'+esc(state.siteSeo?.meta_description||state.selectedSite?.description||"")+'</p><div class="post-list">'+published.slice(0,10).map(p=>'<article class="post-card"><h2><a href="'+esc(href("posts/"+slug(p.slug)+".html","index.html"))+'">'+esc(p.title)+'</a></h2><p>'+esc(p.excerpt||p.meta_description||"")+'</p></article>').join("")+'</div></section>';
 const home=renderTemplateContent(state,"site",homeFallback,"index.html");
 files.push({path:"index.html",content:shell(state,state.siteSeo?.site_title||state.selectedSite?.name||"Website",state.siteSeo?.meta_description||"",home,"index.html"),mime_type:"text/html"});
 files.push({path:"style.css",content:baseCss(theme(state)),mime_type:"text/css"});
 for(const p of published){
  const current="posts/"+slug(p.slug)+".html";
  const built=postContent(p,state,current);
  files.push({path:current,content:shell(state,p.meta_title||p.title,p.meta_description||p.excerpt||"",built.content,current,{schema:built.schema}),mime_type:"text/html"});
 }
 for(const p of pages){
  const current="pages/"+slug(p.slug)+".html";
  const built=pageContent(p,state,current);
  files.push({path:current,content:shell(state,p.meta_title||p.title,p.meta_description||"",built.content,current,{schema:built.schema}),mime_type:"text/html"});
 }
 const archive=archiveContent(state,"archive.html");
 files.push({path:"archive.html",content:shell(state,"Archive","Browse published content.",archive.content,"archive.html",{schema:archive.schema}),mime_type:"text/html"});
 const notFound=notFoundContent(state,"404.html");
 files.push({path:"404.html",content:shell(state,"Page not found","The requested page could not be found.",notFound.content,"404.html",{schema:notFound.schema,robots:"noindex, nofollow"}),mime_type:"text/html"});
 const base=(state.siteSeo?.canonical_base||state.selectedSite?.url||"").replace(/\/$/,"");
 const urls=[base+"/",...published.map(p=>base+"/posts/"+slug(p.slug)+".html"),...pages.map(p=>base+"/pages/"+slug(p.slug)+".html")].filter(Boolean);
 if(state.siteSeo?.sitemap_enabled!==false)files.push({path:"sitemap.xml",content:'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls.map(u=>"<url><loc>"+esc(u)+"</loc></url>").join("")+"</urlset>",mime_type:"application/xml"});
 const robots=state.siteSeo?.robots_txt||("User-agent: *\nAllow: /\n"+(base?"\nSitemap: "+base+"/sitemap.xml":""));
 files.push({path:"robots.txt",content:robots,mime_type:"text/plain"});\n files.push({path:".nojekyll",content:"",mime_type:"text/plain"});
 const redirects=(state.redirects||[]).filter(x=>x.enabled);
 if(redirects.length)files.push({path:"_redirects",content:redirects.map(x=>x.from_path+" "+x.to_path+" "+x.status_code).join("\n")+"\n",mime_type:"text/plain"});
 return files;
}
export function buildPreview(state){return buildSiteFiles(state).find(x=>x.path==="index.html")?.content||"";}
