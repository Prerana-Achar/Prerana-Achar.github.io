(()=>{
'use strict';
// "How it works" opens as a popup on every page. Its text lives once, in
// index.html; other pages copy the dialog from there the first time it opens.
let loading=null;
async function howDialog(){
 let dialog=document.getElementById('how-dialog');
 if(dialog)return dialog;
 loading??=fetch('./',{credentials:'same-origin'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.text()}).then(html=>{
  const source=new DOMParser().parseFromString(html,'text/html').getElementById('how-dialog');
  if(!source)throw Error('How it works content not found');
  const copy=document.importNode(source,true);document.body.append(copy);wire(copy);return copy;
 }).catch(error=>{loading=null;throw error});
 return loading;
}
function wire(dialog){
 if(dialog.dataset.wired)return;dialog.dataset.wired='1';
 dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-close-dialog]'))dialog.close()});
}
for(const button of document.querySelectorAll('.how-link')){
 button.addEventListener('click',async()=>{
  try{const dialog=await howDialog();wire(dialog);if(!dialog.open)dialog.showModal();button.setAttribute('aria-expanded','true');dialog.addEventListener('close',()=>{button.setAttribute('aria-expanded','false');button.focus()},{once:true})}
  catch{window.location.href='./#how-it-works'}
 });
}
// A link to ./#how-it-works opens the popup on load.
if(location.hash==='#how-it-works')document.querySelector('.how-link')?.click();
})();
