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
export function render(){
  const b=Number(state.meData?.balance||0),currency=state.meData?.currency||"XAF";
  document.getElementById("balance").textContent=state.hidden?"••••••":money(b,currency);
  document.getElementById("walletBalance").textContent=state.hidden?"••••••":money(b,currency);
  document.getElementById("balanceCurrency").textContent=currency+" • Principal";
  document.getElementById("walletCurrency").textContent=currency;
  document.getElementById("walletCurrencyLabel").textContent=currency;
  document.getElementById("withdrawFee").textContent="0 "+currency;
  document.getElementById("sendFee").textContent=money(0,currency);
  document.getElementById("sendTotal").textContent=money(0,currency);
  document.getElementById("paymentNotice").textContent=state.providers?.depositProviders?.length||state.providers?.payoutProviders?.length?"Les moyens affichés sont ceux configurés et actuellement opérationnels pour ton pays.":"Aucun moyen de paiement opérationnel n'est actuellement disponible pour ce pays.";
  fillProviders("topupProvider",state.providers?.depositProviders||[],"Aucun moyen de recharge disponible");
  fillProviders("withdrawProvider",state.providers?.payoutProviders||[],"Aucun moyen de retrait disponible");
  const name=state.meData?.full_name||state.meData?.email?.split("@")[0]||"Utilisateur";
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
  box.innerHTML=tx.slice(0,limit).map(t=>{const positive=t.direction==="credit";return '<div class="tx"><div class="txicon">'+(positive?"＋":"↗")+'</div><div class="txmain"><strong>'+escapeHtml(t.description||t.type)+'</strong><span>'+new Date(t.created_at).toLocaleString("fr-FR")+" • "+escapeHtml(t.status)+'</span></div><div class="txamount '+(positive?"positive":"negative")+'">'+(positive?"+":"−")+money(t.amount,t.currency||state.meData?.currency||"XAF")+'</div></div>'}).join("")
}