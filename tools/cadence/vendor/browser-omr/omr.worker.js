// Cadence adapter for Sheetscan's homr/Pyodide bridge (AGPL-3.0).
import * as networks from './ort.js';
const PYODIDE='https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const ASSETS='https://dsalex1.github.io/sheetscan/';
const post=(type,data={})=>self.postMessage({type,...data});
const read=async path=>{const url=new URL(path,import.meta.url);url.search='v=20261125-3';const response=await fetch(url);if(!response.ok)throw Error('Could not load '+path);return response.text()};
self.onmessage=async({data})=>{
 try{
  post('status',{text:'Loading recognition engine and models (about 150 MB on first use)…'});
  const bridge=networks.load(ASSETS,(done,total)=>post('status',{text:'Downloading recognition models…',done,total}));
  bridge.catch(()=>{});
  const {loadPyodide}=await import(PYODIDE+'pyodide.mjs');
  const py=await loadPyodide({indexURL:PYODIDE,stderr:()=>{}});
  post('status',{text:'Loading image libraries…'});
  await py.loadPackage(['numpy','opencv-python','pillow','typing-extensions']);
  py.unpackArchive(await networks.cached(ASSETS+'homr.zip'),'zip',{extractDir:'/lib/python3.14/site-packages'});
  for(const name of ['ort_shim','pipeline','midi'])py.FS.writeFile('/lib/python3.14/site-packages/'+(name==='ort_shim'?'onnxruntime':name)+'.py',await read('py/'+name+'.py'));
  await bridge;
  Object.assign(self,{ortNames:networks.names,ortRun:networks.run});
  py.FS.mkdirTree('/work');
  const paths=data.pages.map((bytes,i)=>{const path=`/work/p${i+1}.png`;py.FS.writeFile(path,new Uint8Array(bytes));return path});
  const scan=py.runPython('import pipeline; pipeline.scan');
  const xml=await scan.callPromising(py.toPy(paths),(done,total)=>post('status',{text:done===total?'Combining recognized pages…':`Reading page ${done+1} of ${total}…`,stage:'read',done,total}));
  post('status',{text:'Preparing your practice score…',stage:'finish'});
  py.globals.set('recognized_xml',xml);
  const result=py.runPython('from midi import convert; convert(recognized_xml)');
  const midi=new Uint8Array(typeof result.toJs==='function'?result.toJs():result);
  result.destroy?.();
  self.postMessage({type:'result',midi:midi.buffer,xml},[midi.buffer]);
 }catch(error){post('error',{text:String(error?.message??error).slice(-4000)})}
};
