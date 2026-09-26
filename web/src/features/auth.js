import {state} from "../state.js";
import {authApi} from "../api/auth.js";

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

        // Complete the authentication session before writing the Wallet Connect profile.
        // This also recovers accounts created by an earlier interrupted registration.
        let created=true;
        try{
          await authApi.signUp({email,password,name,country_code});
        }catch(signupError){
          const message=String(signupError?.message||"").toLowerCase();
          const duplicate=signupError?.status===409 || signupError?.code==="USER_ALREADY_EXISTS" || message.includes("existe déjà") || message.includes("already exists") || message.includes("already registered");
          if(!duplicate)throw signupError;
          created=false;
        }

        // sign-in guarantees a usable session after signup and repairs a partial signup.
        await authApi.signIn(email,password);
        await authApi.updateProfile({country_code,name});
        toast(created?"Compte créé":"Compte récupéré");
      }else{
        await authApi.signIn(email,password);
        toast("Connexion réussie");
      }
      await enterApp();
    }catch(errorValue){
      const message=String(errorValue?.message||"");
      if(errorValue?.status===401 && state.authMode==="signup"){
        error.textContent="Impossible de finaliser l'inscription. Vérifie ton adresse e-mail et ton mot de passe, puis réessaie.";
      }else{
        error.textContent=message||"Une erreur est survenue.";
      }
      error.style.display="block";
    }finally{
      button.disabled=false;
    }
  });
}
