(function(root){
'use strict';
const presets={piano:'acoustic_grand_piano',guitar:'acoustic_guitar_nylon',violin:'violin',flute:'flute'};
const harmonics={piano:[1,.45,.2,.1],guitar:[1,.5,.25,.12,.06],violin:[1,.65,.4,.3,.2,.12],flute:[1,.12,.04]};
// Bundled samples are served from the same GitHub Pages site as Cadence.
const sampleRoots=[new URL('vendor/soundfonts/FluidR3_GM/',document.currentScript.src).href];
const sampleName=m=>['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][m%12]+(Math.floor(m/12)-1);
class InstrumentAudio{
 constructor(context){this.context=context;this.samples=new Map();this.voices=new Set();this.request=0}
 async sample(key,midi,signal){
  const id=key+':'+midi,cached=this.samples.get(id);
  if(cached?.signal?.aborted&&!cached.loaded)this.samples.delete(id);
  if(!this.samples.has(id)){
   const task=(async()=>{
    let lastError;
    for(const base of sampleRoots){
     if(signal.aborted)throw Error('Sample loading canceled or timed out');
     const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,8000);
     signal.addEventListener('abort',abort,{once:true});
     try{
      const response=await fetch(base+presets[key]+'-mp3/'+sampleName(midi)+'.mp3',{signal:controller.signal});
      if(!response.ok)throw Error('Sample download returned HTTP '+response.status);
      const bytes=await response.arrayBuffer(),buffer=await this.context.decodeAudioData(bytes);
      return {buffer,midi,rate:1};
     }catch(error){lastError=error.name==='AbortError'?Error('Sample download timed out'):error}
     finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}
    }
    throw lastError||Error('Instrument sample unavailable');
   })();
   task.signal=signal;this.samples.set(id,task);task.then(()=>{task.loaded=true},()=>{if(this.samples.get(id)===task)this.samples.delete(id)});
  }
  return this.samples.get(id);
 }
 async prepare(key,notes){
  key=presets[key]?key:'piano';this.loadingController?.abort();const request=++this.request;
  const controller=new AbortController();this.loadingController=controller;
  const timer=setTimeout(()=>controller.abort(),20000),buffers=new Map(),errors=[],missing=[];
  const pitches=[...new Set(notes)],decoded=new Map();let cursor=0;
  const worker=async()=>{
   while(cursor<pitches.length){
    const midi=pitches[cursor++],sampleMidi=Math.max(21,Math.min(108,midi));
    try{
     const sample=await this.sample(key,sampleMidi,controller.signal);decoded.set(sampleMidi,sample);
     buffers.set(midi,{buffer:sample.buffer,rate:2**((midi-sampleMidi)/12)});
    }catch(error){missing.push(midi);errors.push(error.message)}
   }
  };
  try{await Promise.all(Array.from({length:Math.min(4,pitches.length)},worker))}finally{clearTimeout(timer);if(this.loadingController===controller)this.loadingController=null}
  // A nearby recorded pitch can cover a missing sample without replacing the
  // whole instrument. Notes without a close sample retain the synth fallback.
  let reused=0;
  for(const midi of missing){
   const nearest=[...decoded.values()].sort((a,b)=>Math.abs(a.midi-midi)-Math.abs(b.midi-midi))[0];
   if(nearest&&Math.abs(nearest.midi-midi)<=12){buffers.set(midi,{buffer:nearest.buffer,rate:2**((midi-nearest.midi)/12)});reused++}
  }
  if(request===this.request){
   this.ready={key,buffers};this.loadInfo={sampled:buffers.size,total:pitches.length,fallback:pitches.length-buffers.size,reused,error:errors[0]||''};
  }
  return buffers.size>0||pitches.length===0;
 }
 play(key,midi,when,length=.45,volume=.18){
  const ac=this.context,gain=ac.createGain(),sample=this.ready?.key===key&&this.ready.buffers.get(midi),nodes=[];
  when=Math.max(ac.currentTime,when);length=Math.max(.04,length);
  if(sample){const source=ac.createBufferSource();source.buffer=sample.buffer;source.playbackRate.value=sample.rate;source.connect(gain);nodes.push(source)}
  else{
   const osc=ac.createOscillator(),partial=harmonics[key]||harmonics.piano;
   osc.setPeriodicWave(ac.createPeriodicWave(new Float32Array(partial.length+1),new Float32Array([0,...partial])));
   osc.frequency.value=440*2**((midi-69)/12);osc.connect(gain);nodes.push(osc);volume*=.45;
  }
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