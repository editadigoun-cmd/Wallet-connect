import {API} from "../config.js";

export async function api(path,opts={}){
  const headers=new Headers(opts.headers||{});
  if(opts.body!==undefined && !headers.has("Content-Type")){
    headers.set("Content-Type","application/json");
  }

  let response;
  try{
    response=await fetch(API+path,{
      ...opts,
      headers,
      credentials:"include"
    });
  }catch{
    throw new Error("Connexion au serveur impossible. Vérifie ta connexion internet.");
  }

  let data={};
  try{
    data=await response.json();
  }catch{
    data={};
  }

  if(!response.ok){
    const error=new Error(data.error||data.message||"Une erreur est survenue.");
    error.status=response.status;
    error.code=data.code||"API_ERROR";
    error.data=data;
    throw error;
  }

  return data;
}
