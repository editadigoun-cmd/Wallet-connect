export default {
  fetch: async (request) => {
    return new Response(JSON.stringify({ok:true,service:"walletapi"}), {
      headers: {"content-type":"application/json"}
    });
  }
};
