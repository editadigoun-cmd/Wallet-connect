from pathlib import Path
import re

p = Path("backend/walletapi/index.js")
s = p.read_text()
pattern = r"async function requireUser\(request\)\{.*?\}\nasync function pawapay"
m = re.search(pattern, s, re.S)
if not m:
    raise SystemExit("requireUser block not found")

new = '''async function requireUser(request){const session=await getSession(request),authUser=session?.user;if(!authUser?.id||!authUser?.email)throw Object.assign(new Error("Authentification requise"),{status:401});const client=await pool.connect();try{await client.query("BEGIN");let result=await client.query(`SELECT id,email,full_name,phone,country_code,status,kyc_status,wallet_code,auth_user_id FROM public.users WHERE auth_user_id=$1 OR lower(email)=lower($2) ORDER BY CASE WHEN auth_user_id=$1 THEN 0 ELSE 1 END LIMIT 1 FOR UPDATE`,[authUser.id,authUser.email]);let user;if(result.rows[0]){const existing=result.rows[0];result=await client.query(`UPDATE public.users SET auth_user_id=$1,email=$2,full_name=COALESCE(NULLIF($3,''),full_name),updated_at=now() WHERE id=$4 RETURNING id,email,full_name,phone,country_code,status,kyc_status,wallet_code`,[authUser.id,authUser.email,authUser.name||"",existing.id]);user=result.rows[0]}else{result=await client.query(`INSERT INTO public.users (auth_user_id,email,full_name,status,kyc_status,country_code) VALUES ($1,$2,$3,'active','not_started',NULL) RETURNING id,email,full_name,phone,country_code,status,kyc_status,wallet_code`,[authUser.id,authUser.email,authUser.name||null]);user=result.rows[0]}const currency=COUNTRY_CURRENCY[user.country_code]||DEFAULT_CURRENCY;await client.query(`INSERT INTO public.wallets (user_id,currency,balance,status) VALUES ($1,$2,0,'active') ON CONFLICT (user_id) DO UPDATE SET currency=CASE WHEN public.wallets.balance=0 THEN EXCLUDED.currency ELSE public.wallets.currency END,updated_at=CASE WHEN public.wallets.balance=0 THEN now() ELSE public.wallets.updated_at END`,[user.id,currency]);await client.query("COMMIT");return user}catch(e){await client.query("ROLLBACK");throw e}finally{client.release()}}
async function pawapay'''

p.write_text(s[:m.start()] + new + s[m.end():])
