import {API} from "../config.js";
export async function api(path,opts={}){const h=new Headers(opts.headers||{});h.set("Content-Type","application/json");const r=await fetch(API+path,{...opts,headers:h,credentials:"include"});let d={};try{d=await r.json()}catch{}if(!r.ok)throw new Error(d.error||"Une erreur est survenue");return d}
