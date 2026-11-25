(function(root){
'use strict';
const programs=('Acoustic Grand Piano|Bright Piano|Electric Grand Piano|Honky-tonk Piano|Electric Piano 1|Electric Piano 2|Harpsichord|Clavinet|Celesta|Glockenspiel|Music Box|Vibraphone|Marimba|Xylophone|Tubular Bells|Dulcimer|Drawbar Organ|Percussive Organ|Rock Organ|Church Organ|Reed Organ|Accordion|Harmonica|Tango Accordion|Nylon Guitar|Steel Guitar|Jazz Guitar|Clean Guitar|Muted Guitar|Overdriven Guitar|Distortion Guitar|Guitar Harmonics|Acoustic Bass|Finger Bass|Pick Bass|Fretless Bass|Slap Bass 1|Slap Bass 2|Synth Bass 1|Synth Bass 2|Violin|Viola|Cello|Contrabass|Tremolo Strings|Pizzicato Strings|Orchestral Harp|Timpani|String Ensemble 1|String Ensemble 2|Synth Strings 1|Synth Strings 2|Choir Aahs|Voice Oohs|Synth Voice|Orchestra Hit|Trumpet|Trombone|Tuba|Muted Trumpet|French Horn|Brass Section|Synth Brass 1|Synth Brass 2|Soprano Sax|Alto Sax|Tenor Sax|Baritone Sax|Oboe|English Horn|Bassoon|Clarinet|Piccolo|Flute|Recorder|Pan Flute|Blown Bottle|Shakuhachi|Whistle|Ocarina|Square Lead|Saw Lead|Calliope Lead|Chiff Lead|Charang Lead|Voice Lead|Fifths Lead|Bass + Lead|New Age Pad|Warm Pad|Polysynth Pad|Choir Pad|Bowed Pad|Metallic Pad|Halo Pad|Sweep Pad|Rain|Soundtrack|Crystal|Atmosphere|Brightness|Goblins|Echoes|Sci-fi|Sitar|Banjo|Shamisen|Koto|Kalimba|Bagpipe|Fiddle|Shanai|Tinkle Bell|Agogo|Steel Drums|Woodblock|Taiko|Melodic Tom|Synth Drum|Reverse Cymbal|Fret Noise|Breath Noise|Seashore|Bird Tweet|Telephone|Helicopter|Applause|Gunshot').split('|');
const instruments={
 piano:{name:'Piano / keyboard',clef:'treble',transpose:0,min:27.5,max:2000},
 guitar:{name:'Guitar',clef:'treble',transpose:12,min:65,max:1600},
 violin:{name:'Violin',clef:'treble',transpose:0,min:180,max:2400},
 cello:{name:'Cello',clef:'bass',transpose:0,min:55,max:1400},
 flute:{name:'Flute',clef:'treble',transpose:0,min:220,max:2400},
 clarinet:{name:'B♭ clarinet',clef:'treble',transpose:2,min:130,max:2000},
 trumpet:{name:'B♭ trumpet',clef:'treble',transpose:2,min:110,max:1600},
 alto:{name:'E♭ alto saxophone',clef:'treble',transpose:9,min:130,max:1400},
 bass:{name:'Bass guitar',clef:'bass',transpose:12,min:27.5,max:800},
 voice:{name:'Voice / other concert-pitch instrument',clef:'treble',transpose:0,min:55,max:2000}
};
const noteName=m=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((m%12)+12)%12]+(Math.floor(m/12)-1);
function parseMidi(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 let p=0;const ensure=n=>{if(p+n>bytes.length)throw Error('This MIDI file is incomplete or damaged.');};
 const u8=()=>{ensure(1);return bytes[p++]},u16=()=>u8()*256+u8(),u32=()=>u8()*16777216+u8()*65536+u8()*256+u8();
 const ascii=n=>{ensure(n);let s='';while(n--)s+=String.fromCharCode(bytes[p++]);return s};
 const vlq=()=>{let n=0;for(let i=0;i<4;i++){const v=u8();n=n*128+(v&127);if(!(v&128))return n;}throw Error('Invalid MIDI event length.');};
 if(ascii(4)!=='MThd')throw Error('Choose a Standard MIDI file (.mid or .midi).');
 const header=u32();if(header<6)throw Error('Invalid MIDI header.');
 const format=u16(),trackCount=u16(),ppq=u16();
 if(format>1)throw Error('MIDI format 2 has independent timelines. Export the file as MIDI format 0 or 1.');
 if(ppq&32768)throw Error('This file uses SMPTE timing. Export it with beat-based (PPQ) timing.');
 if(!ppq||trackCount<1||trackCount>256)throw Error('Invalid or unsupported MIDI header.');
 ensure(header-6);p+=header-6;
 const tempos=[],meters=[],parts=[],warnings=[];let totalNotes=0,lastTick=0;
 for(let ti=0;ti<trackCount;ti++){
  if(ascii(4)!=='MTrk')throw Error('A MIDI track header is missing.');
  const length=u32(),end=p+length;ensure(length);
  let tick=0,running=0,name='',count=0;const program=new Array(16).fill(0),groups=new Map(),active=new Map();
  const groupFor=(channel,pr)=>{const key=channel+'-'+pr;if(!groups.has(key))groups.set(key,{id:`t${ti}-c${channel}-p${pr}`,track:ti,channel,program:pr,notes:[]});return groups.get(key)};
  const finish=(channel,midi)=>{const key=channel+'-'+midi,queue=active.get(key);if(!queue?.length)return;const n=queue.shift();n.endTick=Math.max(n.tick+1,tick);if(n.velocity>0){n.part.notes.push(n);totalNotes++;}if(!queue.length)active.delete(key)};
  while(p<end){
   if(++count>1000000)throw Error('This MIDI file has too many events.');
   tick+=vlq();lastTick=Math.max(lastTick,tick);let status=u8();
   if(status<128){if(!running)throw Error('Invalid MIDI running status.');p--;status=running;}
   else if(status<240)running=status;
   if(status===255){const type=u8(),size=vlq();ensure(size);if(p+size>end)throw Error('Invalid MIDI meta event.');
    const data=bytes.subarray(p,p+size);p+=size;
    if(type===3)name=new TextDecoder().decode(data).replace(/[\x00-\x1f]/g,'').slice(0,100);
    if(type===81&&size===3){const us=data[0]*65536+data[1]*256+data[2];if(us>0)tempos.push({tick,us});}
    if(type===88&&size>=2){const n=data[0],d=2**data[1];if(n>0&&n<=32&&d<=32)meters.push({tick,n,d});}
    if(type===47)break;
   }else if(status===240||status===247){const size=vlq();ensure(size);if(p+size>end)throw Error('Invalid system-exclusive event.');p+=size;running=0;}
   else if(status<240){const kind=status>>4,channel=status&15,a=u8();let b=0;if(kind!==12&&kind!==13)b=u8();if(a>127||b>127)throw Error('Invalid MIDI channel event.');
    if(kind===12)program[channel]=a;
    if(kind===9&&b>0){const part=groupFor(channel,program[channel]),key=channel+'-'+a;if(!active.has(key))active.set(key,[]);active.get(key).push({tick,midi:a,velocity:b/127,part});}
    if(kind===8||(kind===9&&b===0))finish(channel,a);
   }else throw Error('Unsupported MIDI system event.');
   if(p>end)throw Error('A MIDI event extends beyond its track.');
  }
  if(active.size){warnings.push('Some held notes had no release event; their ends were estimated.');for(const queue of active.values())for(const n of queue){n.endTick=Math.max(n.tick+ppq/4,tick);n.part.notes.push(n);totalNotes++;}}
  for(const part of groups.values())if(part.notes.length){part.name=name||`Track ${ti+1}`;part.instrument=part.channel===9?'Drums':programs[part.program];part.percussion=part.channel===9;for(const n of part.notes)delete n.part;part.notes.sort((a,b)=>a.tick-b.tick||a.midi-b.midi);parts.push(part);}
  p=end;
 }
 if(totalNotes>30000)throw Error('This file has over 30,000 notes. Export a shorter excerpt.');
 if(!parts.length)throw Error('This MIDI file contains no playable notes.');
 function unique(events,initial){const map=new Map([[0,initial]]);events.forEach(e=>map.set(e.tick,e));return [...map.values()].sort((a,b)=>a.tick-b.tick)}
 const tempoMap=unique(tempos,{tick:0,us:500000});let seconds=0;tempoMap.forEach((t,i)=>{if(i)seconds+=(t.tick-tempoMap[i-1].tick)*tempoMap[i-1].us/ppq/1e6;t.seconds=seconds});
 const tickToSeconds=t=>{let item=tempoMap[0];for(const next of tempoMap){if(next.tick>t)break;item=next}return item.seconds+(t-item.tick)*item.us/ppq/1e6};
 const secondsToTick=s=>{let item=tempoMap[0];for(const next of tempoMap){if(next.seconds>s)break;item=next}return item.tick+(s-item.seconds)*ppq*1e6/item.us};
 for(const part of parts)part.notes.forEach((n,i)=>{n.id=part.id+'-n'+i;n.time=tickToSeconds(n.tick);n.end=tickToSeconds(n.endTick)});
 const meterMap=unique(meters,{tick:0,n:4,d:4}),endTick=Math.max(lastTick,...parts.flatMap(t=>t.notes.map(n=>n.endTick)));
 const bars=[];let at=0,mi=0;
 while(at<endTick&&bars.length<4096){while(mi+1<meterMap.length&&meterMap[mi+1].tick<=at)mi++;const m=meterMap[mi],next=meterMap[mi+1]?.tick??Infinity,end=Math.min(at+ppq*4*m.n/m.d,next);bars.push({index:bars.length,start:at,end,n:m.n,d:m.d,time:tickToSeconds(at)});at=end;}
 if(at<endTick)throw Error('This score is too long. Export a shorter excerpt.');
 return {format,ppq,parts,tempoMap,meterMap,bars,endTick,duration:tickToSeconds(endTick),tickToSeconds,secondsToTick,warnings:[...new Set(warnings)]};
}
function practiceLine(part,direction='top'){
 const groups=new Map();for(const n of part.notes){if(!groups.has(n.tick))groups.set(n.tick,[]);groups.get(n.tick).push(n)}
 const notes=[...groups.values()].map(g=>({...g.reduce((a,b)=>direction==='bottom'?(a.midi<b.midi?a:b):(a.midi>b.midi?a:b))}));
 notes.forEach((n,i)=>{const next=notes[i+1];if(next&&n.endTick>next.tick){n.endTick=next.tick;n.end=next.time}});
 return {notes,chords:[...groups.values()].filter(g=>g.length>1).length};
}
function makeNotation(song,notes,barStart=0,barCount=4,instrument=instruments.piano){
 const bars=song.bars.slice(barStart,barStart+barCount);if(!bars.length)return {abc:'X:1\nL:1/16\nK:C\nz16 |]',map:[]};
 let abc='X:1\nM:'+bars[0].n+'/'+bars[0].d+'\nL:1/16\nK:C clef='+instrument.clef+'\n',map=[];
 const accidentals=new Map();
 const pitch=m=>{const names=['C','^C','D','^D','E','F','^F','G','^G','A','^A','B'],name=names[((m%12)+12)%12],sharp=name.startsWith('^'),letter=name.at(-1),oct=Math.floor(m/12)-1,key=letter+oct,wasSharp=accidentals.get(key)||false;let text=(sharp&&!wasSharp?'^':!sharp&&wasSharp?'=':'')+letter;accidentals.set(key,sharp);if(oct>=5)text=text.toLowerCase()+"'".repeat(oct-5);else text+=','.repeat(Math.max(0,4-oct));return text};
 bars.forEach((bar,bi)=>{
  accidentals.clear();
  if(bi&&(bar.n!==bars[bi-1].n||bar.d!==bars[bi-1].d))abc+='[M:'+bar.n+'/'+bar.d+'] ';
  const units=Math.max(1,Math.round((bar.end-bar.start)/song.ppq*4)),compound=bar.d===8&&bar.n%3===0&&bar.n>3;
  const beatUnits=16/bar.d*(compound?3:1);
  const groupAt=unit=>bar.d===8&&[5,7].includes(bar.n)?(unit<(bar.n-3)*2?Math.floor(unit/4):(bar.n-3)/2):Math.floor(unit/beatUnits);
  let cursor=0,previous=null;
  // Decompose irregular MIDI durations into readable notes and ties. Keep
  // off-beat notes and rests from hiding the next beat; do not alter grading.
  const write=(start,end,n)=>{
   if(!n&&start===0&&end===units&&units===bar.n*16/bar.d){abc+='Z ';previous=null;return}
   for(let at=start;at<end;){
    const remaining=end-at,boundary=(Math.floor(at/beatUnits)+1)*beatUnits;
    const limit=!n||at%beatUnits!==0?Math.min(remaining,boundary-at):remaining;
    const length=[16,12,8,6,4,3,2,1].find(d=>d<=limit&&(at%(2**Math.floor(Math.log2(d)))===0||(compound&&at%beatUnits===0&&d===beatUnits)))||1;
    const next=at+length,group=groupAt(at),short=!!n&&length<4&&group===groupAt(next-1);
    if(previous?.short&&short&&previous.end===at&&previous.group===group)abc=abc.slice(0,-1);
    if(n)map.push({id:n.id,char:abc.length,bar:bar.index});
    abc+=(n?pitch(n.midi+instrument.transpose):'z')+(length===1?'':length)+(n&&(next<end||n.endTick>bar.end)?'-':'')+' ';
    previous={end:next,group,short};at=next;
   }
  };
  for(const n of notes.filter(n=>n.tick<bar.end&&n.endTick>bar.start)){
   const start=Math.max(cursor,Math.round((Math.max(bar.start,n.tick)-bar.start)/song.ppq*4));if(start>=units)continue;
   if(start>cursor)write(cursor,start,null);
   const end=Math.min(units,Math.max(start+1,Math.round((Math.min(bar.end,n.endTick)-bar.start)/song.ppq*4)));
   write(start,end,n);cursor=end;
  }
  if(cursor<units)write(cursor,units,null);abc+=(bi===bars.length-1?'|]':'| ');
 });return {abc,map};
}
function detectPitch(input,sampleRate,{min=55,max=2000,gate=.008}={}){
 let rms=0;for(const v of input)rms+=v*v;rms=Math.sqrt(rms/input.length);if(rms<gate)return {frequency:null,rms,confidence:0};
 const step=sampleRate>32000?2:1,n=Math.floor(input.length/step),x=new Float32Array(n);let mean=0;
 for(let i=0;i<n;i++){x[i]=step===2?(input[i*2]+input[i*2+1])/2:input[i];mean+=x[i]}mean/=n;for(let i=0;i<n;i++)x[i]-=mean;
 const rate=sampleRate/step,window=Math.floor(n/2),low=Math.max(2,Math.floor(rate/max)),high=Math.min(window-2,Math.ceil(rate/min)),d=new Float64Array(high+2);let sum=0;d[0]=1;
 for(let tau=1;tau<=high+1;tau++){let diff=0;for(let i=0;i<window;i++){const delta=x[i]-x[i+tau];diff+=delta*delta}sum+=diff;d[tau]=sum?diff*tau/sum:1}
 let best=-1;for(let tau=low;tau<=high;tau++)if(d[tau]<.15){while(tau<high&&d[tau+1]<d[tau])tau++;best=tau;break}
 if(best<0){best=low;for(let t=low+1;t<=high;t++)if(d[t]<d[best])best=t;if(d[best]>.2)return {frequency:null,rms,confidence:0}}
 const a=d[best-1],b=d[best],c=d[best+1],den=a-2*b+c,offset=den?(a-c)/(2*den):0,frequency=rate/(best+Math.max(-1,Math.min(1,offset))),midiFloat=69+12*Math.log2(frequency/440),midi=Math.round(midiFloat);
 return {frequency,midi,cents:(midiFloat-midi)*100,rms,confidence:1-b};
}
class AttackTracker{
 constructor(){this.reset()}
 reset(){this.lastMidi=null;this.candidate=null;this.frames=0;this.firstTime=0;this.silentSince=null;this.lastAttack=-Infinity;this.peak=0;this.valley=Infinity;this.released=true;this.rearmed=false}
 observe(pitch,time){
  if(!pitch.frequency||pitch.confidence<.8){if(this.silentSince===null)this.silentSince=time;if(time-this.silentSince>.07){this.released=true;this.lastMidi=null;this.peak=0;this.valley=Infinity;}this.candidate=null;this.frames=0;return null;}
  this.silentSince=null;this.peak=Math.max(this.peak*.998,pitch.rms);this.valley=Math.min(this.valley,pitch.rms);
  if(pitch.rms<this.peak*.45)this.rearmed=true;
  if(this.candidate!==pitch.midi){this.candidate=pitch.midi;this.frames=1;this.firstTime=time}else this.frames++;
  const retrigger=this.rearmed&&pitch.rms>this.valley*1.9&&pitch.rms>this.peak*.6;
  if(this.frames>=2&&time-this.lastAttack>.11&&(this.released||pitch.midi!==this.lastMidi||retrigger)){
   const at=this.released||pitch.midi!==this.lastMidi?this.firstTime:time;this.lastAttack=at;this.lastMidi=pitch.midi;this.released=false;this.rearmed=false;this.peak=pitch.rms;this.valley=pitch.rms;
   return {...pitch,time:at};
  }return null;
 }
}
class TempoEstimator{
 constructor({min=.2,max=2.5}={}){this.min=min;this.max=max;this.samples=[];this.previous=null;this.skipNext=false}
 ignoreInterval(){this.skipNext=true}
 observe(scoreTime,playedTime){const previous=this.previous;this.previous={scoreTime,playedTime};if(previous&&!this.skipNext){const written=scoreTime-previous.scoreTime,played=playedTime-previous.playedTime,ratio=written/played;if(written>0&&played>=.08&&ratio>=this.min&&ratio<=this.max)this.samples.push(ratio)}this.skipNext=false;return this.ratio}
 get ratio(){if(!this.samples.length)return null;const values=[...this.samples].sort((a,b)=>a-b),middle=Math.floor(values.length/2);return values.length%2?values[middle]:(values[middle-1]+values[middle])/2}
}
class Judge{
 constructor(notes,{timing=.12,cents=45}={}){this.notes=notes;this.timing=timing;this.cents=cents;this.window=Math.max(.25,Math.min(.6,timing*3));this.results=new Map();this.extras=[]}
 ingest(event){let closest=null,distance=Infinity;for(const n of this.notes){if(this.results.has(n.id))continue;const diff=Math.abs(n.time-event.time);if(diff<=this.window&&diff<distance){distance=diff;closest=n}}
  if(!closest){this.extras.push(event);return {extra:true,event}}
  const offset=event.time-closest.time,pitchOK=event.midi===closest.midi&&Math.abs(event.cents||0)<=this.cents,timingOK=Math.abs(offset)<=this.timing;
  const reasons=[];if(!pitchOK)reasons.push(event.midi===closest.midi?'Out of tune':'Wrong pitch');if(!timingOK)reasons.push(offset<0?'Early':'Late');
  const result={id:closest.id,status:pitchOK&&timingOK?'correct':'wrong',reasons,expected:closest.midi,heard:event.midi,offset,cents:event.cents||0};this.results.set(closest.id,result);return result;
 }
 advance(time){const missed=[];for(const n of this.notes)if(!this.results.has(n.id)&&time>n.time+this.window){const r={id:n.id,status:'missed',reasons:['Missed'],expected:n.midi,offset:null};this.results.set(n.id,r);missed.push(r)}return missed;}
 summary(){const items=[...this.results.values()],correct=items.filter(r=>r.status==='correct').length;return {correct,wrong:items.filter(r=>r.status==='wrong').length,missed:items.filter(r=>r.status==='missed').length,judged:items.length,total:this.notes.length,extras:this.extras.length,accuracy:items.length?Math.round(correct/items.length*100):null}}
}
class WaitJudge{
 constructor(notes,{cents=45}={}){this.notes=notes;this.cents=cents;this.index=0;this.waitForCorrect=true;this.results=new Map();this.extras=[];this.attempts=0;this.wrongAttempts=0;this.window=0}
 get current(){return this.notes[this.index]||null}
 ingest(event){const note=this.current;if(!note)return {ignored:true};const previous=this.results.get(note.id),correct=event.midi===note.midi&&Math.abs(event.cents||0)<=this.cents;this.attempts++;if(!correct)this.wrongAttempts++;
  const result={id:note.id,status:correct?'correct':'wrong',reasons:correct?[]:[event.midi===note.midi?'Out of tune':'Wrong pitch'],expected:note.midi,heard:event.midi,cents:event.cents||0,offset:null,waitForCorrect:true,attempts:(previous?.attempts||0)+1};
  this.results.set(note.id,result);if(correct)this.index++;return result;
 }
 advance(){return []}
 summary(){return {correct:this.index,wrong:this.wrongAttempts,missed:0,judged:this.results.size,total:this.notes.length,extras:0,accuracy:this.attempts?Math.round(this.index/this.attempts*100):null}}
}
function demoMidi(){
 const vlq=value=>{let n=Math.round(value),a=[n&127];while(n>>=7)a.unshift((n&127)|128);return a},u32=n=>[(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255],str=s=>[...s].map(c=>c.charCodeAt(0));
 const track=events=>{events.sort((a,b)=>a.tick-b.tick||a.order-b.order);let last=0,out=[];for(const e of events){out.push(...vlq(e.tick-last),...e.bytes);last=e.tick}out.push(0,255,47,0);return [...str('MTrk'),...u32(out.length),...out]};
 const melody=[64,64,65,67,67,65,64,62,60,60,62,64,64,62,62,null,64,64,65,67,67,65,64,62,60,60,62,64,62,60,60,null],lead=[{tick:0,order:-2,bytes:[255,3,6,...str('Melody')]},{tick:0,order:-1,bytes:[192,0]}],bass=[{tick:0,order:-2,bytes:[255,3,4,...str('Bass')]},{tick:0,order:-1,bytes:[193,32]}];
 melody.forEach((m,i)=>{if(m===null)return;const duration=(i===14||i===30)?900:420;lead.push({tick:i*480,order:1,bytes:[144,m,100]},{tick:i*480+duration,order:0,bytes:[128,m,0]})});
 for(let i=0;i<8;i++){const m=i%2?43:48;bass.push({tick:i*1920,order:1,bytes:[145,m,76]},{tick:i*1920+1800,order:0,bytes:[129,m,0]})}
 const conductor=track([{tick:0,order:0,bytes:[255,81,3,9,39,192]},{tick:0,order:1,bytes:[255,88,4,4,2,24,8]}]);
 return new Uint8Array([...str('MThd'),0,0,0,6,0,1,0,3,1,224,...conductor,...track(lead),...track(bass)]);
}
const api={parseMidi,practiceLine,makeNotation,detectPitch,AttackTracker,TempoEstimator,Judge,WaitJudge,noteName,programs,instruments,demoMidi};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CadenceMusic=api;
})(typeof window!=='undefined'?window:globalThis);
