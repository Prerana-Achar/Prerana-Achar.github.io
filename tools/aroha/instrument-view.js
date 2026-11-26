(function(root){
'use strict';
// Original SVG artwork. Fingering references are listed in README.md.
const tuning={guitar:[40,45,50,55,59,64],violin:[55,62,69,76]};
const name=m=>['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][((m%12)+12)%12]+(Math.floor(m/12)-1);
const svg=(body,label)=>`<svg viewBox="0 0 720 230" role="img" aria-label="${label}">${body}</svg>`;
const text=(x,y,label,cls='diagram-label')=>`<text x="${x}" y="${y}" class="${cls}">${label}</text>`;
function stringPosition(key,midi){
 const max=key==='violin'?7:24;
 const position=(tuning[key]||[]).map((open,string)=>({string,open,fret:midi-open})).filter(p=>p.fret>=0&&p.fret<=max).sort((a,b)=>a.fret-b.fret||b.string-a.string)[0];
 if(!position)return null;
 if(key==='violin'){
  const fingers=[0,1,1,2,2,3,3,4],adjustment={1:'low',3:'low',6:'high'};
  return {...position,finger:fingers[position.fret],adjustment:adjustment[position.fret]||''};
 }
 return {...position,finger:position.fret===0?0:1+(position.fret-1)%4,position:position.fret===0?1:1+Math.floor((position.fret-1)/4)*4};
}
function pianoFingerings(notes,hand='right'){
 if(!notes.length)return [];
 const black=m=>[1,3,6,8,10].includes(m%12),direction=hand==='left'?-1:1;
 const keyCost=(m,f)=>black(m)?f===1?3:f===5?1:0:0;
 let costs=Array.from({length:5},(_,i)=>keyCost(notes[0].midi,i+1)+Math.abs(i-(hand==='left'?4:0))*.18),paths=[];
 for(let i=1;i<notes.length;i++){
  const delta=(notes[i].midi-notes[i-1].midi)*direction,distance=Math.abs(delta),row=[],next=[];
  for(let f=1;f<=5;f++){
   let best=Infinity,chosen=0;
   for(let previous=1;previous<=5;previous++){
    const step=f-previous;let cost;
    if(!delta)cost=f===previous?0:8;
    else if(!step)cost=6+distance*.3;
    else if(step*delta>0)cost=Math.abs(distance-Math.abs(step)*2)*.35+Math.max(0,distance-Math.abs(step)*3-2)*2;
    else if((delta>0&&f===1&&[3,4].includes(previous))||(delta<0&&previous===1&&[3,4].includes(f)))cost=1.4+Math.max(0,distance-3);
    else cost=10+distance;
    const total=costs[previous-1]+cost+keyCost(notes[i].midi,f);
    if(total<best){best=total;chosen=previous-1}
   }
   next.push(best);row.push(chosen);
  }
  costs=next;paths.push(row);
 }
 let finger=costs.indexOf(Math.min(...costs));const result=new Array(notes.length);result[notes.length-1]=finger+1;
 for(let i=paths.length-1;i>=0;i--){finger=paths[i][finger];result[i]=finger+1}
 return result;
}
function keyboardModel(midi,options={}){
 const min=Number.isFinite(options.minMidi)?options.minMidi:midi,max=Number.isFinite(options.maxMidi)?options.maxMidi:midi;
 const start=Math.max(0,Math.floor(min/12)*12),end=Math.min(128,Math.max(start+24,(Math.floor(max/12)+1)*12)),keys=[];
 let count=0;
 for(let n=start;n<end;n++){const black=[1,3,6,8,10].includes(n%12);keys.push({midi:n,black,index:count});if(!black)count++}
 const width=640/count;return keys.map(k=>({...k,x:40+k.index*width-(k.black?width*.33:0),width:k.black?width*.66:width-1}));
}
function keyboard(midi,options){
 const keys=keyboardModel(midi,options),target=keys.find(k=>k.midi===midi),finger=options.finger||1;
 const draw=k=>`<rect data-midi="${k.midi}" class="${k.black?'piano-black':'piano-white'} ${k.midi===midi?'target-key':''}" x="${k.x}" y="28" width="${k.width}" height="${k.black?104:164}" rx="4"/>`+(!k.black&&k.midi%12===0?text(k.x+k.width/2,179,name(k.midi),'key-label'):'');
 const marker=target?`<g class="piano-hand-marker" transform="translate(${target.x+target.width/2} ${target.black?90:148})"><circle r="12"/>${text(0,5,finger,'finger-number')}</g>`:'';
 return {markup:svg(`<rect class="instrument-frame" x="28" y="16" width="664" height="188" rx="14"/>`+keys.filter(k=>!k.black).map(draw).join('')+keys.filter(k=>k.black).map(draw).join('')+marker,'Piano key '+name(midi)),detail:(options.hand==='left'?'Left':'Right')+' hand · suggested finger '+finger};
}
const violinX=offset=>offset===0?103:142+490*(1-2**(-offset/12))/(1-2**(-7/12));
function marker(position,x,y){return `<g class="string-marker" transform="translate(${x} ${y})" visibility="${position?'visible':'hidden'}"><circle class="target-position" r="13"/>${text(0,5,position?.finger??'','finger-number')}</g>`}
function violin(midi){
 const position=stringPosition('violin',midi);
 let body='<path class="violin-neck" d="M133 47L662 36V194L133 183Z"/><path class="nut" d="M136 46V184"/>';
 // Four familiar first-position tape guides: 1, high 2, 3 and 4.
 [2,4,5,7].forEach((offset,i)=>{body+=`<path class="finger-guide" d="M${violinX(offset)} 40V190"/>`+text(violinX(offset),22,i+1,'finger-guide-label')});
 tuning.violin.forEach((m,i)=>{const y=66+(3-i)*32;body+=`<path class="instrument-string ${position?.finger===0&&position.string===i?'is-open-string':''}" data-violin-string="${i}" d="M86 ${y}H668"/>`+text(58,y+5,name(m))});
 body+=marker(position?.finger?position:null,position?violinX(position.fret):0,position?66+(3-position.string)*32:0);
 const detail=!position?'Shift needed · outside the first-position guide':position.finger===0?'Open '+name(position.open)+' string':name(position.open)+' string · finger '+position.finger+(position.adjustment?' '+position.adjustment:'')+' · first position';
 return {markup:svg(body,detail),detail};
}
function guitar(midi,options){
 const position=stringPosition('guitar',midi),frets=options.guitarFrets||12,spacing=540/frets,x=f=>126+(f-.5)*spacing;
 let body='<rect class="guitar-neck" x="124" y="40" width="548" height="153" rx="8"/><path class="nut" d="M124 40V193"/>';
 for(let f=1;f<=frets;f++){
  body+=`<path class="fret" d="M${126+f*spacing} 42V191"/>`;
  if([3,5,7,9,12,15,17,19,21,24].includes(f))body+=text(x(f),218,f);
 }
 tuning.guitar.forEach((m,i)=>{const y=54+(5-i)*25;body+=`<path class="instrument-string" style="stroke-width:${1+i*.15}" d="M88 ${y}H674"/>`+text(58,y+5,name(m))});
 body+=marker(position,position?(position.fret===0?103:x(position.fret)):0,position?54+(5-position.string)*25:0);
 const detail=!position?'Outside standard guitar range':position.fret===0?'String '+(6-position.string)+' · open '+name(position.open):'String '+(6-position.string)+' · fret '+position.fret+' · suggested finger '+position.finger;
 return {markup:svg(body,detail),detail};
}
// Standard Boehm flute with a C foot. Primary fingerings, C4–C7.
// Key IDs describe physical finger touches, not every mechanically linked pad.
const fluteKeys=[
 ['l1',190,100,'1'],['l2',250,100,'2'],['l3',310,100,'3'],
 ['r1',420,100,'1'],['r2',480,100,'2'],['r3',540,100,'3'],
 ['t',205,162,'B'],['gs',342,162,'G♯'],['eb',566,162,'E♭'],['cs',620,162,'C♯'],['c',674,162,'C'],
 ['td',395,48,'D'],['te',455,48,'D♯']
];
const flutePatterns={
 60:'t l1 l2 l3 r1 r2 r3 cs c',61:'t l1 l2 l3 r1 r2 r3 cs',62:'t l1 l2 l3 r1 r2 r3',63:'t l1 l2 l3 r1 r2 r3 eb',
 64:'t l1 l2 l3 r1 r2 eb',65:'t l1 l2 l3 r1 eb',66:'t l1 l2 l3 r3 eb',67:'t l1 l2 l3 eb',68:'t l1 l2 l3 gs eb',69:'t l1 l2 eb',70:'t l1 r1 eb',71:'t l1 eb',72:'l1 eb',73:'eb',
 74:'t l2 l3 r1 r2 r3',75:'t l2 l3 r1 r2 r3 eb',76:'t l1 l2 l3 r1 r2 eb',77:'t l1 l2 l3 r1 eb',78:'t l1 l2 l3 r3 eb',79:'t l1 l2 l3 eb',80:'t l1 l2 l3 gs eb',81:'t l1 l2 eb',82:'t l1 r1 eb',83:'t l1 eb',84:'l1 eb',85:'eb',
 86:'t l2 l3 eb',87:'t l1 l2 l3 gs r1 r2 r3 eb',88:'t l1 l2 r1 r2 eb',89:'t l1 l3 r1 eb',90:'t l1 l3 r3 eb',91:'l1 l2 l3 eb',92:'l2 l3 gs eb',93:'t l2 r1 eb',94:'t r1 td',95:'t l1 l3 te',96:'l1 l2 l3 gs r1'
};
function fluteFingering(midi){const pattern=flutePatterns[midi];return pattern===undefined?null:pattern.split(' ')}
function flute(midi){
 const pressed=fluteFingering(midi),down=new Set(pressed||[]);
 let body='<rect class="flute-tube" x="38" y="85" width="660" height="31" rx="15"/><ellipse class="flute-mouth" cx="90" cy="100" rx="23" ry="15"/><ellipse class="flute-hole" cx="90" cy="100" rx="9" ry="5"/><path class="flute-rod" d="M167 73H681"/>';
 body+=text(250,22,'LEFT HAND','hand-label')+text(480,22,'RIGHT HAND','hand-label')+text(205,209,'THUMB','small-diagram-label')+text(425,209,'Filled = press · outline = release','small-diagram-label');
 for(const [id,x,y,label]of fluteKeys){const main=/^[lr][123]$/.test(id);body+=`<g class="flute-key ${down.has(id)?'is-pressed':''}" data-key="${id}">`+(main?`<circle cx="${x}" cy="${y}" r="21"/>`:`<rect x="${x-23}" y="${y-14}" width="46" height="28" rx="12"/>`)+text(x,y+5,label,'flute-key-label')+'</g>'}
 const detail=pressed?'Boehm flute · C foot · standard fingering':'Outside the C4–C7 fingering guide';
 return {markup:svg(body,name(midi)+'; '+detail),detail};
}
function diagram(key,midi,transpose=0,options={}){
 if(key==='piano')return keyboard(midi,options);
 if(key==='violin')return violin(midi);
 if(key==='guitar')return guitar(midi,options);
 if(key==='flute')return flute(midi);
 throw Error('Unsupported instrument');
}
function render(container,key,midi,transpose=0,options={}){
 const layout=[key,key==='piano'?options.minMidi:'',key==='piano'?options.maxMidi:'',key==='guitar'?options.guitarFrets:''].join(':');
 const result=diagram(key,midi,transpose,options);
 if(container.dataset.instrumentLayout!==layout){container.innerHTML=result.markup;container.dataset.instrumentLayout=layout;return result.detail}
 if(key==='piano'){
  container.querySelector('.target-key')?.classList.remove('target-key');container.querySelector(`[data-midi="${midi}"]`)?.classList.add('target-key');
  const target=keyboardModel(midi,options).find(k=>k.midi===midi),mark=container.querySelector('.piano-hand-marker');
  if(target&&mark){mark.setAttribute('transform',`translate(${target.x+target.width/2} ${target.black?90:148})`);mark.querySelector('.finger-number').textContent=options.finger||1}
 }else if(key==='violin'||key==='guitar'){
  const position=stringPosition(key,midi),mark=container.querySelector('.string-marker');mark.setAttribute('visibility',position&&(key!=='violin'||position.finger!==0)?'visible':'hidden');
  if(key==='violin')for(let i=0;i<4;i++)container.querySelector(`[data-violin-string="${i}"]`).classList.toggle('is-open-string',position?.finger===0&&position.string===i);
  if(position){const x=key==='violin'?violinX(position.fret):position.fret===0?103:126+(position.fret-.5)*540/(options.guitarFrets||12),y=key==='violin'?66+(3-position.string)*32:54+(5-position.string)*25;mark.setAttribute('transform',`translate(${x} ${y})`);mark.querySelector('.finger-number').textContent=key==='violin'&&position.finger===0?'':position.finger}
 }else{
  const down=new Set(fluteFingering(midi)||[]);for(const [id]of fluteKeys)container.querySelector(`[data-key="${id}"]`).classList.toggle('is-pressed',down.has(id));
 }
 container.querySelector('svg').setAttribute('aria-label',name(midi)+'; '+result.detail);
 return result.detail;
}
const api={diagram,render,stringPosition,pianoFingerings,fluteFingering};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArohaInstrumentView=api;
})(typeof window!=='undefined'?window:globalThis);