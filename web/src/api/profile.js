import {api} from "./client.js";
export const profileApi={
  update:payload=>api("/profile",{method:"POST",body:JSON.stringify(payload)}),
  providers:country=>api("/providers?country="+encodeURIComponent(country)),
  signOut:()=>api("/auth/sign-out",{method:"POST",body:"{}"})
};
