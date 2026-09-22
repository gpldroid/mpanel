import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const supabase=createClient(SUPABASE_URL.trim().replace(/\/$/,""),SUPABASE_ANON_KEY.trim());
const button=document.querySelector("#github-auth-btn");

function redirectUrl(){
  const url=new URL(window.location.href);
  url.hash="";
  url.search="";
  return url.href;
}

function setBusy(busy){
  if(!button)return;
  button.disabled=busy;
  const label=button.querySelector("span:last-child");
  if(label)label.textContent=busy?"Connecting to GitHub…":"Continue with GitHub";
}

button?.addEventListener("click",async()=>{
  setBusy(true);
  try{
    const {data,error}=await supabase.auth.signInWithOAuth({
      provider:"github",
      options:{
        redirectTo:redirectUrl(),
        scopes:"repo read:user user:email"
      }
    });
    if(error)throw error;
    if(data?.url)window.location.assign(data.url);
    else throw new Error("Supabase did not return a GitHub authorization URL.");
  }catch(error){
    console.error("[mPanel GitHub auth]",error);
    const toast=document.createElement("div");
    toast.className="toast";
    toast.textContent=String(error?.message||"GitHub sign-in could not be started.");
    document.querySelector("#toast-root")?.append(toast);
    setTimeout(()=>toast.remove(),5000);
    setBusy(false);
  }
});

supabase.auth.onAuthStateChange((event,session)=>{
  if(event==="SIGNED_IN"&&session?.provider_token){
    console.info("[mPanel GitHub auth] GitHub provider session received.");
  }
});
