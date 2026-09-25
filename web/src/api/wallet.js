import {api} from "./client.js";
export const walletApi={
  topup:payload=>api("/topups",{method:"POST",headers:{"Idempotency-Key":"topup-"+crypto.randomUUID()},body:JSON.stringify(payload)}),
  withdraw:payload=>api("/withdrawals",{method:"POST",headers:{"Idempotency-Key":"withdraw-"+crypto.randomUUID()},body:JSON.stringify(payload)}),
  status:path=>api(path),
  topupStatusPath:reference=>"/topups/"+reference+"/status",
  withdrawStatusPath:reference=>"/withdrawals/"+reference+"/status"
};
