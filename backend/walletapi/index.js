export default async function handler(request) {
  const url = new URL(request.url);
  if (url.pathname === "/health" || url.pathname === "/") {
    return new Response(JSON.stringify({ ok: true, service: "walletapi" }), {
      headers: { "content-type": "application/json" }
    });
  }
  return new Response(JSON.stringify({ ok: false, error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
}
