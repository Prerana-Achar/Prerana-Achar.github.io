(function(root){
'use strict';
const presets={piano:'acoustic_grand_piano',guitar:'acoustic_guitar_nylon',violin:'violin',flute:'flute'};
// Bundled samples are served from the same GitHub Pages site as Cadence.
const sampleRoot=new URL('vendor/soundfonts/FluidR3_GM/',document.currentScript.src).href;
const sampleName=m=>['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][m%12]+(Math.floor(m/12)-1);
class InstrumentAudio{
 constructor(context){this.context=context;this.samples=new Map();this.voices=new Set();this.request=0}
 async sample(key,midi,signal){
  const id=key+':'+midi,cached=this.samples.get(id);
  if(cached?.signal?.aborted&&!cached.loaded)this.samples.delete(id);
  if(!this.samples.has(id)){
   const task=(async()=>{
    signal.throwIfAborted();
    const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,8000);
    signal.addEventListener('abort',abort,{once:true});
    try{
     const response=await fetch(sampleRoot+presets[key]+'-mp3/'+sampleName(midi)+'.mp3',{signal:controller.signal});
     if(!response.ok)throw Error('Sample download returned HTTP '+response.status);
     const bytes=await response.arrayBuffer(),buffer=await this.context.decodeAudioData(bytes);
     signal.throwIfAborted();return {buffer,midi};
    }finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}
   })();
   task.signal=signal;this.samples.set(id,task);task.then(()=>{task.loaded=true},()=>{if(this.samples.get(id)===task)this.samples.delete(id)});
  }
  return this.samples.get(id);
 }
 async prepare(key,notes){
  if(!presets[key])throw Error('Unsupported instrument');
  this.loadingController?.abort();this.ready=null;const request=++this.request;
  const controller=new AbortController();this.loadingController=controller;
  const timer=setTimeout(()=>controller.abort(),20000),buffers=new Map();
  const pitches=[...new Set(notes)];let cursor=0;
  const worker=async()=>{
   while(cursor<pitches.length&&!controller.signal.aborted){
    const midi=pitches[cursor++],sampleMidi=Math.max(21,Math.min(108,midi));
    try{
     const sample=await this.sample(key,sampleMidi,controller.signal);
     buffers.set(midi,{buffer:sample.buffer,rate:2**((midi-sampleMidi)/12)});
    }catch{}
   }
  };
  try{await Promise.all(Array.from({length:Math.min(4,pitches.length)},worker))}finally{clearTimeout(timer);if(this.loadingController===controller)this.loadingController=null}
  if(request!==this.request)throw new DOMException('Sample loading canceled','AbortError');
  const unavailable=pitches.length-buffers.size;
  if(unavailable){
   const error=new Error('Could not load '+unavailable+' instrument sample'+(unavailable===1?'':'s')+'. Check your connection and try again.');
   error.name='InstrumentAudioError';throw error;
  }
  this.ready={key,buffers};return true;
 }
 play(key,midi,when,length=.45,volume=.18){
  const sample=this.ready?.key===key&&this.ready.buffers.get(midi);
  if(!sample)throw Error('Instrument sample is not ready');
  const ac=this.context,gain=ac.createGain(),source=ac.createBufferSource(),nodes=[source];
  when=Math.max(ac.currentTime,when);length=Math.max(.04,length);
  source.buffer=sample.buffer;source.playbackRate.value=sample.rate;source.connect(gain);
  const plucked=['piano','guitar'].includes(key),attack=plucked?.008:.035,release=.12,end=when+length+release;
  gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume,when+Math.min(attack,length/2));
  if(plucked)gain.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.25),when+length);
  else gain.gain.setValueAtTime(volume,when+length);
  gain.gain.linearRampToValueAtTime(0,end);gain.connect(ac.destination);
  const voice={nodes,gain};this.voices.add(voice);
  nodes[0].onended=()=>{nodes.forEach(n=>n.disconnect());gain.disconnect();this.voices.delete(voice)};
  nodes.forEach(n=>{n.start(when);n.stop(end)});return end;
 }
 stop(){this.loadingController?.abort();this.loadingController=null;this.request++;for(const voice of this.voices){for(const node of voice.nodes){try{node.stop();node.disconnect()}catch{}}voice.gain.disconnect()}this.voices.clear()}
}
root.CadenceAudio=InstrumentAudio;
})(typeof window!=='undefined'?window:globalThis);