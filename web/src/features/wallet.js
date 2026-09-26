import {walletApi} from "../api/wallet.js";

export function initWallet({toast,refresh}){
  const updateFeeSummaries=()=>{
    const amount=Number(document.getElementById("topupAmount")?.value||0);
    const currency=window.__walletState?.meData?.currency||"XOF";
    const fee=Math.round(amount*0.07);
    const topupFee=document.getElementById("topupFee");
    const topupTotal=document.getElementById("topupTotal");
    if(topupFee)topupFee.textContent=fee.toLocaleString("fr-FR")+" "+currency;
    if(topupTotal)topupTotal.textContent=(amount+fee).toLocaleString("fr-FR")+" "+currency;
    const withdrawalAmount=Number(document.getElementById("withdrawAmount")?.value||0);
    const withdrawFee=document.getElementById("withdrawFeeDetail");
    const withdrawNet=document.getElementById("withdrawNet");
    if(withdrawFee)withdrawFee.textContent="0 "+currency;
    if(withdrawNet)withdrawNet.textContent=withdrawalAmount.toLocaleString("fr-FR")+" "+currency;
  };
  document.getElementById("topupAmount")?.addEventListener("input",updateFeeSummaries);
  document.getElementById("withdrawAmount")?.addEventListener("input",updateFeeSummaries);
  updateFeeSummaries();
  document.getElementById("topupForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("topupProvider").value;
      if(!provider){toast("Sélectionne un moyen de paiement");return}
      const amount=Number(document.getElementById("topupAmount").value||0);
      const phone=document.getElementById("topupPhone").value.trim();
      if(!Number.isFinite(amount)||amount<=0||!phone){toast("Montant et numéro valides requis","error");return}
      const fee=Math.round(amount*0.07);const total=amount+fee;if(!window.confirm("Confirmer la recharge de "+amount.toLocaleString("fr-FR")+" ?\n\nFrais de service : "+fee.toLocaleString("fr-FR")+"\nTotal débité : "+total.toLocaleString("fr-FR")))return;
      const btn=e.target.querySelector("button[type=submit]");
      btn.disabled=true;btn.classList.add("loading");
      const d=await walletApi.topup({amount,phone,provider});
      toast("Demande envoyée. Si le moyen de paiement demande une validation, confirme-la sur ton téléphone.");
      e.target.reset();
      poll(walletApi.topupStatusPath(d.topup.reference),"topup");
    }catch(ex){toast(ex.message,"error")}
    finally{
      const btn=e.target.querySelector("button[type=submit]");
      btn.disabled=false;btn.classList.remove("loading");
    }
  });

  document.getElementById("withdrawForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("withdrawProvider").value;
      if(!provider){toast("Sélectionne un moyen de retrait");return}
      const amount=Number(document.getElementById("withdrawAmount").value||0);
      const phone=document.getElementById("withdrawPhone").value.trim();
      if(!Number.isFinite(amount)||amount<=0||!phone){toast("Montant et numéro valides requis","error");return}
      if(!window.confirm("Confirmer le retrait de "+amount.toLocaleString("fr-FR")+" ?\n\nFrais de retrait : 0\nMontant reçu : "+amount.toLocaleString("fr-FR")))return;
      const btn=e.target.querySelector("button[type=submit]");
      btn.disabled=true;btn.classList.add("loading");
      const d=await walletApi.withdraw({amount,phone,provider});
      toast("Demande de retrait envoyée");
      e.target.reset();
      poll(walletApi.withdrawStatusPath(d.withdrawal.reference),"withdrawal");
    }catch(ex){toast(ex.message,"error")}
    finally{
      const btn=e.target.querySelector("button[type=submit]");
      btn.disabled=false;btn.classList.remove("loading");
    }
  });

  async function poll(path,kind){
    for(let i=0;i<12;i++){
      await new Promise(resolve=>setTimeout(resolve,3500));
      try{
        const d=await walletApi.status(path),x=d[kind];
        if(x?.status==="successful"){
          toast(kind==="topup"?"Recharge confirmée":"Retrait confirmé");
          await refresh();
          return;
        }
        if(x?.status==="failed"){
          toast(kind==="topup"?"Recharge refusée":"Retrait refusé","error");
          await refresh();
          return;
        }
      }catch{}
    }
    toast("Opération toujours en cours — actualise Activité");
  }
}
