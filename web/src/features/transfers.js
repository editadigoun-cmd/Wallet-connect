import {money} from "../services/format.js";import {state} from "../state.js";
export function initTransfers({api,toast,refresh,show}){
  const recipient=document.getElementById("recipient"),amount=document.getElementById("sendAmount"),form=document.getElementById("sendForm");
  function calcFee(a){
    const type=state.meData?.transfer_fee_type||"percentage", value=Number(state.meData?.transfer_fee_value||0);
    return type==="fixed"?Math.round(value):Math.round(a*value/100);
  }
  recipient.addEventListener("input",e=>{const v=e.target.value.trim();document.getElementById("recipientName").textContent=v||"Destinataire";document.getElementById("recipientAvatar").textContent=v?v.charAt(0).toUpperCase():"?"});
  amount.addEventListener("input",e=>{const a=Number(e.target.value||0),fee=calcFee(a),currency=state.meData?.currency||"XAF";document.getElementById("sendFee").textContent=money(fee,currency);document.getElementById("sendTotal").textContent=money(a+fee,currency)});
  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const a=Number(amount.value||0),r=recipient.value.trim();
    if(!r||!Number.isFinite(a)||a<=0){toast("Destinataire et montant valides requis");return}
    const fee=calcFee(a),currency=state.meData?.currency||"XAF";
    if(!window.confirm("Confirmer l'envoi de "+money(a,currency)+" à "+r+" ?\nFrais : "+money(fee,currency)+"\nTotal débité : "+money(a+fee,currency)))return;
    const btn=form.querySelector("button[type=submit]");btn.disabled=true;btn.classList.add("loading");
    try{
      await api("/transfer",{method:"POST",headers:{"Idempotency-Key":"transfer-"+crypto.randomUUID()},body:JSON.stringify({recipient:r,amount:a})});
      toast("Transfert effectué","success");form.reset();document.getElementById("sendFee").textContent=money(0,currency);document.getElementById("sendTotal").textContent=money(0,currency);await refresh();show("activity");
    }catch(ex){toast(ex.message,"error")}finally{btn.disabled=false;btn.classList.remove("loading")}
  })
}