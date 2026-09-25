import {state} from "../state.js";import {money} from "../services/format.js";import {flag,COUNTRY_NAMES,fillCountries,escapeHtml} from "../services/countries.js";
function providerLabel(p){return p.nameDisplayedToCustomer||p.displayName||p.correspondent||"Moyen de paiement"}
function providerInitials(p){const s=providerLabel(p).replace(/[^A-Za-zÀ-ÿ ]/g,"").trim().split(/\s+/);return (s.length>1?s[0][0]+s[1][0]:s[0]?.slice(0,2)||"P").toUpperCase()}
function fillProviders(id,items,empty){
  const s=document.getElementById(id),grid=document.getElementById(id+"s");if(!s)return;
  s.innerHTML=items.length?'<option value="">Sélectionner un moyen</option>'+items.map(p=>'<option value="'+escapeHtml(p.correspondent)+'">'+providerInitials(p)+" · "+escapeHtml(providerLabel(p))+" · "+escapeHtml(p.currency||state.meData?.currency||"")+'</option>').join(""):'<option value="">'+escapeHtml(empty)+'</option>';
  if(!grid)return;
  grid.innerHTML=items.length?items.map((p,i)=>{const op=(p.operationTypes||[]).find(x=>x.operationType==="DEPOSIT"||x.operationType==="PAYOUT")||{};const limits=op.minTransactionLimit&&op.maxTransactionLimit?` · ${escapeHtml(op.minTransactionLimit)}–${escapeHtml(op.maxTransactionLimit)}`:"";return '<button type="button" class="provider-card '+(i===0?"selected":"")+'" data-provider="'+escapeHtml(p.correspondent)+'"><span class="provider-logo">'+(p.logo?'<img src="'+escapeHtml(p.logo)+'" alt="">':escapeHtml(providerInitials(p)))+'</span><span><strong>'+escapeHtml(providerLabel(p))+'</strong><small>'+escapeHtml(p.currency||state.meData?.currency||"")+' · Opérationnel'+limits+'</small></span></button>'}).join(""):'<div class="provider-empty">'+escapeHtml(empty)+'</div>';
  if(items.length){s.value=items[0].correspondent;grid.querySelectorAll("[data-provider]").forEach(btn=>btn.addEventListener("click",()=>{grid.querySelectorAll(".provider-card").forEach(x=>x.classList.remove("selected"));btn.classList.add("selected");s.value=btn.dataset.provider}))}
}
const LOCAL_PROVIDERS={BJ:{depositProviders:[{correspondent:"MTN_MOMO_BEN",currency:"XOF",displayName:"MTN Mobile Money",status:"OPERATIONAL",operationTypes:[{operationType:"DEPOSIT",status:"OPERATIONAL"}]},{correspondent:"MOOV_BEN",currency:"XOF",displayName:"Moov Money",status:"OPERATIONAL",operationTypes:[{operationType:"DEPOSIT",status:"OPERATIONAL"}]}],payoutProviders:[{correspondent:"MTN_MOMO_BEN",currency:"XOF",displayName:"MTN Mobile Money",status:"OPERATIONAL",operationTypes:[{operationType:"PAYOUT",status:"OPERATIONAL"}]},{correspondent:"MOOV_BEN",currency:"XOF",displayName:"Moov Money",status:"OPERATIONAL",operationTypes:[{operationType:"PAYOUT",status:"OPERATIONAL"}]}]}};
export function render(){
  const b=Number(state.meData?.balance||0),currency=state.meData?.currency||"XAF";
  const country=String(state.meData?.country_code||"").toUpperCase();
  if(country==="BJ"&&(!state.providers?.depositProviders?.length||!state.providers?.payoutProviders?.length)){state.providers={...(state.providers||{}),...LOCAL_PROVIDERS.BJ,country:"BJ",currency:"XOF"}}
  document.getElementById("balance").textContent=state.hidden?"••••••":money(b,currency);
  document.getElementById("walletBalance").textContent=state.hidden?"••••••":money(b,currency);
  document.getElementById("balanceCurrency").textContent=currency+" • Principal";
  document.getElementById("walletCurrency").textContent=currency;
  document.getElementById("walletCurrencyLabel").textContent=currency;
  document.getElementById("withdrawFee").textContent="0 "+currency;
  const feeType=state.meData?.transfer_fee_type||"percentage";
  const feeValue=Number(state.meData?.transfer_fee_value||0);
  document.getElementById("sendFee").dataset.rate=String(feeValue);
  document.getElementById("sendFee").dataset.type=feeType;
  document.getElementById("sendFee").textContent=feeType==="percentage"?feeValue+"%":money(feeValue,currency);
  document.getElementById("sendTotal").textContent=money(0,currency);
  document.getElementById("paymentNotice").textContent=state.providers?.depositProviders?.length||state.providers?.payoutProviders?.length?"Les moyens affichés sont ceux configurés et actuellement opérationnels pour ton pays.":"Aucun moyen de paiement opérationnel n'est actuellement disponible pour ce pays.";
  fillProviders("topupProvider",state.providers?.depositProviders||[],"Aucun moyen de recharge disponible");
  fillProviders("withdrawProvider",state.providers?.payoutProviders||[],"Aucun moyen de retrait disponible");
  const name=state.meData?.full_name||state.meData?.email?.split("@")[0]||"Utilisateur";
  const feeLabel=document.getElementById("homeTransferFee");
  if(feeLabel) feeLabel.textContent=feeType==="percentage"?feeValue+"%":money(feeValue,currency);
  document.querySelector(".greeting h1").textContent="Bonjour "+name.split(" ")[0]+" 👋";
  document.getElementById("profileName").textContent=name;
  document.getElementById("profileEmail").textContent=state.meData?.email||"Compte personnel";
  document.getElementById("profileAvatar").textContent=name.charAt(0).toUpperCase();const headerAvatar=document.getElementById("headerAvatar");if(headerAvatar)headerAvatar.textContent=name.charAt(0).toUpperCase();
  document.getElementById("profileFullName").value=state.meData?.full_name||"";
  document.getElementById("profilePhone").value=state.meData?.phone||"";
  const country=state.meData?.country_code||"";
  fillCountries("profileCountrySelect",country);
  document.getElementById("profileCountry").textContent=country?(flag(country)+" "+((COUNTRY_NAMES&&COUNTRY_NAMES.of(country))||country)):"Pays non renseigné";
  const kyc=document.getElementById("kycStatus");if(kyc)kyc.textContent=state.meData?.kyc_status==="verified"?"Vérifié":"›";
  renderTx("homeTransactions",3);renderTx("activityList",50)
}
function renderTx(id,limit){
  const box=document.getElementById(id);let tx=state.txs||[];
  const f=state.activityFilter;
  if(f==="sent")tx=tx.filter(t=>t.type==="transfer_out");
  else if(f==="received")tx=tx.filter(t=>t.type==="transfer_in");
  else if(f==="topup")tx=tx.filter(t=>t.type==="topup");
  else if(f==="withdrawal")tx=tx.filter(t=>t.type==="withdrawal");
  if(!tx.length){box.innerHTML='<div class="empty">Aucune transaction pour ce filtre</div>';return}
  box.innerHTML=tx.slice(0,limit).map(t=>{const positive=t.direction==="credit";return '<button type="button" class="tx tx-button" data-tx-ref="'+escapeHtml(t.reference||"")+'"><div class="txicon">'+(positive?"＋":"↗")+'</div><div class="txmain"><strong>'+escapeHtml(t.description||t.type)+'</strong><span>'+new Date(t.created_at).toLocaleString("fr-FR")+" • "+escapeHtml(t.status)+'</span></div><div class="txamount '+(positive?"positive":"negative")+'">'+(positive?"+":"−")+money(t.amount,t.currency||state.meData?.currency||"XAF")+'</div></button>'}).join("");
  box.querySelectorAll("[data-tx-ref]").forEach(el=>el.addEventListener("click",()=>openTransaction(el.dataset.txRef)));
}
async function openTransaction(reference){
  if(!reference)return;
  const dialog=document.getElementById("txDetailDialog"),content=document.getElementById("txDetailContent");
  if(!dialog||!content)return;
  content.innerHTML="<p class='muted'>Chargement…</p>";
  if(typeof dialog.showModal==="function")dialog.showModal();else dialog.setAttribute("open","");
  try{
    const {api}=await import("../api/client.js");
    const d=await api("/transactions/"+encodeURIComponent(reference));
    const t=d.transaction||{};
    const positive=t.direction==="credit";
    const currency=t.currency||state.meData?.currency||"XAF";
    content.innerHTML=
      '<div class="tx-detail-row"><span>Référence</span><strong>'+escapeHtml(t.reference||"—")+'</strong></div>'+
      '<div class="tx-detail-row"><span>Type</span><strong>'+escapeHtml(t.description||t.type||"—")+'</strong></div>'+
      '<div class="tx-detail-row"><span>Montant</span><strong class="'+(positive?"positive":"negative")+'">'+(positive?"+":"−")+money(t.amount,currency)+'</strong></div>'+
      '<div class="tx-detail-row"><span>Statut</span><strong>'+escapeHtml(t.status||"—")+'</strong></div>'+
      '<div class="tx-detail-row"><span>Date</span><strong>'+escapeHtml(t.created_at?new Date(t.created_at).toLocaleString("fr-FR"):"—")+'</strong></div>'+
      (t.completed_at?'<div class="tx-detail-row"><span>Terminée le</span><strong>'+escapeHtml(new Date(t.completed_at).toLocaleString("fr-FR"))+'</strong></div>':"");
  }catch(e){content.innerHTML='<p class="muted">'+escapeHtml(e.message||"Impossible de charger le détail.")+'</p>';}
}
document.getElementById("closeTxDetail")?.addEventListener("click",()=>document.getElementById("txDetailDialog")?.close());
