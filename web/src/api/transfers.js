import {api} from "./client.js";
export const transferApi={send:payload=>api("/transfer",{method:"POST",headers:{"Idempotency-Key":"transfer-"+crypto.randomUUID()},body:JSON.stringify(payload)})};
