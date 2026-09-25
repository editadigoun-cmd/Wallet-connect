export function show(id){
  const target=document.getElementById(id);
  if(!target)return;
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("active",s.id===id));
  document.querySelectorAll(".bottom [data-screen]").forEach(b=>b.classList.toggle("active",b.dataset.screen===id));
  const nav=document.querySelector(".bottom"),header=document.getElementById("mainHeader");
  if(nav)nav.style.display=id==="auth"?"none":"grid";
  if(header)header.style.display=id==="auth"?"none":"flex";
  document.body.style.paddingBottom=id==="auth"?"0":"92px";
  window.scrollTo(0,0);
}
export function initNavigation(){
  document.addEventListener("click",event=>{
    const button=event.target.closest("[data-screen]");
    if(!button)return;
    event.preventDefault();
    show(button.dataset.screen);
  });
}