(function(root){
'use strict';
const tuning={guitar:[40,45,50,55,59,64],bass:[28,33,38,43],violin:[55,62,69,76],cello:[36,43,50,57]};
const name=m=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((m%12)+12)%12]+(Math.floor(m/12)-1);
const svg=(content,label)=>`<svg viewBox="0 0 720 230" role="img" aria-label="${label}">${content}</svg>`;
function stringPosition(key,midi){
 return (tuning[key]||[]).map((open,string)=>({string,open,fret:midi-open})).filter(p=>p.fret>=0&&p.fret<=24).sort((a,b)=>a.fret-b.fret||b.string-a.string)[0]||null;
}
function keyboard(midi){
 const start=Math.max(12,Math.min(96,Math.floor(midi/12)*12-12)),white=[],black=[];
 let count=0;
 for(let n=start;n<start+36;n++){
  if([1,3,6,8,10].includes(n%12))black.push({midi:n,x:count*32+24});
  else{white.push({midi:n,x:count*32+36});count++}
 }
 const key=(k,dark)=>`<rect class="${dark?'piano-black':'piano-white'} ${k.midi===midi?'target-key':''}" x="${k.x}" y="26" width="${dark?21:31}" height="${dark?104:170}" rx="4"/>${!dark&&k.midi%12===0?`<text x="${k.x+15}" y="180" class="key-label">${name(k.midi)}</text>`:''}`;
 return {markup:svg(white.map(k=>key(k,false)).join('')+black.map(k=>key(k,true)).join(''),'Keyboard; highlighted key '+name(midi)),detail:'Play the highlighted key'};
}
function strings(key,midi){
 const position=stringPosition(key,midi),open=tuning[key],fretted=key==='guitar'||key==='bass',first=position&&position.fret>12?13:1,last=first+11,x=f=>90+(f-first+1)*48;
 let drawing='<rect class="fingerboard" x="64" y="32" width="620" height="156" rx="12"/>';
 for(let fret=first;fret<=last;fret++)drawing+=`<path class="${fretted?'fret':'position-guide'}" d="M${x(fret)} 34V186"/><text class="diagram-label" x="${x(fret)-24}" y="215">${fret}</text>`;
 open.forEach((pitch,i)=>{const y=52+(open.length-1-i)*23;drawing+=`<path class="instrument-string" d="M66 ${y}H682"/><text class="diagram-label" x="30" y="${y+5}">${name(pitch)}</text>`;if(position?.string===i)drawing+=`<circle class="target-position" cx="${position.fret===0?76:x(position.fret)-24}" cy="${y}" r="11"/>`});
 const detail=position?(position.fret===0?'Open '+name(position.open)+' string':name(position.open)+' string · '+(fretted?'fret ':'semitone +')+position.fret):'Outside the displayed standard-tuning range';
 return {markup:svg(drawing,detail),detail:detail+(fretted?'':' · semitone guides')};
}
function pitchGuide(key,written){
 // Wind/brass illustrations are pitch guides, not unverified fingering charts.
 let body='';
 if(key==='flute')body='<rect class="instrument-body" x="85" y="100" width="550" height="28" rx="14"/>'+[180,230,280,330,380,430].map(x=>`<circle class="instrument-detail" cx="${x}" cy="114" r="9"/>`).join('');
 else if(key==='clarinet')body='<path class="instrument-body" d="M105 101H555L615 74V154L555 127H105Z"/>'+[190,245,300,355,410,465].map(x=>`<circle class="instrument-detail" cx="${x}" cy="114" r="7"/>`).join('');
 else if(key==='trumpet')body='<path class="instrument-body" d="M120 94H485L592 55V171L485 132H240Q180 132 180 169Q180 190 240 190H440V166H248Q220 166 220 157Q220 150 250 150H485V94Z"/>'+[290,335,380].map(x=>`<path class="instrument-detail" d="M${x} 91V65M${x-9} 65H${x+9}"/>`).join('');
 else if(key==='alto')body='<path class="instrument-body" d="M225 50H280L340 158Q370 215 432 170L480 100L525 125L477 193Q387 254 320 185L260 77H225Z"/>'+[290,310,330].map((x,i)=>`<circle class="instrument-detail" cx="${x}" cy="${95+i*30}" r="8"/>`).join('');
 else body='<rect class="instrument-body" x="314" y="56" width="92" height="100" rx="46"/><path class="instrument-detail" d="M292 121V138Q292 185 360 185Q428 185 428 138V121M360 185V213M332 213H388"/>';
 return {markup:svg(body+`<g class="pitch-badge"><rect x="310" y="4" width="100" height="42" rx="21"/><text x="360" y="32">${name(written)}</text></g>`,name(written)+' pitch guide'),detail:key==='voice'?'Target pitch':'Target pitch · fingering not shown'};
}
function diagram(key,midi,transpose=0){return key==='piano'?keyboard(midi):tuning[key]?strings(key,midi):pitchGuide(key,midi+transpose)}
const api={diagram,stringPosition};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CadenceInstrumentView=api;
})(typeof window!=='undefined'?window:globalThis);
