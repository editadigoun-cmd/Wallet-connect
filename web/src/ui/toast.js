let timer;
export function toast(message, type="info"){
  const t=document.getElementById("toast");
  if(!t)return;
  const text=String(message||"");
  const inferred=/erreur|refus|échec|échoué|introuvable|insuffisant|impossible|requis/i.test(text)?"error":/réussi|confirm|valid|envoy|créé|enregistr/i.test(text)?"success":type;
  t.className="toast "+inferred+" show";
  t.innerHTML='<span class="toast-icon">'+(inferred==="success"?"✓":inferred==="error"?"!":"i")+'</span><span class="toast-text"></span>';
  t.querySelector(".toast-text").textContent=text;
  clearTimeout(timer);
  timer=setTimeout(()=>t.classList.remove("show"),3600);
}