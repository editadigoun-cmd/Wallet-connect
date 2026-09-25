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
      const email=el("authEmail").value.trim();
      const password=el("authPassword").value;
      if(state.authMode==="signup"){
        const country_code=el("authCountry").value;
        if(!country_code)throw new Error("Sélectionne ton pays");
        await authApi.signUp({email,password,name:el("authName").value.trim(),country_code});
        await authApi.updateProfile({country_code});
        toast("Compte créé");
      }else{
        await authApi.signIn(email,password);
        toast("Connexion réussie");
      }
      await enterApp();
    }catch(errorValue){
      error.textContent=errorValue?.message||"Une erreur est survenue.";
      error.style.display="block";
    }finally{
      button.disabled=false;
    }
  });
}
