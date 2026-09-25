// Wallet Connect Production API — deployed to Neon Functions.
// Secrets are injected at deployment/runtime; never place them in this file.
export default {
  async fetch(request) {
    return new Response(JSON.stringify({ok:true,service:"walletapi",version:"production-api"}), {
      headers: {"Content-Type":"application/json","Access-Control-Allow-Origin":"https://editadigoun-cmd.github.io"}
    });
  }
};
