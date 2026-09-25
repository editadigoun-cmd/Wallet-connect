import {money} from "../services/format.js";
import {state} from "../state.js";
import {transferApi} from "../api/transfers.js";
import {walletApi} from "../api/wallet.js";
import {show} from "../ui/navigation.js";

export function initTransfers({toast,refresh}){
  const recipient=document.getElementById("recipient"),amount=document.getElementById("sendAmount"),form=document.getElementById("sendForm");
  const recipientName=document.getElementById("recipientName"),recipientMeta=document.getElementById("recipientMeta"),recipientAvatar=document.getElementById("recipientAvatar");
  let recipientData=null,timer=null;

  function calcTransferFee(a){
    const type=state.meData?.transfer_fee_type||"percentage", value=Number(state.meData?.transfer_fee_value||0);
    return type==="fixed"?Math.round(value):Math.round(a*value/100);
  }
  function lookup(){
    clearTimeout(timer);
    const v=recipient.value.trim().toUpperCase();
    recipientData=null;
    recipientName.textContent="Destinataire";
    recipientMeta.textContent="Saisis un identifiant Wallet Connect";
    recipientAvatar.textContent="?";
    recipient.classList.remove("valid","invalid");
    if(!v)return;
    if(!/^WC-[A-Z0-9]{12}$/.test(v)){recipientMeta.textContent="Format attendu : WC-XXXXXXXXXXXX";recipient.classList.add("invalid");return}
    timer=setTimeout(async()=>{
      try{
        const d=await transferApi.lookup(v); recipientData=d.recipient;
        recipientName.textContent=recipientData.fullName;
        recipientMeta.textContent=(recipientData.kycStatus==="verified"?"✓ Identité vérifiée":"Compte Wallet Connect")+" · "+(recipientData.countryCode||"Pays non renseigné");
        recipientAvatar.textContent=(recipientData.fullName||"?").charAt(0).toUpperCase();
        recipient.classList.add("valid");
      }catch(ex){recipientMeta.textContent=ex.message||"Destinataire introuvable";recipient.classList.add("invalid")}
    },350);
  }
  recipient.addEventListener("input",lookup);

  amount.addEventListener("input",e=>{
    const a=Number(e.target.value||0),fee=calcTransferFee(a),currency=state.meData?.currency||"XAF",balance=Number(state.meData?.balance||0);
    document.getElementById("sendFee").textContent=money(fee,currency);
    document.getElementById("sendTotal").textContent=money(a+fee,currency);
    const funding=document.getElementById("sendFunding");
    if(funding){
      const shortfall=Math.max(0,a+fee-balance),mobileFee=Math.round(shortfall*7/100);
      funding.textContent=shortfall?money(shortfall+mobileFee,currency)+" prélevés sur Mobile Money":"Aucun prélèvement Mobile Money";
    }
  });

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    const a=Number(amount.value||0),r=recipient.value.trim(),currency=state.meData?.currency||"XAF";
    if(!recipientData){toast("Vérifie d'abord le destinataire Wallet Connect","error");return}
    if(!r||!Number.isFinite(a)||a<=0){toast("Destinataire et montant valides requis","error");return}
    const fee=calcTransferFee(a),total=a+fee,balance=Number(state.meData?.balance||0),shortfall=Math.max(0,total-balance),mobileFee=Math.round(shortfall*7/100),mobileCharge=shortfall+mobileFee;
    const message=shortfall
      ? "Confirmer l'envoi de "+money(a,currency)+" à "+recipientData.fullName+" ?\n\nSolde utilisé : "+money(Math.min(balance,total),currency)+"\nÀ prélever sur Mobile Money : "+money(shortfall,currency)+"\nFrais Mobile Money (7%) : "+money(mobileFee,currency)+"\nTotal Mobile Money : "+money(mobileCharge,currency)+"\n\nLe destinataire recevra : "+money(a,currency)
      : "Confirmer l'envoi de "+money(a,currency)+" à "+recipientData.fullName+" ?\n\nFrais d'envoi : "+money(fee,currency)+"\nTotal débité du portefeuille : "+money(total,currency);
    if(!window.confirm(message))return;
    const btn=form.querySelector("button[type=submit]");btn.disabled=true;btn.classList.add("loading");
    try{
      const d=await transferApi.send({recipient:r,amount:a});
      if(d.requires_mobile_money){
        toast("Validation Mobile Money requise. L'envoi sera finalisé après confirmation.");
        await pollFunding(d.funding.topupReference);
      }else{
        toast("Transfert effectué","success");
        await refresh();show("activity");
      }
      form.reset();recipientData=null;recipientName.textContent="Destinataire";recipientMeta.textContent="Saisis un identifiant Wallet Connect";recipientAvatar.textContent="?";
    }catch(ex){
      if(ex.code==="MOBILE_MONEY_PHONE_REQUIRED")toast("Ajoute ton numéro Mobile Money dans Profil avant cet envoi.","error");
      else toast(ex.message,"error");
    }finally{btn.disabled=false;btn.classList.remove("loading")}
  });

  async function pollFunding(reference){
    for(let i=0;i<24;i++){
      await new Promise(resolve=>setTimeout(resolve,3500));
      try{
        const d=await walletApi.status(walletApi.topupStatusPath(reference)),x=d.topup;
        if(x?.status==="successful"){toast("Envoi confirmé","success");await refresh();show("activity");return}
        if(x?.status==="failed"){toast("Le prélèvement Mobile Money a échoué. L'envoi n'a pas été effectué.","error");await refresh();return}
      }catch{}
    }
    toast("Validation toujours en cours. Consulte Activité pour suivre l'opération.");
  }
}
