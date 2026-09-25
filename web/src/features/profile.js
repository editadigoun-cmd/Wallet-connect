import {state} from "../state.js";import {profileApi} from "../api/profile.js";
export function initProfile({api,toast,render,show}){
  document.getElementById("saveProfileBtn").addEventListener("click",async()=>{
    try{
      const country=document.getElementById("profileCountrySelect").value;
      const full_name=document.getElementById("profileFullName").value.trim();
      const phone=document.getElementById("profilePhone").value.trim();
      if(!country){toast("Sélectionne ton pays");return}
      if(!full_name){toast("Renseigne ton nom complet");return}
      const d=await profileApi.update({country_code:country,full_name,phone});
      state.meData={...state.meData,...d.user};
      state.providers=await profileApi.providers(country);
      render();toast("Informations personnelles enregistrées");
    }catch(ex){toast(ex.message)}
  });
  document.getElementById("personalInfoBtn").addEventListener("click",()=>document.getElementById("personalInfoForm").scrollIntoView({behavior:"smooth",block:"center"}));
  document.getElementById("paymentMethodsBtn").addEventListener("click",()=>show("wallet"));
  document.getElementById("verificationBtn").addEventListener("click",()=>toast(state.meData?.kyc_status==="verified"?"Compte vérifié":"Vérification du compte à compléter prochainement"));
  document.getElementById("supportBtn").addEventListener("click",()=>toast("Support Wallet Connect : contacte l'équipe depuis le canal de support configuré."));
  document.getElementById("logoutBtn").addEventListener("click",async()=>{
    try{await profileApi.signOut()}catch{}
    state.meData=null;state.txs=[];show("auth");toast("Déconnexion réussie")
  })
}