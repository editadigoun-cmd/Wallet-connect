import {api} from "./client.js";

export const authApi={
  session:()=>api("/auth/get-session",{method:"GET"}),
  signIn:(email,password)=>api("/auth/sign-in/email",{method:"POST",body:JSON.stringify({email,password})}),
  signUp:(payload)=>api("/auth/sign-up/email",{method:"POST",body:JSON.stringify(payload)}),
  updateProfile:(payload)=>api("/profile",{method:"POST",body:JSON.stringify(payload)})
};
