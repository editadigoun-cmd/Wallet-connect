import {walletApi} from "../api/wallet.js";
export function initWallet({toast,refresh}){
  document.getElementById("topupForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("topupProvider").value;
      if(!provider){toast("Sélectionne un moyen de paiement");return}
      const amount=Number(document.getElementById("topupAmount").value||0),phone=document.getElementById("topupPhone").value.trim();
      if(!Number.isFinite(amount)||amount<=0||!phone){toast("Montant et numéro valides requis","error");return}
      if(!window.confirm("Confirmer la recharge de "+amount.toLocaleString("fr-FR")+" ?"))return;
      const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.classList.add("loading");
      const d=await walletApi.topup({amount,phone,provider});
      toast("Demande envoyée. Si le moyen de paiement demande une validation, confirme-la sur ton téléphone.");
      e.target.reset();poll("/topups/"+d.topup.reference+"/status","topup");
    }catch(ex){toast(ex.message,"error")}finally{const btn=e.target.querySelector("button[type=submit]");btn.disabled=false;btn.classList.remove("loading")}
  });
  document.getElementById("withdrawForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("withdrawProvider").value;
      if(!provider){toast("Sélectionne un moyen de retrait");return}
      const amount=Number(document.getElementById("withdrawAmount").value||0),phone=document.getElementById("withdrawPhone").value.trim();
      if(!Number.isFinite(amount)||amount<=0||!phone){toast("Montant et numéro valides requis","error");return}
      if(!window.confirm("Confirmer le retrait de "+amount.toLocaleString("fr-FR")+" ?"))return;
      const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.classList.add("loading");
      const d=await walletApi.withdraw({amount,phone,provider});
      toast("Demande de retrait envoyée");
      e.target.reset();poll("/withdrawals/"+d.withdrawal.reference+"/status","withdrawal");
    }catch(ex){toast(ex.message,"error")}finally{const btn=e.target.querySelector("button[type=submit]");btn.disabled=false;btn.classList.remove("loading")}
  });
  async function poll(path,kind){
    for(let i=0;i<12;i++){
      await new Promise(r=>setTimeout(r,3500));
      try{
        const d=await api(path),x=d[kind];
        if(x?.status==="successful"){toast(kind==="topup"?"Recharge confirmée":"Retrait confirmé");await refresh();return}
        if(x?.status==="failed"){toast(kind==="topup"?"Recharge refusée":"Retrait refusé");await refresh();return}
      }catch{}
    }
    toast("Opération toujours en cours — actualise Activité")
  }
}