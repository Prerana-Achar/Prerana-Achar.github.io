(function(root){
'use strict';
const presets={piano:'acoustic_grand_piano',guitar:'acoustic_guitar_nylon',violin:'violin',flute:'flute'};
const harmonics={piano:[1,.45,.2,.1],guitar:[1,.5,.25,.12,.06],violin:[1,.65,.4,.3,.2,.12],flute:[1,.12,.04]};
const sampleName=m=>['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'][m%12]+(Math.floor(m/12)-1);
class InstrumentAudio{
 constructor(context){this.context=context;this.banks=new Map();this.voices=new Set()}
 async bank(key){
  if(!this.banks.has(key)){
   const task=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{
     const response=await fetch('https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/'+presets[key]+'-mp3.js',{signal:controller.signal});
     if(!response.ok)throw Error('Instrument download failed');
     const text=await response.text(),match=text.match(/MIDI\.Soundfont\.\w+\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
     if(!match)throw Error('Invalid soundfont');
     // Read data only; never execute downloaded JavaScript.
     return {samples:JSON.parse(match[1]),buffers:new Map()};
    }finally{clearTimeout(timer)}
   })();
   this.banks.set(key,task);
   task.catch(()=>{if(this.banks.get(key)===task)this.banks.delete(key)});
  }
  return this.banks.get(key);
 }
 async prepare(key,notes){
  key=presets[key]?key:'piano';const request=this.request=(this.request||0)+1;
  try{
   const bank=await this.bank(key);
   await Promise.all([...new Set(notes)].map(async midi=>{
    if(bank.buffers.has(midi))return;
    const sampleMidi=Math.max(12,Math.min(108,midi)),data=bank.samples[sampleName(sampleMidi)];
    if(typeof data!=='string'||!data.startsWith('data:audio/'))throw Error('Missing instrument sample');
    const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
    const buffer=await this.context.decodeAudioData(bytes.buffer);
    bank.buffers.set(midi,{buffer,rate:2**((midi-sampleMidi)/12)});
   }));
   if(request===this.request)this.ready={key,bank};return true;
  }catch{if(request===this.request)this.ready={key,bank:null};return false}
 }
 play(key,midi,when,length=.45,volume=.18){
  const ac=this.context,gain=ac.createGain(),sample=this.ready?.key===key&&this.ready.bank?.buffers.get(midi),nodes=[];
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
 stop(){for(const voice of this.voices){for(const node of voice.nodes){try{node.stop();node.disconnect()}catch{}}voice.gain.disconnect()}this.voices.clear()}
}
root.CadenceAudio=InstrumentAudio;
})(typeof window!=='undefined'?window:globalThis);
