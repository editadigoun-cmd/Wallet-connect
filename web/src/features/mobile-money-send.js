import {api} from "../api/client.js";
import {walletApi} from "../api/wallet.js";
import {money} from "../services/format.js";
import {COUNTRY_CODES,COUNTRY_NAMES,flag,escapeHtml} from "../services/countries.js";
import {state} from "../state.js";

export function initMobileMoneySend({toast,refresh}){
  const form=document.getElementById("sendForm");
  if(!form||document.getElementById("mobileMoneySendPanel"))return;

  const host=document.createElement("div");
  host.id="mobileMoneySendPanel";
  host.innerHTML=`
    <div class="transfer-mode" role="tablist" aria-label="Type d'envoi">
      <button type="button" class="transfer-mode-btn active" data-mode="wallet">Utilisateur Wallet Connect</button>
      <button type="button" class="transfer-mode-btn" data-mode="mobile">Mobile Money</button>
    </div>
    <div class="mobile-send-fields" hidden>
      <div class="field">
        <label for="mobileSendCountry">Pays du bénéficiaire</label>
        <select id="mobileSendCountry"><option value="">Sélectionner le pays</option>${COUNTRY_CODES.map(c=>`<option value="${c}">${flag(c)} ${escapeHtml((COUNTRY_NAMES&&COUNTRY_NAMES.of(c))||c)}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label for="mobileSendProvider">Opérateur Mobile Money</label>
        <select id="mobileSendProvider" disabled><option value="">Choisis d'abord le pays</option></select>
      </div>
      <div class="field">
        <label for="mobileSendPhone">Numéro du bénéficiaire</label>
        <input id="mobileSendPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="Numéro Mobile Money">
      </div>
      <div class="field">
        <label for="mobileSendAmount">Montant à recevoir</label>
        <input id="mobileSendAmount" type="number" min="1" step="1" inputmode="decimal" placeholder="0">
      </div>
      <div class="payment-summary" id="mobileSendSummary">
        <div><span>Montant reçu</span><strong id="mobileSendNet">0</strong></div>
        <div><span>Frais</span><strong id="mobileSendFee">0</strong></div>
        <div><span>Total débité</span><strong id="mobileSendTotal">0</strong></div>
      </div>
      <p class="muted" id="mobileSendNotice">Le bénéficiaire n'a pas besoin d'un compte Wallet Connect.</p>
      <button type="button" id="mobileSendSubmit" class="primary-action">Envoyer vers Mobile Money</button>
    </div>`;
  form.parentNode.insertBefore(host,form);

  const modeButtons=[...host.querySelectorAll("[data-mode]")];
  const mobileFields=host.querySelector(".mobile-send-fields");
  const countryEl=host.querySelector("#mobileSendCountry");
  const providerEl=host.querySelector("#mobileSendProvider");
  const phoneEl=host.querySelector("#mobileSendPhone");
  const amountEl=host.querySelector("#mobileSendAmount");
  const netEl=host.querySelector("#mobileSendNet");
  const feeEl=host.querySelector("#mobileSendFee");
  const totalEl=host.querySelector("#mobileSendTotal");
  const noticeEl=host.querySelector("#mobileSendNotice");
  const submitEl=host.querySelector("#mobileSendSubmit");
  let mode="wallet";
  let providers=[];

  const currencyForCountry=code=>({BJ:"XOF",BF:"XOF",CI:"XOF",SN:"XOF",TG:"XOF",ML:"XOF",GW:"XOF",CM:"XAF",CG:"XAF",GA:"XAF",GQ:"XAF",TD:"XAF",CF:"XAF",GH:"GHS",NG:"NGN",SL:"SLE",CD:"CDF",LS:"LSL",MW:"MWK",MZ:"MZN",ZM:"ZMW",ET:"ETB",KE:"KES",RW:"RWF",TZ:"TZS",UG:"UGX",ZA:"ZAR"}[code]||state.meData?.currency||"XAF");
  const label=p=>p.nameDisplayedToCustomer||p.displayName||p.name||p.correspondent||"Moyen de paiement";

  async function loadProviders(){
    const country=countryEl.value;
    providerEl.innerHTML='<option value="">Chargement…</option>';providerEl.disabled=true;providers=[];
    if(!country){providerEl.innerHTML='<option value="">Choisis d\'abord le pays</option>';return}
    try{
      const d=await api("/providers?country="+encodeURIComponent(country));
      providers=d.payoutProviders||[];
      providerEl.innerHTML=providers.length?'<option value="">Sélectionner un opérateur</option>'+providers.map(p=>`<option value="${escapeHtml(p.correspondent)}">${escapeHtml(label(p))}</option>`).join(""):'<option value="">Aucun opérateur disponible</option>';
      providerEl.disabled=!providers.length;
      const sameCountry=country===String(state.meData?.country_code||"").toUpperCase();
      if(!sameCountry){noticeEl.textContent="L'envoi international vers ce pays nécessite l'activation du service de transfert international sur ton compte."}
      else noticeEl.textContent="Le bénéficiaire n'a pas besoin d'un compte Wallet Connect.";
      updateSummary();
    }catch(ex){providerEl.innerHTML='<option value="">Impossible de charger les opérateurs</option>';noticeEl.textContent=ex.message||"Impossible de charger les moyens de paiement."}
  }

  function updateSummary(){
    const amount=Math.max(0,Number(amountEl.value||0));
    const currency=currencyForCountry(countryEl.value||String(state.meData?.country_code||"").toUpperCase());
    const sameCountry=countryEl.value===String(state.meData?.country_code||"").toUpperCase();
    const balance=Number(state.meData?.balance||0);
    const fee=sameCountry?0:Math.round(amount*0.07);
    const total=amount+fee;
    netEl.textContent=money(amount,currency);
    feeEl.textContent=money(fee,currency);
    totalEl.textContent=money(total,currency);
    submitEl.disabled=!providers.length||!countryEl.value||!providerEl.value||!phoneEl.value.trim()||amount<=0||(!sameCountry&&amount>balance);
    if(sameCountry&&amount>balance&&amount>0){noticeEl.textContent="Solde insuffisant. Recharge ton portefeuille avant l'envoi."}
    else if(!sameCountry&&amount>balance&&amount>0){noticeEl.textContent="Solde insuffisant pour financer ce transfert. Le financement Mobile Money sera ajouté lorsque le corridor international sera activé."}
  }

  modeButtons.forEach(btn=>btn.addEventListener("click",()=>{
    mode=btn.dataset.mode;modeButtons.forEach(x=>x.classList.toggle("active",x===btn));
    const mobile=mode==="mobile";mobileFields.hidden=!mobile;form.hidden=mobile;
    if(mobile){countryEl.value=String(state.meData?.country_code||"").toUpperCase();loadProviders();}
  }));
  countryEl.addEventListener("change",loadProviders);
  providerEl.addEventListener("change",updateSummary);phoneEl.addEventListener("input",updateSummary);amountEl.addEventListener("input",updateSummary);

  submitEl.addEventListener("click",async()=>{
    const country=countryEl.value.toUpperCase(),sameCountry=country===String(state.meData?.country_code||"").toUpperCase();
    const amount=Number(amountEl.value||0),provider=providerEl.value,phone=phoneEl.value.trim();
    if(!sameCountry){toast("Ce corridor international doit d'abord être activé sur le compte PawaPay.","error");return}
    if(!provider||!phone||!Number.isFinite(amount)||amount<=0){toast("Pays, opérateur, numéro et montant sont requis.","error");return}
    if(amount>Number(state.meData?.balance||0)){toast("Solde insuffisant. Recharge ton portefeuille avant l'envoi.","error");return}
    const currency=state.meData?.currency||"XAF";
    if(!window.confirm(`Confirmer l'envoi de ${money(amount,currency)} vers ${phone} ?\n\nOpérateur : ${label(providers.find(p=>p.correspondent===provider)||{})}\nFrais : 0 ${currency}\nLe bénéficiaire recevra : ${money(amount,currency)}`))return;
    submitEl.disabled=true;submitEl.classList.add("loading");
    try{
      const d=await walletApi.withdraw({amount,phone,provider});
      toast("Envoi Mobile Money lancé.","success");
      if(d.withdrawal?.reference)await poll(d.withdrawal.reference);
      else await refresh();
    }catch(ex){toast(ex.message||"L'envoi n'a pas pu être effectué.","error")}
    finally{submitEl.disabled=false;submitEl.classList.remove("loading");updateSummary()}
  });

  async function poll(reference){
    for(let i=0;i<12;i++){
      await new Promise(r=>setTimeout(r,3500));
      try{
        const d=await walletApi.status(walletApi.withdrawStatusPath(reference)),x=d.withdrawal;
        if(x?.status==="successful"){toast("Envoi Mobile Money confirmé","success");await refresh();return}
        if(x?.status==="failed"){toast("L'envoi Mobile Money a été refusé. Ton solde a été restauré.","error");await refresh();return}
      }catch{}
    }
    toast("L'envoi est toujours en cours. Consulte Activité pour suivre son état.");
  }
}
