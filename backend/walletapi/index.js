import { Pool } from "pg";

const PORTAL_ORIGIN = "https://editadigoun-cmd.github.io";
const AUTH_BASE = "https://ep-shiny-haze-b4e7a5b4.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth";
const PAWAPAY_BASE = "https://api.pawapay.io/v2";
const DEFAULT_PROVIDER = "MTN_MOMO_COG";
const DEFAULT_COUNTRY = "CG";
const DEFAULT_CURRENCY = "XAF";
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
function normalizePhone(v) {
  return String(v || "").replace(/\D/g, "");
}
function idempotency(request, fallback) {
  return request.headers.get("Idempotency-Key") || fallback;
}
function decodeAuthCookie(request) {
  const raw = request.headers.get("cookie") || "";
  const m = raw.match(/(?:^|;\\s*)wallet_auth=([^;]+)/);
  if (!m) return "";
  try { return Buffer.from(decodeURIComponent(m[1]), "base64url").toString("utf8"); } catch { return ""; }
}
function cookieHeader(request) {
  return decodeAuthCookie(request);
}
async function authProxy(request, path) {
  const url = AUTH_BASE + path;
  const headers = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  headers.set("origin", PORTAL_ORIGIN);
  const cookie = cookieHeader(request);
  if (cookie) headers.set("cookie", cookie);
  const init = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  const upstream = await fetch(url, init);
  const out = new Headers(cors({ "Content-Type": upstream.headers.get("content-type") || "application/json" }));
  const setCookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  const pairs = setCookies.map(c => c.split(";")[0]).filter(Boolean);
  if (pairs.length) {
    const packed = encodeURIComponent(Buffer.from(pairs.join("; ")).toString("base64url"));
    out.append("Set-Cookie", "wallet_auth=" + packed + "; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800");
  }
  if (path === "/sign-out") {
    out.append("Set-Cookie", "wallet_auth=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
  }
  return new Response(await upstream.text(), { status: upstream.status, headers: out });
}

