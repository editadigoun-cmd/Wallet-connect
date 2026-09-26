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
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

function operationType(provider,kind){const ops=Array.isArray(provider?.operationTypes)?provider.operationTypes:[];return ops.find(x=>x&&String(x.operationType).toUpperCase()===String(kind).toUpperCase())||null;}
function providerBrand(provider=""){ const p=String(provider||"").toUpperCase(); if(p.includes("MTN"))return{name:"MTN Mobile Money",logo:""};if(p.includes("MOOV"))return{name:"Moov Money",logo:""};if(p.includes("AIRTEL"))return{name:"Airtel Money",logo:""};if(p.includes("ORANGE"))return{name:"Orange Money",logo:""};if(p.includes("WAVE"))return{name:"Wave",logo:""};return{name:provider||"Moyen de paiement",logo:""}; }
function cors(headers = {}) { return {"Access-Control-Allow-Origin":PORTAL_ORIGIN,"Access-Control-Allow-Credentials":"true","Access-Control-Allow-Headers":"Content-Type, Authorization, Idempotency-Key","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Vary":"Origin",...headers}; }
function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:cors({"Content-Type":"application/json",...headers})});}
function bad(message,status=400,code="BAD_REQUEST"){return json({ok:false,error:message,code},status);}
async function body(request){try{return await request.json()}catch{return {}}}
function amountInt(v){const n=Number(v);return Number.isFinite(n)&&n>0?Math.round(n):0;}
function normalizePhone(v,country=""){let n=String(v||"").replace(/\D/g,"");const c=String(country||"").toUpperCase();if(c==="BJ"){if(n.startsWith("229"))n=n.slice(3);if(n.length===9)n="01"+n.slice(1);if(n.length===10&&!n.startsWith("0"))n="0"+n;return "229"+n;}const cc=COUNTRY_DIAL[c];if(cc&&n.startsWith("0"))n=cc+n.slice(1);else if(cc&&!n.startsWith(cc))n=cc+n;return n;}
function idempotency(request,fallback){return request.headers.get("Idempotency-Key")||fallback;}
function decodeAuthCookie(request){const raw=request.headers.get("cookie")||"";const m=raw.match(/(?:^|;\s*)wallet_auth=([^;]+)/);if(!m)return"";try{return Buffer.from(decodeURIComponent(m[1]),"base64url").toString("utf8")}catch{return""}}
function cookieHeader(request){return decodeAuthCookie(request)}
async function authProxy(request,path){const url=AUTH_BASE+path,headers=new Headers(),ct=request.headers.get("content-type");if(ct)headers.set("content-type",ct);headers.set("origin",PORTAL_ORIGIN);const cookie=cookieHeader(request);if(cookie)headers.set("cookie",cookie);const init={method:request.method,headers,redirect:"manual"};if(request.method!=="GET"&&request.method!=="HEAD")init.body=await request.text();let upstream;try{upstream=await fetch(url,init)}catch(e){console.error("AUTH_UPSTREAM_FETCH_ERROR",e);return json({ok:false,error:"Service d'authentification temporairement indisponible.",code:"AUTH_UPSTREAM_UNAVAILABLE"},502)}const out=new Headers(cors({"Content-Type":upstream.headers.get("content-type")||"application/json"}));if(upstream.status>=300&&upstream.status<400)return json({ok:false,error:"Le service d'authentification a renvoyé une redirection inattendue.",code:"AUTH_REDIRECT"},502);const setCookies=typeof upstream.headers.getSetCookie==="function"?upstream.headers.getSetCookie():(upstream.headers.get("set-cookie")?[upstream.headers.get("set-cookie")]:[]);const pairs=setCookies.flatMap(c=>String(c).split(/,(?=[^;]+?=)/)).map(c=>c.split(";")[0]).filter(Boolean);if(pairs.length)out.append("Set-Cookie","wallet_auth="+encodeURIComponent(Buffer.from(pairs.join("; ")).toString("base64url"))+"; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800");if(path==="/sign-out")out.append("Set-Cookie","wallet_auth=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");out.set("Cache-Control","no-store");return new Response(await upstream.text(),{status:upstream.status,headers:out});}
async function getSession(request){const cookie=cookieHeader(request);if(!cookie)return null;const r=await fetch(AUTH_BASE+"/get-session",{headers:{cookie,origin:PORTAL_ORIGIN}});if(!r.ok)return null;try{return await r.json()}catch{return null}}
async function requireUser(request){const session=await getSession(request),authUser=session?.user;if(!authUser?.id||!authUser?.email)throw Object.assign(new Error("Authentification requise"),{status:401});const client=await pool.connect();try{await client.query("BEGIN");const result=await client.query(`INSERT INTO public.users (auth_user_id,email,full_name,status,kyc_status,country_code) VALUES ($1,$2,$3,'active','not_started',NULL) ON CONFLICT (auth_user_id) DO UPDATE SET email=EXCLUDED.email,full_name=COALESCE(EXCLUDED.full_name,public.users.full_name),updated_at=now() RETURNING id,email,full_name,phone,country_code,status,kyc_status,wallet_code`,[authUser.id,authUser.email,authUser.name||null]);const user=result.rows[0];const currency=COUNTRY_CURRENCY[user.country_code]||DEFAULT_CURRENCY;await client.query(`INSERT INTO public.wallets (user_id,currency,balance,status) VALUES ($1,$2,0,'active') ON CONFLICT (user_id) DO UPDATE SET currency=CASE WHEN public.wallets.balance=0 THEN EXCLUDED.currency ELSE public.wallets.currency END,updated_at=CASE WHEN public.wallets.balance=0 THEN now() ELSE public.wallets.updated_at END`,[user.id,currency]);await client.query("COMMIT");return user}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}}
async function pawapay(path,method,payload){const token=process.env.PAWAPAY_API_TOKEN;if(!token)throw new Error("PawaPay non configuré");const r=await fetch(PAWAPAY_BASE+path,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data={raw:text}}return{ok:r.ok,status:r.status,data}}

// Provider discovery: merchant authorization comes from active-conf; live status comes from V2 /availability.
// V2 availability returns `providers`, while active-conf commonly returns `correspondents`.
async function availableProviders(country,kind){
  const iso2=String(country||"").toUpperCase();
  const iso3=COUNTRY_ISO3[iso2]||iso2;
  const aliases=new Set([iso2,iso3]);
  const active=await pawapay("/active-conf","GET");
  if(!active.ok){console.error("PAWAPAY_ACTIVE_CONF_ERROR",active.status,active.data);return[];}
  const countries=Array.isArray(active.data?.countries)?active.data.countries:(Array.isArray(active.data)?active.data:[]);
  const cc=countries.find(x=>aliases.has(String(x.country||x.countryCode||x.iso3||"").toUpperCase()));
  const configuredList=Array.isArray(cc?.correspondents)?cc.correspondents:(Array.isArray(cc?.providers)?cc.providers:[]);
  const configured=configuredList.map(x=>{
    const correspondent=x.correspondent||x.provider||x.code;
    const ops=Array.isArray(x.operationTypes)?x.operationTypes.map(o=>typeof o==="string"?{operationType:o}:o).filter(Boolean):[];
    const op=operationType({operationTypes:ops},kind);if(!correspondent||!op)return null;
    const brand=providerBrand(correspondent);
    return {...x,correspondent,provider:correspondent,currency:x.currency||COUNTRY_CURRENCY[iso2]||DEFAULT_CURRENCY,displayName:x.displayName||x.name||brand.name,logo:x.logo||x.logoUrl||brand.logo,operationTypes:ops,activeOperation:op};
  }).filter(Boolean);
  if(!configured.length)return[];

  const live=await pawapay("/availability?country="+encodeURIComponent(iso3)+"&operationType="+encodeURIComponent(kind),"GET");
  if(!live.ok){console.error("PAWAPAY_AVAILABILITY_ERROR",live.status,live.data);return configured.map(x=>({...x,status:"CONFIGURED"}));}
  const raw=live.data;
  const availabilityCountries=Array.isArray(raw)?raw:(Array.isArray(raw?.countries)?raw.countries:(raw?.country?[raw]:[]));
  const ac=availabilityCountries.find(x=>aliases.has(String(x.country||x.countryCode||x.iso3||"").toUpperCase()));
  const available=Array.isArray(ac?.providers)?ac.providers:(Array.isArray(ac?.correspondents)?ac.correspondents:(Array.isArray(raw?.providers)?raw.providers:[]));
  if(!available.length)return configured.map(x=>({...x,status:"CONFIGURED"}));
  return configured.map(cfg=>{
    const liveProvider=available.find(x=>(x.provider||x.correspondent||x.code)===cfg.correspondent);
    const liveOps=Array.isArray(liveProvider?.operationTypes)?liveProvider.operationTypes.map(o=>typeof o==="string"?{operationType:o}:o):[];
    const liveOp=operationType({operationTypes:liveOps},kind);
    const status=String(liveOp?.status||"CONFIGURED").toUpperCase();
    return {...cfg,status,operationTypes:liveOps.length?liveOps:cfg.operationTypes};
  }).filter(x=>x.status==="OPERATIONAL"||x.status==="CONFIGURED");
}

async function activePaymentMethod(country){const providers=await availableProviders(country,"DEPOSIT");const p=providers[0];return p?{country_code:country,provider:p.correspondent,method_code:p.correspondent,currency:p.currency}:null;}
async function feeConfig(operation,country,currency){const q=await pool.query(`SELECT fee_type,fee_value FROM public.fee_settings WHERE operation=$1 AND active=true AND currency=$2 AND (country_code=$3 OR country_code IS NULL) ORDER BY CASE WHEN country_code=$3 THEN 0 ELSE 1 END LIMIT 1`,[operation,currency,country]);if(q.rows[0])return q.rows[0];if(operation==="topup")return{fee_type:"percentage",fee_value:7};return null;}
function calculateFee(amount,config){if(!config)return 0;const value=Number(config.fee_value||0);if(config.fee_type==="percentage")return Math.round(amount*value/100);return Math.max(0,Math.round(value));}

// Keep the remainder of the API exactly as it was; only provider discovery above is changed.
