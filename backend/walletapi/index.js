import { Pool } from "pg";

const PORTAL_ORIGIN = "https://editadigoun-cmd.github.io";
const AUTH_BASE = "https://ep-shiny-haze-b4e7a5b4.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";
const PAWAPAY_BASE = "https://api.pawapay.io/v2";
const DEFAULT_PROVIDER = "MTN_MOMO_COG";
const DEFAULT_COUNTRY = "CG";
const DEFAULT_CURRENCY = "XAF";
const COUNTRY_CURRENCY = { CG: "XAF", BJ: "XOF" };
const COUNTRY_DIAL = { BJ:"229", CG:"242", CD:"243", CI:"225", CM:"237", SN:"221", TG:"228", GH:"233", NG:"234", ZA:"27", FR:"33", BE:"32", CA:"1", US:"1", GB:"44", DE:"49", IT:"39", ES:"34", PT:"351" };
const COUNTRY_ISO3 = { BJ:"BEN", CG:"COG", CD:"COD", CI:"CIV", CM:"CMR", SN:"SEN", TG:"TGO", GH:"GHA", NG:"NGA", ZA:"ZAF", FR:"FRA", BE:"BEL", CA:"CAN", US:"USA", GB:"GBR", DE:"DEU", IT:"ITA", ES:"ESP", PT:"PRT" };
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

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
  const cc = COUNTRY_DIAL[String(country || "").toUpperCase()];
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
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  const upstream = await fetch(url, init);
  const out = new Headers(cors({ "Content-Type": upstream.headers.get("content-type") || "application/json" }));
  const setCookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  const pairs = setCookies.map(c => c.split(";")[0]).filter(Boolean);
  if (pairs.length) out.append("Set-Cookie", "wallet_auth=" + encodeURIComponent(Buffer.from(pairs.join("; ")).toString("base64url")) + "; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800");
  if (path === "/sign-out") out.append("Set-Cookie", "wallet_auth=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
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
       RETURNING id,email,full_name,phone,country_code,status,kyc_status`,
      [authUser.id, authUser.email, authUser.name || null]
    );
    const user = result.rows[0];
    await client.query(
      `INSERT INTO public.wallets (user_id,currency,balance,status)
       VALUES ($1,COALESCE($2,'XAF'),0,'active') ON CONFLICT (user_id) DO NOTHING`,
      [user.id, COUNTRY_CURRENCY[user.country_code] || DEFAULT_CURRENCY]
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
async function activePaymentMethod(country) {
  const r=await pool.query(`SELECT country_code,provider,method_code,currency FROM public.payment_methods WHERE country_code=$1 AND active=true AND supports_topup=true AND supports_withdrawal=true ORDER BY id LIMIT 1`,[country]);
  return r.rows[0]||null;
}
async function createTopup(request,user) {
  const b=await body(request), amount=amountInt(b.amount), country=String(user.country_code||DEFAULT_COUNTRY).toUpperCase(), phone=normalizePhone(b.phone,country);
  if(!amount||!phone)return bad("Montant et numéro MTN requis");
  const key=idempotency(request,"topup-"+crypto.randomUUID()), method=await activePaymentMethod(country);
  if(!method)return bad("Aucun moyen de paiement n'est encore disponible dans ton pays");
  const provider=method.provider, currency=method.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY;
  const client=await pool.connect(); let row;
  try {
    await client.query("BEGIN");
    const existing=await client.query("SELECT * FROM public.topups WHERE idempotency_key=$1 LIMIT 1",[key]);
    if(existing.rows[0]){await client.query("COMMIT");return json({ok:true,topup:existing.rows[0]});}
    const wallet=await client.query("SELECT id FROM public.wallets WHERE user_id=$1 AND status='active' FOR UPDATE",[user.id]);
    if(!wallet.rows[0])throw new Error("Portefeuille introuvable");
    const ref="TOP-"+crypto.randomUUID(), providerReference=crypto.randomUUID();
    const ins=await client.query(`INSERT INTO public.topups(reference,wallet_id,amount,fee_amount,currency,provider,status,payment_method,metadata,idempotency_key,provider_reference)
      VALUES ($1,$2,$3,0,$4,$5,'pending','MTN_MOBILE_MONEY',$6,$7,$8) RETURNING *`,
      [ref,wallet.rows[0].id,amount,currency,provider,JSON.stringify({phone,provider,country}),key,providerReference]);
    row=ins.rows[0]; await client.query("COMMIT");
  } catch(e){await client.query("ROLLBACK");client.release();throw e} client.release();
  const p=await pawapay("/deposits","POST",{
    depositId:row.provider_reference, amount:String(amount), currency,
    payer:{type:"MMO",accountDetails:{phoneNumber:phone,provider}},
    customerMessage:"Recharge Wallet",
    metadata:[{fieldName:"walletConnectReference",fieldValue:row.reference}]
  });
  const status=p.ok?"pending":"failed";
  await pool.query("UPDATE public.topups SET status=$1,metadata=metadata || $2::jsonb WHERE id=$3",[status,JSON.stringify({pawapay_response:p.data}),row.id]);
  if(!p.ok)return json({ok:false,error:"PawaPay a refusé la recharge",details:p.data},502);
  return json({ok:true,topup:{...row,status},provider_response:p.data},202);
}
async function topupStatus(request,user,reference) {
  const q=await pool.query(`SELECT t.* FROM public.topups t JOIN public.wallets w ON w.id=t.wallet_id WHERE t.reference=$1 AND w.user_id=$2`,[reference,user.id]);
  if(!q.rows[0])return bad("Recharge introuvable",404,"NOT_FOUND");
  const row=q.rows[0]; if(["successful","failed","cancelled"].includes(row.status))return json({ok:true,topup:row});
  const p=await pawapay("/deposits/"+encodeURIComponent(row.provider_reference||row.reference),"GET");
  if(!p.ok)return json({ok:true,topup:row,provider:p.data});
  const providerStatus=String(p.data?.status||"").toUpperCase();
  if(["COMPLETED","SUCCESSFUL"].includes(providerStatus)){
    const c=await pool.connect();
    try{
      await c.query("BEGIN");
      const locked=await c.query("SELECT * FROM public.topups WHERE id=$1 FOR UPDATE",[row.id]);
      if(locked.rows[0]?.status==="pending"){
        const w=await c.query("SELECT * FROM public.wallets WHERE id=$1 FOR UPDATE",[row.wallet_id]);
        const before=Number(w.rows[0].balance),after=before+Number(row.amount);
        await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[after,row.wallet_id]);
        await c.query("UPDATE public.topups SET status='successful',completed_at=now(),metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay_status:providerStatus}),row.id]);
        await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
          VALUES ($1,$2,'topup','credit',$3,$4,$5,$6,'successful','Recharge MTN',$7,now())`,
          ["TX-"+crypto.randomUUID(),row.wallet_id,row.amount,row.currency,before,after,JSON.stringify({topup_id:row.id,provider_reference:row.provider_reference})]);
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
  const b=await body(request),amount=amountInt(b.amount),recipient=String(b.recipient||"").trim(); if(!amount||!recipient)return bad("Destinataire et montant requis");
  const key=idempotency(request,"transfer-"+crypto.randomUUID()),c=await pool.connect();
  try{
    await c.query("BEGIN"); const ex=await c.query("SELECT * FROM public.transfers WHERE idempotency_key=$1",[key]);
    if(ex.rows[0]){await c.query("COMMIT");return json({ok:true,transfer:ex.rows[0]});}
    const s=await c.query("SELECT u.id,w.id wallet_id,w.balance,w.currency FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE u.id=$1 FOR UPDATE",[user.id]);
    const r=await c.query("SELECT u.id,w.id wallet_id,u.email,u.full_name,w.currency FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE (lower(u.email)=lower($1) OR u.phone=$1) AND u.status='active' LIMIT 1",[recipient]);
    if(!s.rows[0]||!r.rows[0])throw Object.assign(new Error("Destinataire introuvable"),{status:404});
    if(r.rows[0].id===user.id)throw new Error("Impossible de transférer vers soi-même");
    const fee=Math.round(amount*0.01),total=amount+fee,before=Number(s.rows[0].balance); if(before<total)throw Object.assign(new Error("Solde insuffisant"),{status:409});
    const ref="TRF-"+crypto.randomUUID();
    const ins=await c.query(`INSERT INTO public.transfers(reference,sender_wallet_id,receiver_wallet_id,amount,fee_amount,currency,status,note,idempotency_key)
      VALUES($1,$2,$3,$4,$5,$6,'successful',$7,$8) RETURNING *`,[ref,s.rows[0].wallet_id,r.rows[0].wallet_id,amount,fee,s.rows[0].currency||DEFAULT_CURRENCY,b.note||null,key]);
    const after=before-total; await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[after,s.rows[0].wallet_id]);
    const rw=await c.query("SELECT balance FROM public.wallets WHERE id=$1 FOR UPDATE",[r.rows[0].wallet_id]); const rbefore=Number(rw.rows[0].balance),rafter=rbefore+amount;
    await c.query("UPDATE public.wallets SET balance=$1,updated_at=now() WHERE id=$2",[rafter,r.rows[0].wallet_id]);
    await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
      VALUES($1,$2,'transfer_out','debit',$3,$4,$5,$6,'successful','Transfert envoyé',$7,now())`,["TX-"+crypto.randomUUID(),s.rows[0].wallet_id,total,s.rows[0].currency||DEFAULT_CURRENCY,before,after,JSON.stringify({transfer_id:ins.rows[0].id,fee})]);
    await c.query(`INSERT INTO public.transactions(reference,wallet_id,type,direction,amount,currency,balance_before,balance_after,status,description,metadata,completed_at)
      VALUES($1,$2,'transfer_in','credit',$3,$4,$5,$6,'successful','Transfert reçu',$7,now())`,["TX-"+crypto.randomUUID(),r.rows[0].wallet_id,amount,rw.rows[0].currency||s.rows[0].currency||DEFAULT_CURRENCY,rbefore,rafter,JSON.stringify({transfer_id:ins.rows[0].id})]);
    await c.query("COMMIT"); return json({ok:true,transfer:{...ins.rows[0],recipient:{email:r.rows[0].email,name:r.rows[0].full_name},fee_amount:fee,total_debited:total}},201);
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
}
async function withdraw(request,user) {
  const b=await body(request),amount=amountInt(b.amount),country=String(user.country_code||DEFAULT_COUNTRY).toUpperCase(),phone=normalizePhone(b.phone,country);
  if(!amount||!phone)return bad("Montant et numéro MTN requis");
  const method=await activePaymentMethod(country); if(!method)return bad("Aucun moyen de retrait n'est encore disponible dans ton pays");
  const provider=method.provider,currency=method.currency||COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY,key=idempotency(request,"withdraw-"+crypto.randomUUID()),c=await pool.connect(); let row;
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
      VALUES($1,$2,'withdrawal','debit',$3,$4,$5,$6,'pending','Retrait MTN',$7)`,["TX-"+crypto.randomUUID(),w.rows[0].id,amount,currency,before,after,JSON.stringify({withdrawal_id:ins.rows[0].id})]);
    await c.query("COMMIT"); row=ins.rows[0];
  }catch(e){await c.query("ROLLBACK");c.release();throw e} c.release();
  const p=await pawapay("/payouts","POST",{payoutId:row.provider_reference,amount:String(amount),currency:row.currency,recipient:{type:"MMO",accountDetails:{phoneNumber:normalizePhone(row.destination_account,country),provider:row.provider}},customerMessage:"Retrait Wallet",clientReferenceId:row.reference,metadata:[{fieldName:"walletConnectReference",fieldValue:row.reference}]});
  if(!p.ok){const c2=await pool.connect();try{await c2.query("BEGIN");await c2.query("UPDATE public.wallets SET balance=balance+$1,updated_at=now() WHERE id=$2",[amount,row.wallet_id]);await c2.query("UPDATE public.withdrawals SET status='failed',failure_reason=$1,metadata=metadata || $2::jsonb WHERE id=$3",["PawaPay rejection",JSON.stringify({pawapay:p.data}),row.id]);await c2.query("UPDATE public.transactions SET status='failed',metadata=metadata || $1::jsonb WHERE metadata->>'withdrawal_id'=$2",[JSON.stringify({pawapay:p.data}),String(row.id)]);await c2.query("COMMIT")}catch(e){await c2.query("ROLLBACK")}finally{c2.release();}return json({ok:false,error:"PawaPay a refusé le retrait",details:p.data},502);}
  await pool.query("UPDATE public.withdrawals SET status='processing',metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay:p.data}),row.id]);
  return json({ok:true,withdrawal:{...row,status:"processing",provider_reference:row.provider_reference},provider_response:p.data},202);
}
async function withdrawalStatus(request,user,reference) {
  const q=await pool.query(`SELECT w.* FROM public.withdrawals w JOIN public.wallets wa ON wa.id=w.wallet_id WHERE w.reference=$1 AND wa.user_id=$2`,[reference,user.id]);
  if(!q.rows[0])return bad("Retrait introuvable",404,"NOT_FOUND"); const row=q.rows[0];
  if(["successful","failed","cancelled"].includes(row.status))return json({ok:true,withdrawal:row});
  const p=await pawapay("/payouts/"+encodeURIComponent(row.provider_reference||row.reference),"GET"); if(!p.ok)return json({ok:true,withdrawal:row,provider:p.data});
  const st=String(p.data?.status||"").toUpperCase();
  if(["COMPLETED","SUCCESSFUL"].includes(st)){await pool.query("UPDATE public.withdrawals SET status='successful',completed_at=now(),metadata=metadata || $1::jsonb WHERE id=$2",[JSON.stringify({pawapay_status:st}),row.id]);await pool.query("UPDATE public.transactions SET status='successful',completed_at=now() WHERE metadata->>'withdrawal_id'=$1",[String(row.id)]);return json({ok:true,withdrawal:{...row,status:"successful"}});}
  if(["FAILED","REJECTED","CANCELLED"].includes(st)){const c=await pool.connect();try{await c.query("BEGIN");const locked=await c.query("SELECT * FROM public.withdrawals WHERE id=$1 FOR UPDATE",[row.id]);if(locked.rows[0]?.status!=="failed"){await c.query("UPDATE public.wallets SET balance=balance+$1,updated_at=now() WHERE id=$2",[row.amount,row.wallet_id]);await c.query("UPDATE public.withdrawals SET status='failed',failure_reason=$1,metadata=metadata || $2::jsonb WHERE id=$3",["PawaPay status "+st,JSON.stringify({pawapay:p.data}),row.id]);await c.query("UPDATE public.transactions SET status='failed',metadata=metadata || $1::jsonb WHERE metadata->>'withdrawal_id'=$2",[JSON.stringify({pawapay:p.data}),String(row.id)])}await c.query("COMMIT")}catch(e){await c.query("ROLLBACK")}finally{c.release()}return json({ok:true,withdrawal:{...row,status:"failed"}});}
  return json({ok:true,withdrawal:row,provider:p.data});
}
async function updateProfile(request,user) {
  const b=await body(request),country=String(b.country_code||"").trim().toUpperCase(),phone=normalizePhone(b.phone,country);
  if(!/^[A-Z]{2}$/.test(country))return bad("Pays invalide");
  const allowed=await pool.query("SELECT 1 FROM public.payment_methods WHERE country_code=$1 AND active=true AND (supports_topup=true OR supports_withdrawal=true) LIMIT 1",[country]),c=await pool.connect();
  try{await c.query("BEGIN");const wallet=await c.query("SELECT id,balance,currency FROM public.wallets WHERE user_id=$1 FOR UPDATE",[user.id]);const targetCurrency=COUNTRY_CURRENCY[country]||DEFAULT_CURRENCY;
    if(wallet.rows[0]&&Number(wallet.rows[0].balance)!==0&&wallet.rows[0].currency!==targetCurrency){await c.query("ROLLBACK");return bad("Impossible de changer de devise avec un solde non nul",409,"CURRENCY_CHANGE_REQUIRES_ZERO_BALANCE");}
    const r=await c.query(`UPDATE public.users SET country_code=$1,phone=COALESCE(NULLIF($2,''),phone),updated_at=now() WHERE id=$3 RETURNING id,email,full_name,phone,country_code,status,kyc_status`,[country,phone,user.id]);
    await c.query(`UPDATE public.wallets SET currency=$1,updated_at=now() WHERE user_id=$2 AND balance=0 AND currency<>$1`,[targetCurrency,user.id]); if(!r.rows[0])return bad("Profil introuvable",404,"NOT_FOUND"); await c.query("COMMIT");return json({ok:true,user:r.rows[0],payment_method_available:Boolean(allowed.rows[0])});
  }catch(e){await c.query("ROLLBACK");throw e}finally{c.release();}
}
async function me(user) {
  const r=await pool.query(`SELECT u.id,u.email,u.full_name,u.phone,u.country_code,u.status,u.kyc_status,w.id wallet_id,w.currency,w.balance FROM public.users u JOIN public.wallets w ON w.user_id=u.id WHERE u.id=$1`,[user.id]);
  if(!r.rows[0])return bad("Profil introuvable",404);
  const tx=await pool.query(`SELECT id,reference,type,direction,amount,currency,status,description,created_at FROM public.transactions WHERE wallet_id=$1 ORDER BY created_at DESC LIMIT 20`,[r.rows[0].wallet_id]);
  return json({ok:true,user:r.rows[0],transactions:tx.rows});
}
async function handler(request) {
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors()});
  const url=new URL(request.url),path=url.pathname;
  if(path.startsWith("/auth/"))return authProxy(request,path.slice(5));
  if(path==="/health"||path==="/")return json({ok:true,service:"walletapi",version:"1.0.2"});
  let user; try{user=await requireUser(request)}catch(e){return bad(e.message||"Authentification requise",e.status||401,"UNAUTHORIZED")}
  try{
    if(request.method==="GET"&&path==="/me")return me(user);
    if(request.method==="POST"&&path==="/profile")return updateProfile(request,user);
    if(request.method==="POST"&&path==="/transfer")return transfer(request,user);
    if(request.method==="POST"&&path==="/topups")return createTopup(request,user);
    if(request.method==="GET"&&path.startsWith("/topups/")&&path.endsWith("/status"))return topupStatus(request,user,path.split("/")[2]);
    if(request.method==="POST"&&path==="/withdrawals")return withdraw(request,user);
    if(request.method==="GET"&&path.startsWith("/withdrawals/")&&path.endsWith("/status"))return withdrawalStatus(request,user,path.split("/")[2]);
    if(request.method==="GET"&&path==="/providers")return json({ok:true,providers:[{country:"CG",currency:"XAF",provider:DEFAULT_PROVIDER,name:"MTN Mobile Money"},{country:"BJ",currency:"XOF",provider:"MTN_MOMO_BEN",name:"MTN Mobile Money"}]});
    return bad("Route introuvable",404,"NOT_FOUND");
  }catch(e){console.error(e);return bad(e.message||"Erreur serveur",e.status||500,"SERVER_ERROR")}
}
export default {fetch:handler};