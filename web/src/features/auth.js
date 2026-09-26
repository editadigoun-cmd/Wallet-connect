import {state} from "../state.js";
import {authApi} from "../api/auth.js";

const PENDING_PROFILE_KEY="wallet_connect_pending_profile";

export function initAuth({fillCountries,toast,enterApp}){
  const form=document.getElementById("authForm");
  const switchButton=document.getElementById("authSwitch");
  if(!form||!switchButton)return;

  const el=id=>document.getElementById(id);

  function toggle(){
    const signup=state.authMode!=="signup";
    state.authMode=signup?"signup":"login";
    el("authTitle").textContent=signup?"Créer un compte":"Connexion";
    el("authSubmit").textContent=signup?"Créer mon compte":"Se connecter";
    el("nameField").classList.toggle("hide",!signup);
    el("countryField").classList.toggle("hide",!signup);
    el("authCountry").required=signup;
    el("authSwitchText").textContent=signup?"Déjà un compte ?":"Pas encore de compte ?";
    switchButton.textContent=signup?"Se connecter":"Créer un compte";
    el("authPassword").autocomplete=signup?"new-password":"current-password";
    if(signup)fillCountries("authCountry");
  }

  switchButton.addEventListener("click",event=>{
    event.preventDefault();
    event.stopPropagation();
    toggle();
  });

  form.addEventListener("submit",async event=>{
    event.preventDefault();
    const error=el("authError");
    const button=el("authSubmit");
    error.style.display="none";
    button.disabled=true;

    try{
      const email=el("authEmail").value.trim().toLowerCase();
      const password=el("authPassword").value;

      if(state.authMode==="signup"){
        const country_code=el("authCountry").value;
        const name=el("authName").value.trim();
        if(!country_code)throw new Error("Sélectionne ton pays");
        if(!name)throw new Error("Indique ton nom complet");

        let signupResult;
        try{
          signupResult=await authApi.signUp({email,password,name,country_code});
        }catch(signupError){
          const message=String(signupError?.message||"").toLowerCase();
          const duplicate=signupError?.status===409 || signupError?.code==="USER_ALREADY_EXISTS" || message.includes("existe déjà") || message.includes("already exists") || message.includes("already registered");
          if(duplicate){
            // Do not silently treat an existing authentication account as a failed signup.
            // If the password is correct, recover the account; otherwise ask the user to sign in.
            try{
              await authApi.signIn(email,password);
              await authApi.updateProfile({country_code,full_name:name});
              localStorage.removeItem(PENDING_PROFILE_KEY);
              toast("Connexion réussie");
              await enterApp();
              return;
            }catch{
              throw new Error("Cette adresse e-mail est déjà utilisée. Connecte-toi avec ton compte existant.");
            }
          }
          throw signupError;
        }

        // Neon Auth can require e-mail verification before a session is issued.
        // Never call sign-in immediately after signup: doing so turns a valid signup
        // into a misleading 401 when verification is enabled.
        const hasSession=Boolean(
          signupResult?.token ||
          signupResult?.session ||
          signupResult?.data?.token ||
          signupResult?.data?.session
        );

        if(hasSession){
          await authApi.updateProfile({country_code,full_name:name});
          localStorage.removeItem(PENDING_PROFILE_KEY);
          toast("Compte créé");
          await enterApp();
          return;
        }

        localStorage.setItem(PENDING_PROFILE_KEY,JSON.stringify({email,country_code,full_name:name}));
        state.authMode="login";
        el("authTitle").textContent="Connexion";
        el("authSubmit").textContent="Se connecter";
        el("nameField").classList.add("hide");
        el("countryField").classList.add("hide");
        el("authCountry").required=false;
        el("authSwitchText").textContent="Pas encore de compte ?";
        switchButton.textContent="Créer un compte";
        error.textContent="Compte créé. Vérifie ton adresse e-mail si un message de confirmation t’a été envoyé, puis connecte-toi pour accéder à ton portefeuille.";
        error.style.display="block";
        toast("Compte créé");
        return;
      }

      await authApi.signIn(email,password);
      const pendingRaw=localStorage.getItem(PENDING_PROFILE_KEY);
      if(pendingRaw){
        try{
          const pending=JSON.parse(pendingRaw);
          if(pending.email===email){
            await authApi.updateProfile({country_code:pending.country_code,full_name:pending.full_name});
            localStorage.removeItem(PENDING_PROFILE_KEY);
          }
        }catch{}
      }
      toast("Connexion réussie");
      await enterApp();
    }catch(errorValue){
      const message=String(errorValue?.message||"");
      error.textContent=message||"Une erreur est survenue. Vérifie tes informations et réessaie.";
      error.style.display="block";
    }finally{
      button.disabled=false;
    }
  });
}
