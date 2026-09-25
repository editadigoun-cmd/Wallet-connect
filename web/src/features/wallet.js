export function initWallet({api,toast,refresh,show}){
  document.getElementById("topupForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("topupProvider").value;
      if(!provider){toast("Sélectionne un moyen de paiement");return}
      const d=await api("/topups",{method:"POST",headers:{"Idempotency-Key":"topup-"+crypto.randomUUID()},body:JSON.stringify({amount:Number(document.getElementById("topupAmount").value),phone:document.getElementById("topupPhone").value.trim(),provider})});
      toast("Demande envoyée. Si le moyen de paiement demande une validation, confirme-la sur ton téléphone.");
      e.target.reset();poll("/topups/"+d.topup.reference+"/status","topup")
    }catch(ex){toast(ex.message)}
  });
  document.getElementById("withdrawForm").addEventListener("submit",async e=>{
    e.preventDefault();
    try{
      const provider=document.getElementById("withdrawProvider").value;
      if(!provider){toast("Sélectionne un moyen de retrait");return}
      const d=await api("/withdrawals",{method:"POST",headers:{"Idempotency-Key":"withdraw-"+crypto.randomUUID()},body:JSON.stringify({amount:Number(document.getElementById("withdrawAmount").value),phone:document.getElementById("withdrawPhone").value.trim(),provider})});
      toast("Demande de retrait envoyée");
      e.target.reset();poll("/withdrawals/"+d.withdrawal.reference+"/status","withdrawal")
    }catch(ex){toast(ex.message)}
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