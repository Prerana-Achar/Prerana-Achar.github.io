(function(root){
'use strict';
function readerEndpoints(location=root.location){
 const ownReader=['localhost','127.0.0.1'].includes(location?.hostname)&&location?.port==='18765',base=ownReader?'':'http://127.0.0.1:18765';
 return {health:base+'/api/health',recognize:base+'/api/recognize'};
}
async function readerStatus({signal,fetchImpl=globalThis.fetch,location=root.location}={}){
 const controller=new AbortController(),cancel=()=>controller.abort(),timer=setTimeout(cancel,5000);signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
 try{
  const response=await fetchImpl(readerEndpoints(location).health,{signal:controller.signal,credentials:'omit',cache:'no-store'});
  let status;try{status=await response.json()}catch{throw Error('The program on the PDF reader port is not Cadence. Close the other program or use the reader setup guide.')}
  if(!response.ok||status.engine!=='homr')throw Error(status.error||'The PDF reader is not responding correctly. Restart it using Start PDF Reader.cmd.');
  if(status.apiVersion!==1)throw Error('An older PDF reader is running. Close its window, then double-click the updated Start PDF Reader.cmd.');
  if(!status.installed)throw Error('The PDF reader dependencies are missing. Double-click Start PDF Reader.cmd to finish setup.');
  return status;
 }catch(error){if(signal?.aborted)throw Object.assign(Error('PDF import canceled'),{name:'AbortError'});if(error.name==='AbortError'||error instanceof TypeError)throw Error('The local PDF reader is not running or your browser blocked the connection. Double-click Start PDF Reader.cmd and keep its window open. If necessary, allow local-network access or use http://127.0.0.1:18765/.');throw error}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel)}
}
async function recognizePdf(file,{signal,fetchImpl=globalThis.fetch,location=root.location}={}){
 if(file.size>20*1024*1024)throw Error('Choose a PDF smaller than 20 MB.');
 await readerStatus({signal,fetchImpl,location});
 let response;
 try{response=await fetchImpl(readerEndpoints(location).recognize,{method:'POST',headers:{'Content-Type':'application/pdf'},body:file,signal,credentials:'omit',cache:'no-store'})}
 catch(error){if(error.name==='AbortError')throw error;throw Error('The connection to the PDF reader was interrupted. Keep its window open, then try again.')}
 if(!response.ok){let message='The PDF reader could not recognize this score.';try{message=(await response.json()).error||message}catch{}throw Error(message)}
 const bytes=await response.arrayBuffer(),header=new Uint8Array(bytes,0,Math.min(4,bytes.byteLength));
 if(bytes.byteLength>5*1024*1024||String.fromCharCode(...header)!=='MThd')throw Error('The PDF reader did not return a valid recognized score.');
 return bytes;
}
const api={readerEndpoints,readerStatus,recognizePdf};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CadencePdf=api;
})(typeof window!=='undefined'?window:globalThis);
