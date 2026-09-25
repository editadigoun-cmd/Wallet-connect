import {state} from "./state.js";
import {api} from "./api/client.js";
import {authApi} from "./api/auth.js";
import {fillCountries} from "./services/countries.js";
import {toast} from "./ui/toast.js";
import {show,initNavigation} from "./ui/navigation.js";
import {render} from "./ui/render.js";
import {initAuth} from "./features/auth.js?v=20260925b";
import {initWallet} from "./features/wallet.js";
import {initTransfers} from "./features/transfers.js";
import {initProfile} from "./features/profile.js";

window.__walletState=state;

async function refresh(){
  const data=await api("/me");
  state.meData=data.user;
  state.txs=data.transactions||[];
  try{
    state.providers=await api("/providers?country="+encodeURIComponent(data.user.country_code||""));
  }catch{
    state.providers={
      depositProviders:[],
      payoutProviders:[],
      country:data.user.country_code||"",
      currency:data.user.currency||"XAF"
    };
  }
  render();
}

async function enterApp(){
  document.getElementById("footer").style.display="";
  show("home");
  await refresh();
}

async function checkSession(){
  try{
    const data=await authApi.session();
    if(data?.user)await enterApp();
    else show("auth");
  }catch{
    show("auth");
  }
}

function initUi(){
  initNavigation();
  initAuth({fillCountries,toast,enterApp});
  initWallet({toast,refresh});
  initTransfers({toast,refresh});
  initProfile({toast,render,show});

  document.getElementById("toggleBalance").addEventListener("click",()=>{
    state.hidden=!state.hidden;
    render();
  });

  document.querySelectorAll(".tab").forEach(button=>{
    button.addEventListener("click",()=>{
      document.querySelectorAll(".tab").forEach(item=>item.classList.remove("active"));
      button.classList.add("active");
      state.activityFilter=button.dataset.filter||"all";
      render();
    });
  });
}

document.addEventListener("DOMContentLoaded",()=>{
  initUi();
  show("auth");
  checkSession();
});
