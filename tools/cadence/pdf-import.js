(function(root){
'use strict';
const base = new URL('.', document.currentScript.src);
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/';
function canceled(){return new DOMException('PDF import canceled','AbortError')}
async function recognizePdf(file,{signal,onProgress=()=>{}}={}){
 if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');
 if(signal?.aborted)throw canceled();
 if(typeof WebAssembly.Suspending!=='function')throw Error('PDF recognition needs a current Chrome, Edge or Firefox with WebAssembly JSPI support. Update your browser and try again. MIDI import works in other browsers.');
 let worker,loading,documentPdf,render,pdfCleanup;
 // The loading task owns PDF.js resources. Newer document proxies don't have
 // destroy(). Share cleanup between cancellation, normal completion and finally.
 const releasePdf=()=>{
  if(!pdfCleanup&&loading){
   const task=loading;loading=null;documentPdf=null;
   pdfCleanup=Promise.resolve().then(()=>task.destroy()).catch(()=>{});
  }
  return pdfCleanup||Promise.resolve();
 };
 const abort=()=>{try{render?.cancel()}finally{void releasePdf();worker?.terminate()}};
 signal?.addEventListener('abort',abort,{once:true});
 try{
  onProgress('Loading PDF tools…',{stage:'prepare'});
  const pdfjs=await import(PDFJS+'pdf.min.mjs');
  if(signal?.aborted)throw canceled();
  pdfjs.GlobalWorkerOptions.workerSrc=PDFJS+'pdf.worker.min.mjs';
  const data=await file.arrayBuffer();
  if(signal?.aborted)throw canceled();
  loading=pdfjs.getDocument({data,isEvalSupported:false});
  documentPdf=await loading.promise;
  if(documentPdf.numPages<1||documentPdf.numPages>12)throw Error('Choose a PDF with 1–12 pages, or split a longer score first.');
  const pages=[];
  for(let n=1;n<=documentPdf.numPages;n++){
   if(signal?.aborted)throw canceled();
   onProgress(`Preparing page ${n} of ${documentPdf.numPages}…`,{stage:'prepare',done:n-1,total:documentPdf.numPages});
   const page=await documentPdf.getPage(n),viewport=page.getViewport({scale:200/72});
   if(viewport.width*viewport.height>24000000)throw Error('This PDF page is too large. Export it at a standard page size.');
   const canvas=Object.assign(document.createElement('canvas'),{width:Math.ceil(viewport.width),height:Math.ceil(viewport.height)});
   try{
    render=page.render({canvasContext:canvas.getContext('2d'),canvas,viewport,intent:'print'});
    await render.promise;
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('Your browser could not prepare this PDF page.');
    pages.push(await blob.arrayBuffer());
    onProgress(`Prepared page ${n} of ${documentPdf.numPages}`,{stage:'prepare',done:n,total:documentPdf.numPages});
   }finally{render=null;canvas.width=canvas.height=0;page.cleanup()}
  }
  await releasePdf();
  if(signal?.aborted)throw canceled();
  worker=new Worker(new URL('vendor/browser-omr/omr.worker.js',base),{type:'module'});
  return await new Promise((resolve,reject)=>{
   const stop=()=>reject(canceled());
   signal?.addEventListener('abort',stop,{once:true});
   const finish=(error,bytes)=>{signal?.removeEventListener('abort',stop);error?reject(error):resolve(bytes)};
   worker.onerror=()=>finish(Error('The PDF recognition engine could not load. Check your internet connection, refresh and try again.'));
   worker.onmessage=({data})=>{
    if(data.type==='status')onProgress(data.text+(data.total&&data.text.includes('Downloading')?` ${Math.round(data.done/1048576)} / ${Math.round(data.total/1048576)} MB`:''),{stage:data.stage||(data.text.includes('Downloading')?'download':'load'),done:data.done,total:data.total});
    else if(data.type==='error')finish(Error('PDF recognition failed: '+data.text));
    else if(data.type==='result'){
     const bytes=new Uint8Array(data.midi);
     if(bytes.length>5*1024*1024||String.fromCharCode(...bytes.subarray(0,4))!=='MThd')finish(Error('The PDF reader did not return a valid recognized score.'));
     else finish(null,bytes.buffer);
    }
   };
   worker.postMessage({pages},pages);
  });
 }catch(error){
  if(signal?.aborted)throw canceled();
  if(error.name==='PasswordException')throw Error('This PDF is password-protected. Export an unlocked copy first.');
  throw error;
 }finally{signal?.removeEventListener('abort',abort);worker?.terminate();await releasePdf()}
}
root.CadencePdf={recognizePdf};
})(window);
