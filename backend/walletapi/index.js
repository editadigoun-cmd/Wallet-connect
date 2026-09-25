import { Pool } from "pg";

const PORTAL_ORIGIN = "https://editadigoun-cmd.github.io";
const AUTH_BASE = "https://ep-shiny-haze-b4e7a5b4.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";
const PAWAPAY_BASE = "https://api.pawapay.io/v2";
const DEFAULT_PROVIDER = "MTN_MOMO_COG";
const DEFAULT_COUNTRY = "CG";
const DEFAULT_CURRENCY = "XAF";
const COUNTRY_CURRENCY = { BJ:"XOF",BF:"XOF",CI:"XOF",SN:"XOF",TG:"XOF",ML:"XOF",GW:"XOF",CM:"XAF",CG:"XAF",GA:"XAF",GQ:"XAF",TD:"XAF",CF:"XAF",GH:"GHS",NG:"NGN",SL:"SLE",CD:"CDF",LS:"LSL",MW:"MWK",MZ:"MZN",ZM:"ZMW",ET:"ETB",KE:"KES",RW:"RWF",TZ:"TZS",UG:"UGX",ZA:"ZAR",LR:"LRD",SS:"SSP",GN:"GNF",GM:"GMD",MR:"MRU",CV:"CVE",AO:"AOA",ZW:"USD",NA:"NAD",BW:"BWP",BI:"BIF",EG:"EGP",SA:"SAR",QA:"QAR",TR:"TRY",MA:"MAD",DZ:"DZD",TN:"TND",IN:"INR",CN:"CNY",AE:"AED",BR:"BRL",CH:"CHF",LU:"EUR",FR:"EUR",BE:"EUR",CA:"CAD",US:"USD",GB:"GBP",DE:"EUR",IT:"EUR",ES:"EUR",PT:"EUR",JP:"JPY",KR:"KRW",AU:"AUD",NZ:"NZD" };
const COUNTRY_DIAL = { BJ:"229", BF:"226", CM:"237", GH:"233", CI:"225", NG:"234", SN:"221", SL:"232", TG:"228", CG:"242", CD:"243", GA:"241", LS:"266", MW:"265", MZ:"258", ZM:"260", ET:"251", KE:"254", RW:"250", TZ:"255", UG:"256", ML:"223", GN:"224", GW:"245", LR:"231", SS:"211", ZA:"27", FR:"33", BE:"32", CA:"1", US:"1", GB:"44", DE:"49", IT:"39", ES:"34", PT:"351" };
const COUNTRY_ISO3 = { BJ:"BEN", CG:"COG", CD:"COD", CI:"CIV", CM:"CMR", SN:"SEN", TG:"TGO", GH:"GHA", NG:"NGA", ZA:"ZAF", FR:"FRA", BE:"BEL", CA:"CAN", US:"USA", GB:"GBR", DE:"DEU", IT:"ITA", ES:"ESP", PT:"PRT" };
const ISO3_TO_ISO2 = Object.fromEntries(Object.entries(COUNTRY_ISO3).map(([k,v])=>[v,k]));
let configCache={at:0,data:null};
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

function operationType(provider,kind){const ops=Array.isArray(provider?.operationTypes)?provider.operationTypes:[];return ops.find(x=>x&&x.operationType===kind)||null;}
function providerBrand(provider=""){ 
  const p=String(provider||"").toUpperCase();
  if(p.includes("MTN")) return {name:"MTN Mobile Money",logo:""};
  if(p.includes("MOOV")) return {name:"Moov Money",logo:""};
  if(p.includes("AIRTEL")) return {name:"Airtel Money",logo:""};
  if(p.includes("ORANGE")) return {name:"Orange Money",logo:""};
  if(p.includes("WAVE")) return {name:"Wave",logo:""};
  return {name:provider||"Moyen de paiement",logo:""};
}
function cors(headers = {}) {
  return {
    "Access-Control-Allow-Origin": PORTAL_ORIGIN,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Vary": "Origin",
    ...headers
  };
}
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: cors({ "Content-Type": "application/json", ...headers }) });
}
function bad(message, status = 400, code = "BAD_REQUEST") {
  return json({ ok: false, error: message, code }, status);
}
async function body(request) {
  try { return await request.json(); } catch { return {}; }
}
function amountInt(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}
function normalizePhone(v, country="") {
  let n = String(v || "").replace(/\D/g, "");
  const c = String(country || "").toUpperCase();
  if (c === "BJ") {
    if (n.startsWith("229")) n = n.slice(3);
    if (n.length === 9) n = "01" + n.slice(1);
    if (n.length === 10 && !n.startsWith("0")) n = "0" + n;
    return "229" + n;
  }
  const cc = COUNTRY_DIAL[c];
  if (cc && n.startsWith("0")) n = cc + n.slice(1);
  else if (cc && !n.startsWith(cc)) n = cc + n;
  return n;
}
function idempotency(request, fallback) {
  return request.headers.get("Idempotency-Key") || fallback;
}
function decodeAuthCookie(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\s*)wallet_auth=([^;]+)/);
  if (!m) return "";
  try { return Buffer.from(decodeURIComponent(m[1]), "base64url").toString("utf8"); } catch { return ""; }
}
function cookieHeader(request) { return decodeAuthCookie(request); }
async function authProxy(request, path) {
  const url = AUTH_BASE + path, headers = new Headers(), ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("origin", PORTAL_ORIGIN);
  const cookie = cookieHeader(request); if (cookie) headers.set("cookie", cookie);
  const init = { method: request.method, headers, redirect: "manual" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  let upstream;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    console.error("AUTH_UPSTREAM_FETCH_ERROR", e);
    return json({ok:false,error:"Service d'authentification temporairement indisponible.",code:"AUTH_UPSTREAM_UNAVAILABLE"},502);
  }
  const out = new Headers(cors({ "Content-Type": upstream.headers.get("content-type") || "application/json" }));
  if (upstream.status >= 300 && upstream.status < 400) return json({ok:false,error:"Le service d'authentification a renvoyé une redirection inattendue.",code:"AUTH_REDIRECT"},502);
  const setCookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : (upstream.headers.get("set-cookie") ? [upstream.headers.get("set-cookie")] : []);
  const pairs = setCookies.flatMap(c => String(c).split(/,(?=[^;]+?=)/)).map(c => c.split(";")[0]).filter(Boolean);
  if (pairs.length) out.append("Set-Cookie", "wallet_auth=" + encodeURIComponent(Buffer.from(pairs.join("; ")).toString("base64url")) + "; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800");
  if (path === "/sign-out") out.append("Set-Cookie", "wallet_auth=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
  out.set("Cache-Control","no-store");
  return new Response(await upstream.text(), { status: upstream.status, headers: out });
}
async function getSession(request) {
  const cookie = cookieHeader(request); if (!cookie) return null;
  const r = await fetch(AUTH_BASE + "/get-session", { headers: { cookie, origin: PORTAL_ORIGIN } });
  if (!r.ok) return null;
  try { return await r.json(); } catch { return null; }
}
async function requireUser(request) {
  const session = await getSession(request), authUser = session?.user;
  if (!authUser?.id || !authUser?.email) throw Object.assign(new Error("Authentification requise"), { status: 401 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO public.users (auth_user_id,email,full_name,status,kyc_status,country_code)
       VALUES ($1,$2,$3,'active','not_started',NULL)
       ON CONFLICT (auth_user_id) DO UPDATE SET email=EXCLUDED.email, full_name=COALESCE(EXCLUDED.full_name,public.users.full_name), updated_at=now()
       RETURNING id,email,full_name,phone,country_code,status,kyc_status,wallet_code`,
      [authUser.id, authUser.email, authUser.name || null]
    );
    const user = result.rows[0];
    const currency = COUNTRY_CURRENCY[user.country_code] || DEFAULT_CURRENCY;
    await client.query(
      `INSERT INTO public.wallets (user_id,currency,balance,status)
       VALUES ($1,$2,0,'active')
       ON CONFLICT (user_id) DO UPDATE
       SET currency = CASE WHEN public.wallets.balance = 0 THEN EXCLUDED.currency ELSE public.wallets.currency END,
           updated_at = CASE WHEN public.wallets.balance = 0 THEN now() ELSE public.wallets.updated_at END`,
      [user.id, currency]
    );
    await client.query("COMMIT"); return user;
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
}
async function pawapay(path, method, payload) {
  const token = process.env.PAWAPAY_API_TOKEN; if (!token) throw new Error("PawaPay non configuré");
  const r = await fetch(PAWAPAY_BASE + path, { method, headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"}, body:payload===undefined?undefined:JSON.stringify(payload), signal:AbortSignal.timeout(30000) });
  const text = await r.text(); let data; try { data=JSON.parse(text); } catch { data={raw:text}; }
  return { ok:r.ok, status:r.status, data };
}
async function availableProviders(country,kind){
  const iso3=COUNTRY_ISO3[country]||country;
  const active=await pawapay("/active-conf","GET");
  if(!active.ok){ console.error("PAWAPAY_ACTIVE_CONF_ERROR",active.status,active.data); return []; }

  const countries=Array.isArray(active.data?.countries)?active.data.countries:
    (Array.isArray(active.data)?active.data:
      (active.data?.country&&Array.isArray(active.data?.providers)?[active.data]:[]));
  const aliases=new Set([String(country).toUpperCase(),String(iso3).toUpperCase()]);
  const cc=countries.find(x=>aliases.has(String(x.country||x.countryCode||x.iso3||"").toUpperCase()));
  const providers=Array.isArray(cc?.providers)?cc.providers:
    (Array.isArray(cc?.correspondents)?cc.correspondents:[]);
  const configured=providers.map(x=>{
    const correspondent=x.provider||x.correspondent||x.code;
    const ops=(Array.isArray(x.operationTypes)?x.operationTypes:[]).map(o=>typeof o==="string"?{operationType:o}:o).filter(Boolean);
    const op=ops.find(o=>String(o.operationType||o.type||"").toUpperCase()===String(kind).toUpperCase());
    if(!correspondent||!op)return null;
    const brand=providerBrand(correspondent);
    return {...x,correspondent,provider:correspondent,currency:x.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY,
      displayName:x.displayName||x.name||brand.name,logo:x.logo||x.logoUrl||brand.logo,operationTypes:ops,activeOperation:op};
  }).filter(Boolean);
  if(!configured.length)return [];

  // IMPORTANT: availability is queried exactly as documented, with country + operation.
  // If this health endpoint fails or has an unexpected envelope, keep configured methods.
  const live=await pawapay("/availability?country="+encodeURIComponent(iso3)+"&operationType="+encodeURIComponent(kind),"GET");
  if(!live.ok){
    console.error("PAWAPAY_AVAILABILITY_ERROR",live.status,live.data);
    return configured.map(x=>({...x,status:"CONFIGURED"}));
  }
  const liveProviders=Array.isArray(live.data)?live.data:
    (Array.isArray(live.data?.providers)?live.data.providers:
      (Array.isArray(live.data?.countries)?(live.data.countries.find(x=>aliases.has(String(x.country||"").toUpperCase()))?.providers||[]):[]));
  if(!liveProviders.length)return configured.map(x=>({...x,status:"CONFIGURED"}));
  return configured.map(cfg=>{
    const liveProvider=liveProviders.find(x=>(x.provider||x.correspondent||x.code)===cfg.correspondent);
    const liveOps=(Array.isArray(liveProvider?.operationTypes)?liveProvider.operationTypes:[]).map(o=>typeof o==="string"?{operationType:o}:o);
    const liveOp=liveOps.find(o=>String(o.operationType||o.type||"").toUpperCase()===String(kind).toUpperCase());
    const status=String(liveOp?.status||"CONFIGURED").toUpperCase();
    return {...cfg,status,operationTypes:liveOps.length?liveOps:cfg.operationTypes};
  }).filter(x=>x.status==="OPERATIONAL"||x.status==="CONFIGURED");
}
async function activePaymentMethod(country){
  const providers=await availableProviders(country,"DEPOSIT");
  const p=providers[0];
  return p?{country_code:country,provider:p.correspondent,method_code:p.correspondent,currency:p.currency}:null;
}
async function feeConfig(operation,country,currency){
  const q=await pool.query(
    `SELECT fee_type,fee_value FROM public.fee_settings
     WHERE operation=$1 AND active=true AND currency=$2
       AND (country_code=$3 OR country_code IS NULL)
     ORDER BY CASE WHEN country_code=$3 THEN 0 ELSE 1 END LIMIT 1`,
    [operation,currency,country]
  );
  if(q.rows[0])return q.rows[0];
  if(operation==="topup")return {fee_type:"percentage",fee_value:7};
  return null;
}
function calculateFee(amount,config){
  if(!config)return 0;
  const value=Number(config.fee_value||0);
  if(config.fee_type==="percentage")return Math.round(amount*value/100);
  return Math.max(0,Math.round(value));
}
async function createTopup(request,user) {
  const b=await body(request), amount=amountInt(b.amount), country=String(user.country_code||DEFAULT_COUNTRY).toUpperCase(), phone=normalizePhone(b.phone,country), requestedProvider=String(b.provider||"").trim();
  if(!amount||!phone)return bad("Montant et numéro MTN requis");
  const key=idempotency(request,"topup-"+crypto.randomUUID()), providers=await availableProviders(country,"DEPOSIT"), requested=providers.find(x=>x.correspondent===requestedProvider), selected=requested||providers[0];
  if(!selected)return bad("Aucun moyen de recharge disponible pour ce pays");
  const provider=selected.correspondent, currency=selected.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY;
  const fee=await feeConfig("topup",country,currency);
  const feeAmount=calculateFee(amount,fee);
  const totalCharge=amount+feeAmount;
  const depositConfig=operationType(selected,"DEPOSIT")||{};
  const minDeposit=Number(depositConfig.minTransactionLimit||0),maxDeposit=Number(depositConfig.maxTransactionLimit||0);
  if(minDeposit&&amount<minDeposit)return bad("Le montant minimum pour ce moyen est "+minDeposit+" "+currency);
  if(maxDeposit&&amount>maxDeposit)return bad("Le montant maximum pour ce moyen est "+maxDeposit+" "+currency);
  const client=await pool.connect(); let row;
  try {
    await client.query("BEGIN");
    const existing=await client.query("SELECT * FROM public.topups WHERE idempotency_key=$1 LIMIT 1",[key]);
    if(existing.rows[0]){await client.query("COMMIT");return json({ok:true,topup:existing.rows[0]});}
    const wallet=await client.query("SELECT id FROM public.wallets WHERE user_id=$1 AND status='active' FOR UPDATE",[user.id]);
    if(!wallet.rows[0])throw new Error("Portefeuille introuvable");
    const ref="TOP-"+crypto.randomUUID(), providerReference=crypto.randomUUID();
    const ins=await client.query(`INSERT INTO public.topups(reference,wallet_id,amount,fee_amount,currency,provider,status,payment_method,metadata,idempotency_key,provider_reference)
      VALUES ($1,$2,$3,$4,$5,$6,'pending','MTN_MOBILE_MONEY',$7,$8,$9) RETURNING *`,
      [ref,wallet.rows[0].id,amount,feeAmount,currency,provider,JSON.stringify({phone,provider,country,provider_name:selected.displayName||provider,fee_type:fee?.fee_type||null,fee_rate:fee?.fee_value||0,total_charge:totalCharge}),key,providerReference]);
    row=ins.rows[0]; await client.query("UPDATE public.topups SET payment_method=$1 WHERE id=$2",[selected.displayName||provider,row.id]); await client.query("COMMIT");
  } catch(e){await client.query("ROLLBACK");client.release();throw e} client.release();
  const p=await pawapay("/deposits","POST",{
    depositId:row.provider_reference,
    amount:String(totalCharge),
    currency,
    payer:{type:"MMO",accountDetails:{provider,phoneNumber:phone}},
    customerMessage:"Recharge Wallet",
    clientReferenceId:row.reference,
    metadata:[{walletConnectReference:row.reference}]
  });
  const providerStatus=String(p.data?.data?.status||p.data?.status||"").toUpperCase();
  const rejected=!p.ok || ["REJECTED","FAILED","CANCELLED"].includes(providerStatus);
  const status=rejected?"failed":"pending";
  await pool.query("UPDATE public.topups SET status=$1,metadata=metadata || $2::jsonb WHERE id=$3",[status,JSON.stringify({pawapay_response:p.data}),row.id]);
  if(rejected){const reason=p.data?.data?.rejectionReason||p.data?.rejectionReason||p.data?.data?.failureReason||p.data?.failureReason||{};return json({ok:false,error:reason.rejectionMessage||reason.failureMessage||"La recharge n'a pas été acceptée par le moyen de paiement sélectionné.",code:"TOPUP_REJECTED",details:reason},502);}
  return json({ok:true,topup:{...row,status},fee:{amount:feeAmount,type:fee?.fee_type||"percentage",rate:Number(fee?.fee_value||0),totalCharge},provider_response:p.data},202);
}
async function topupStatus(request,user,reference) {
  const q=await pool.query(`SELECT t.* FROM public.topups t JOIN public.wallets w ON w.id=t.wallet_id WHERE t.reference=$1 AND w.user_id=$2`,[reference,user.id]);
  if(!q.rows[0])return bad("Recharge introuvable",404,"NOT_FOUND");
  const row=q.rows[0]; if(["successful","failed","cancelled"].includes(row.status))return json({ok:true,topup:row});
  const p=await pawapay("/deposits/"+encodeURIComponent(row.provider_reference||row.reference),"GET");
  if(!p.ok)return json({ok:true,topup:row,provider:p.data});
  const providerStatus=String(p.data?.data?.status||p.data?.status||"").toUpperCase();
  if(["COMPLETED","SUCCESSFUL"].includes(providerStatus)){
    const c=await pool.connect();
    try{
      await c.query("BEGIN");
      const locked=await c.query("SELECT * FROM public.topups WHERE id=$1 FOR UPDATE",[row.id]);
      if(locked.rows[0]?.status==="pending"){
        const w=await c.query("SELECT * FROM public.wallets WHERE id=$1 FOR UPDATE",[row.wallet_id]);
        const before=Number(w.rows[0].balance),after=before+Number(row.amount);
        await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[after,row.wallet_id]);
        const pending=locked.rows[0]?.metadata?.pending_transfer;
        let completedTransfer=null;
        if(pending?.recipientWalletId){
          const recipient=await c.query("SELECT * FROM public.wallets WHERE id=$1 FOR UPDATE",[pending.recipientWalletId]);
          if(!recipient.rows[0])throw new Error("Portefeuille du destinataire introuvable");
          const transferExisting=await c.query("SELECT * FROM public.transfers WHERE idempotency_key=$1 LIMIT 1",[pending.transferKey]);
          if(!transferExisting.rows[0]){
            const total=Number(pending.totalRequired),senderAfter=after-total;
            if(senderAfter<0)throw new Error("Solde insuffisant après financement du transfert");
            const ref="TRF-"+crypto.randomUUID();
            const ins=await c.query(`INSERT INTO public.transfers(reference,sender_wallet_id,receiver_wallet_id,amount,fee_amount,currency,status,note,idempotency_key)
              VALUES($1,$2,$3,$4,$5,$6,'successful',$7,$8) RETURNING *`,
              [ref,row.wallet_id,pending.recipientWalletId,Number(pending.amount),Number(pending.transferFee||0),row.currency,pending.note||null,pending.transferKey]);
            await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[senderAfter,row.wallet_id]);
            const rbefore=Number(recipient.rows[0].balance),rafter=rbefore+Number(pending.amount);
            await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[rafter,pending.recipientWalletId]);
            await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
              VALUES($1,$2,'transfer_out','debit',$3,$4,$5,$6,'successful','Transfert envoyé',$7,now())`,
              ["TX-"+crypto.randomUUID(),row.wallet_id,total,row.currency,after,senderAfter,JSON.stringify({transfer_id:ins.rows[0].id,mobile_money_funding:true,fee:Number(pending.transferFee||0),mobile_money_fee:Number(pending.mobileMoneyFee||row.fee_amount||0)})]);
            await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
              VALUES($1,$2,'transfer_in','credit',$3,$4,$5,$6,'successful','Transfert reçu',$7,now())`,
              ["TX-"+crypto.randomUUID(),pending.recipientWalletId,Number(pending.amount),row.currency,rbefore,rafter,JSON.stringify({transfer_id:ins.rows[0].id})]);
            completedTransfer=ins.rows[0];
          }
        }
        await c.query("UPDATE public.topups SET status='successful',completed_at=now(),metadata=metadata || $1::jsonb WHERE id=$2",
          [JSON.stringify({pawapay_status:providerStatus,transfer_completed:Boolean(completedTransfer)}),row.id]);
        if(!pending?.recipientWalletId){
          await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
            VALUES ($1,$2,'topup','credit',$3,$4,$5,$6,'successful',$7,$8,now())`,
            ["TX-"+crypto.randomUUID(),row.wallet_id,row.amount,row.currency,row.metadata?.provider_name||row.provider,JSON.stringify({topup_id:row.id,provider_reference:row.provider_reference,provider:row.provider})]);
        } else {
          await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
            VALUES ($1,$2,'topup','credit',$3,$4,$5,$6,'successful',$7,$8,now())`,
            ["TX-"+crypto.randomUUID(),row.wallet_id,row.amount,row.currency,"Financement de l'envoi",JSON.stringify({topup_id:row.id,provider_reference:row.provider_reference,provider:row.provider,mobile_money_fee:row.fee_amount})]);
        }
      }
      await c.query("COMMIT");
    }catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
    return json({ok:true,topup:{...row,status:"successful"}});
  }
  if(["FAILED","REJECTED","CANCELLED"].includes(providerStatus)){
    await pool.query("UPDATE public.topups SET status='failed',metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay_status:providerStatus,pawapay:p.data}),row.id]);
    return json({ok:true,topup:{...row,status:"failed"}});
  }
  return json({ok:true,topup:row,provider:p.data});
}
async function transfer(request,user) {
  const b=await body(request),amount=amountInt(b.amount),recipient=String(b.recipient||"").trim();
  if(!amount||!recipient)return bad("Destinataire et montant requis");
  const key=idempotency(request,"transfer-"+crypto.randomUUID()),c=await pool.connect();
  try{
    await c.query("BEGIN");
    const ex=await c.query("SELECT * FROM public.transfers WHERE idempotency_key=$1",[key]);
    if(ex.rows[0]){await c.query("COMMIT");return json({ok:true,transfer:ex.rows[0]});}
    const s=await c.query(
      "SELECT u.id,u.country_code,u.phone,u.wallet_code,w.id wallet_id,w.balance,w.currency FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE u.id=$1 FOR UPDATE",
      [user.id]
    );
    const r=await c.query(
      "SELECT u.id,u.email,u.full_name,u.wallet_code,u.country_code,w.id wallet_id,w.currency FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE upper(u.wallet_code)=upper($1) AND u.status='active' LIMIT 1",
      [recipient]
    );
    if(!s.rows[0]||!r.rows[0])throw Object.assign(new Error("Destinataire introuvable"),{status:404});
    if(r.rows[0].id===user.id)throw new Error("Impossible de transférer vers soi-même");
    if((s.rows[0].currency||DEFAULT_CURRENCY)!==(r.rows[0].currency||DEFAULT_CURRENCY))
      return bad("Les transferts entre devises différentes ne sont pas encore disponibles",409,"CURRENCY_MISMATCH");
    const currency=s.rows[0].currency||DEFAULT_CURRENCY;
    const feeConfigResult=await c.query(
      `SELECT fee_type,fee_value FROM public.fee_settings
       WHERE operation='transfer' AND active=true AND currency=$1
         AND (country_code=$2 OR country_code IS NULL)
       ORDER BY CASE WHEN country_code=$2 THEN 0 ELSE 1 END LIMIT 1`,
      [currency,s.rows[0].country_code||null]
    );
    const fc=feeConfigResult.rows[0]||{fee_type:"percentage",fee_value:0};
    const fee=fc.fee_type==="fixed"?Math.round(Number(fc.fee_value)||0):Math.round(amount*(Number(fc.fee_value)||0)/100);
    const total=amount+fee,before=Number(s.rows[0].balance);
    if(before<total){
      const country=String(s.rows[0].country_code||DEFAULT_COUNTRY).toUpperCase();
      const phone=normalizePhone(b.mobileMoneyPhone||s.rows[0].phone,country);
      if(!phone)return bad("Ton solde est insuffisant. Ajoute d'abord ton numéro Mobile Money dans ton profil.",409,"MOBILE_MONEY_PHONE_REQUIRED");
      const providers=await availableProviders(country,"DEPOSIT");
      if(!providers.length)return bad("Aucun moyen de recharge Mobile Money n'est disponible pour compléter cet envoi.",409,"MOBILE_MONEY_UNAVAILABLE");
      const selected=providers.find(x=>x.correspondent===String(b.mobileMoneyProvider||""))||providers[0];
      const topupFeeConfig=await feeConfig("topup",country,currency);
      const shortfall=total-before;
      const mobileFee=calculateFee(shortfall,topupFeeConfig);
      const totalCharge=shortfall+mobileFee;
      const provider=selected.correspondent;
      const providerReference=crypto.randomUUID(),topupReference="TOP-"+crypto.randomUUID();
      const pendingTransfer={
        transferKey:key,
        recipientWalletId:r.rows[0].wallet_id,
        recipientName:r.rows[0].full_name,
        amount,
        transferFee:fee,
        totalRequired:total,
        shortfall,
        mobileMoneyFee:mobileFee,
        note:b.note||null
      };
      const top=await c.query(
        `INSERT INTO public.topups(reference,wallet_id,amount,fee_amount,currency,provider,status,payment_method,metadata,idempotency_key,provider_reference)
         VALUES($1,$2,$3,$4,$5,$6,'pending',$7,$8,$9,$10) RETURNING *`,
        [topupReference,s.rows[0].wallet_id,shortfall,mobileFee,currency,provider,selected.displayName||provider,
         JSON.stringify({phone,provider,country,provider_name:selected.displayName||provider,fee_type:topupFeeConfig?.fee_type||"percentage",fee_rate:Number(topupFeeConfig?.fee_value||7),total_charge:totalCharge,pending_transfer:pendingTransfer}),
         key+"-funding",providerReference]
      );
      await c.query("COMMIT");
      const p=await pawapay("/deposits","POST",{
        depositId:providerReference,
        amount:String(totalCharge),
        currency,
        payer:{type:"MMO",accountDetails:{provider,phoneNumber:phone}},
        customerMessage:"Financement d'un transfert Wallet Connect",
        clientReferenceId:topupReference,
        metadata:[{walletConnectReference:topupReference,transferFunding:true}]
      });
      const providerStatus=String(p.data?.data?.status||p.data?.status||"").toUpperCase();
      const rejected=!p.ok||["REJECTED","FAILED","CANCELLED"].includes(providerStatus);
      await pool.query("UPDATE public.topups SET status=$1,metadata=metadata || $2::jsonb WHERE id=$3",
        [rejected?"failed":"pending",JSON.stringify({pawapay_response:p.data}),top.rows[0].id]);
      if(rejected)return json({ok:false,error:"Le prélèvement Mobile Money nécessaire à l'envoi a été refusé.",code:"TRANSFER_FUNDING_REJECTED",details:p.data},502);
      return json({
        ok:true,requires_mobile_money:true,
        transfer:{amount,fee_amount:fee,total_debited:total,recipient:{walletCode:r.rows[0].wallet_code,name:r.rows[0].full_name}},
        funding:{amount:shortfall,fee:mobileFee,totalCharge,topupReference}
      },202);
    }
    const ref="TRF-"+crypto.randomUUID();
    const ins=await c.query(`INSERT INTO public.transfers(reference,sender_wallet_id,receiver_wallet_id,amount,fee_amount,currency,status,note,idempotency_key)
      VALUES($1,$2,$3,$4,$5,$6,'successful',$7,$8) RETURNING *`,
      [ref,s.rows[0].wallet_id,r.rows[0].wallet_id,amount,fee,currency,b.note||null,key]);
    const after=before-total;
    await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[after,s.rows[0].wallet_id]);
    const rw=await c.query("SELECT balance FROM public.wallets WHERE id=$1 FOR UPDATE",[r.rows[0].wallet_id]);
    const rbefore=Number(rw.rows[0].balance),rafter=rbefore+amount;
    await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[rafter,r.rows[0].wallet_id]);
    await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
      VALUES($1,$2,'transfer_out','debit',$3,$4,$5,$6,'successful','Transfert envoyé',$7,now())`,
      ["TX-"+crypto.randomUUID(),s.rows[0].wallet_id,total,currency,before,after,JSON.stringify({transfer_id:ins.rows[0].id,fee})]);
    await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
      VALUES($1,$2,'transfer_in','credit',$3,$4,$5,$6,'successful','Transfert reçu',$7,now())`,
      ["TX-"+crypto.randomUUID(),r.rows[0].wallet_id,amount,currency,rbefore,rafter,JSON.stringify({transfer_id:ins.rows[0].id})]);
    await c.query("COMMIT");
    return json({ok:true,transfer:{...ins.rows[0],recipient:{walletCode:r.rows[0].wallet_code,name:r.rows[0].full_name},fee_amount:fee,total_debited:total}},201);
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
}
async function withdraw(request,user) {
  const b=await body(request),amount=amountInt(b.amount),country=String(user.country_code||DEFAULT_COUNTRY).toUpperCase(),phone=normalizePhone(b.phone,country),requestedProvider=String(b.provider||"").trim();
  if(!amount||!phone)return bad("Montant et numéro MTN requis");
  const providers=await availableProviders(country,"PAYOUT");
  if(!providers.length)return bad("Aucun moyen de retrait opérationnel dans ton pays");
  const provider=requestedProvider||providers[0].correspondent;

  const selected=providers.find(x=>x.correspondent===provider);
  if(!selected)return bad("Ce moyen de paiement n'est pas disponible pour les retraits dans ton pays");
  const currency=selected.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY;
  const payoutConfig=operationType(selected,"PAYOUT")||{};
  const minPayout=Number(payoutConfig.minTransactionLimit||0),maxPayout=Number(payoutConfig.maxTransactionLimit||0);
  if(minPayout&&amount<minPayout)return bad("Le montant minimum pour ce moyen est "+minPayout+" "+currency);
  if(maxPayout&&amount>maxPayout)return bad("Le montant maximum pour ce moyen est "+maxPayout+" "+currency);
  const key=idempotency(request,"withdraw-"+crypto.randomUUID()),c=await pool.connect(); let row;
  try{
    await c.query("BEGIN"); const ex=await c.query("SELECT w.* FROM public.withdrawals w JOIN public.wallets wa ON wa.id=w.wallet_id WHERE w.idempotency_key=$1",[key]);
    if(ex.rows[0]){await c.query("COMMIT");return json({ok:true,withdrawal:ex.rows[0]});}
    const w=await c.query("SELECT * FROM public.wallets WHERE user_id=$1 AND status='active' FOR UPDATE",[user.id]); if(!w.rows[0])throw new Error("Portefeuille introuvable");
    const before=Number(w.rows[0].balance); if(before<amount)throw Object.assign(new Error("Solde insuffisant"),{status:409});
    const ref="WDR-"+crypto.randomUUID(),providerReference=crypto.randomUUID();
    const ins=await c.query(`INSERT INTO public.withdrawals(reference,wallet_id,amount,fee_amount,currency,provider,status,destination_type,destination_account,metadata,idempotency_key,provider_reference)
      VALUES($1,$2,$3,0,$4,$5,'processing','mobile_money',$6,$7,$8,$9) RETURNING *`,[ref,w.rows[0].id,amount,currency,provider,phone,JSON.stringify({provider,country}),key,providerReference]);
    await c.query("UPDATE public.wallets SET balance=balance-$1,updated_at=now() WHERE id=$2",[amount,w.rows[0].id]); const after=before-amount;
    await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata)
      VALUES($1,$2,'withdrawal','debit',$3,$4,$5,$6,'pending',$7,$8)`,["TX-"+crypto.randomUUID(),w.rows[0].id,amount,currency,before,after,selected.displayName||provider,JSON.stringify({withdrawal_id:ins.rows[0].id,provider})]);
    await c.query("COMMIT"); row=ins.rows[0];
  }catch(e){await c.query("ROLLBACK");c.release();throw e} c.release();
  const p=await pawapay("/payouts","POST",{
    payoutId:row.provider_reference,
    amount:String(amount),
    currency:row.currency,
    recipient:{type:"MMO",accountDetails:{provider:row.provider,phoneNumber:row.destination_account}},
    customerMessage:"Retrait Wallet",
    clientReferenceId:row.reference,
    metadata:[{walletConnectReference:row.reference}]
  });
  if(!p.ok){const c2=await pool.connect();try{await c2.query("BEGIN");await c2.query("UPDATE public.wallets SET balance=balance+$1,updated_at=now() WHERE id=$2",[amount,row.wallet_id]);await c2.query("UPDATE public.withdrawals SET status='failed',failure_reason=$1,metadata=metadata || $2::jsonb WHERE id=$3",["PawaPay rejection",JSON.stringify({pawapay:p.data}),row.id]);await c2.query("UPDATE public.transactions SET status='failed',metadata=metadata || $1::jsonb WHERE metadata->>'withdrawal_id'=$2",[JSON.stringify({pawapay:p.data}),String(row.id)]);await c2.query("COMMIT")}catch(e){await c2.query("ROLLBACK")}finally{c2.release();}return json({ok:false,error:"PawaPay a refusé le retrait",details:p.data},502);}
  await pool.query("UPDATE public.withdrawals SET status='processing',metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay:p.data}),row.id]);
  return json({ok:true,withdrawal:{...row,status:"processing",provider_reference:row.provider_reference},provider_response:p.data},202);
}
async function withdrawalStatus(request,user,reference) {
  const q=await pool.query(`SELECT w.* FROM public.withdrawals w JOIN public.wallets wa ON wa.id=w.wallet_id WHERE w.reference=$1 AND wa.user_id=$2`,[reference,user.id]);
  if(!q.rows[0])return bad("Retrait introuvable",404,"NOT_FOUND"); const row=q.rows[0];
  if(["successful","failed","cancelled"].includes(row.status))return json({ok:true,withdrawal:row});
  const p=await pawapay("/payouts/"+encodeURIComponent(row.provider_reference||row.reference),"GET"); if(!p.ok)return json({ok:true,withdrawal:row,provider:p.data});
  const st=String(p.data?.data?.status||p.data?.status||"").toUpperCase();
  if(["COMPLETED","SUCCESSFUL"].includes(st)){await pool.query("UPDATE public.withdrawals SET status='successful',completed_at=now(),metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay_status:st}),row.id]);await pool.query("UPDATE public.transactions SET status='successful',completed_at=now() WHERE metadata->>'withdrawal_id'=$1",[String(row.id)]);return json({ok:true,withdrawal:{...row,status:"successful"}});}
  if(["FAILED","REJECTED","CANCELLED"].includes(st)){const c=await pool.connect();try{await c.query("BEGIN");const locked=await c.query("SELECT * FROM public.withdrawals WHERE id=$1 FOR UPDATE",[row.id]);if(locked.rows[0]?.status!=="failed"){await c.query("UPDATE public.wallets SET balance=balance+$1,updated_at=now() WHERE id=$2",[row.amount,row.wallet_id]);await c.query("UPDATE public.withdrawals SET status='failed',failure_reason=$1,metadata=metadata || $2::jsonb WHERE id=$3",["PawaPay status "+st,JSON.stringify({pawapay:p.data}),row.id]);await c.query("UPDATE public.transactions SET status='failed',metadata=metadata || $1::jsonb WHERE metadata->>'withdrawal_id'=$2",[JSON.stringify({pawapay:p.data}),String(row.id)])}await c.query("COMMIT")}catch(e){await c.query("ROLLBACK")}finally{c.release()}return json({ok:true,withdrawal:{...row,status:"failed"}});}
  return json({ok:true,withdrawal:row,provider:p.data});
}
async function updateProfile(request,user) {
  const b=await body(request),country=String(b.country_code||user.country_code||"").trim().toUpperCase(),phone=normalizePhone(b.phone||user.phone,country),fullName=String(b.full_name??user.full_name??"").trim();
  if(!/^[A-Z]{2}$/.test(country))return bad("Pays invalide");
  const depositProviders=await availableProviders(country,"DEPOSIT"),payoutProviders=await availableProviders(country,"PAYOUT");
  const allowed=depositProviders.length>0||payoutProviders.length>0;
  const targetCurrency=depositProviders[0]?.currency||payoutProviders[0]?.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY;
  const c=await pool.connect();
  try{await c.query("BEGIN");const wallet=await c.query("SELECT id,balance,currency FROM public.wallets WHERE user_id=$1 FOR UPDATE",[user.id]);if(wallet.rows[0]&&Number(wallet.rows[0].balance)!==0&&wallet.rows[0].currency!==targetCurrency){await c.query("ROLLBACK");return bad("Impossible de changer de devise avec un solde non nul",409,"CURRENCY_CHANGE_REQUIRES_ZERO_BALANCE");}
    const r=await c.query(`UPDATE public.users SET full_name=COALESCE(NULLIF($1,''),full_name),country_code=$2,phone=COALESCE(NULLIF($3,''),phone),updated_at=now() WHERE id=$4 RETURNING id,email,full_name,phone,country_code,status,kyc_status`,[fullName,country,phone,user.id]);
    await c.query(`UPDATE public.wallets SET currency=$1,updated_at=now() WHERE user_id=$2 AND balance=0 AND currency<>$1`,[targetCurrency,user.id]); if(!r.rows[0])return bad("Profil introuvable",404,"NOT_FOUND"); await c.query("COMMIT");return json({ok:true,user:r.rows[0],payment_method_available:allowed});
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
}
async function recipientLookup(request,user,walletCode) {
  const code=String(walletCode||"").trim().toUpperCase();
  if(!/^WC-[A-Z0-9]{12}$/.test(code))return bad("Identifiant Wallet Connect invalide",400,"INVALID_WALLET_CODE");
  const q=await pool.query(
    `SELECT u.wallet_code,u.full_name,u.country_code,u.kyc_status,u.status
     FROM public.users u WHERE upper(u.wallet_code)=upper($1) AND u.status='active' LIMIT 1`,
    [code]
  );
  if(!q.rows[0])return bad("Utilisateur Wallet Connect introuvable",404,"NOT_FOUND");
  if(q.rows[0].wallet_code===user.wallet_code)return bad("Impossible de rechercher ton propre portefeuille",400,"SELF_LOOKUP");
  return json({ok:true,recipient:{
    walletCode:q.rows[0].wallet_code,
    fullName:q.rows[0].full_name||"Utilisateur Wallet Connect",
    countryCode:q.rows[0].country_code,
    kycStatus:q.rows[0].kyc_status
  }});
}
async function transactionDetail(request,user,reference) {
  const q=await pool.query(
    `SELECT t.id,t.reference,t.type,t.direction,t.amount,t.currency,t.status,t.description,t.metadata,t.created_at,t.completed_at
     FROM public.transactions t
     JOIN public.wallets w ON w.id=t.wallet_id
     WHERE t.reference=$1 AND w.user_id=$2
     LIMIT 1`,
    [reference,user.id]
  );
  if(!q.rows[0])return bad("Transaction introuvable",404,"NOT_FOUND");
  return json({ok:true,transaction:q.rows[0]});
}
async function me(user) {
  const r=await pool.query(`SELECT u.id,u.email,u.full_name,u.phone,u.country_code,u.status,u.kyc_status,u.wallet_code,w.id wallet_id,w.currency,w.balance FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE u.id=$1`,[user.id]);
  if(!r.rows[0])return bad("Profil introuvable",404);
  const tx=await pool.query(`SELECT id,reference,type,direction,amount,currency,status,description,created_at FROM public.transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 20`,[r.rows[0].wallet_id]);
  const fee=await pool.query(
    `SELECT fee_type,fee_value FROM public.fee_settings
     WHERE operation='transfer' AND active=true AND currency=$1
       AND (country_code=$2 OR country_code IS NULL)
     ORDER BY CASE WHEN country_code=$2 THEN 0 ELSE 1 END LIMIT 1`,
    [r.rows[0].currency||DEFAULT_CURRENCY,r.rows[0].country_code||null]
  );
  const transferFee=fee.rows[0]||{fee_type:"percentage",fee_value:0};
  return json({ok:true,user:{...r.rows[0],transfer_fee_type:transferFee.fee_type,transfer_fee_value:Number(transferFee.fee_value)},transactions:tx.rows});
}
async function handler(request) {
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith("/auth/"))return authProxy(request,path.slice(5));
  if(path==="/health"||path==="/")return json({ok:true,service:"walletapi",version:"1.0.2"});
  let user; try{user=await requireUser(request)}catch(e){return bad(e.message||"Authentification requise",e.status||401,"UNAUTHORIZED")}
  try{
    if(request.method==="GET"&&path==="/me")return me(user);
    if(request.method==="GET"&&path.startsWith("/recipients/"))return recipientLookup(request,user,path.split("/")[2]);
    if(request.method==="GET"&&path.startsWith("/transactions/"))return transactionDetail(request,user,path.split("/")[2]);
    if(request.method==="POST"&&path==="/profile")return updateProfile(request,user);
    if(request.method==="POST"&&path==="/transfer")return transfer(request,user);
    if(request.method==="POST"&&path==="/topups")return createTopup(request,user);
    if(request.method==="GET"&&path.startsWith("/topups/")&&path.endsWith("/status"))return topupStatus(request,user,path.split("/")[2]);
    if(request.method==="POST"&&path==="/withdrawals")return withdraw(request,user);
    if(request.method==="GET"&&path.startsWith("/withdrawals/")&&path.endsWith("/status"))return withdrawalStatus(request,user,path.split("/")[2]);
    if(request.method==="GET"&&path==="/providers"){
      const country=String(url.searchParams.get("country")||user.country_code||DEFAULT_COUNTRY).toUpperCase();
      const [deposit,payout]=await Promise.all([availableProviders(country,"DEPOSIT"),availableProviders(country,"PAYOUT")]);
      return json({ok:true,country,currency:(deposit[0]?.currency||payout[0]?.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY),depositProviders:deposit,payoutProviders:payout});
    }
    return bad("Route introuvable",404,"NOT_FOUND");
  }catch(e){console.error(e);return bad(e.message||"Erreur serveur",e.status||500,"SERVER_ERROR")}
}
export default {fetch:handler};
