(()=>{
'use strict';
const M=window.ArohaMusic,V=window.ArohaInstrumentView,$=id=>document.getElementById(id);
const SVG='http://www.w3.org/2000/svg';
// Violin, first position: open strings G3 D4 A4 E5, up to seven semitones each.
const OPEN=[55,62,69,76],STRING_NAMES=['G','D','A','E'],MAX_OFFSET=7,NATURALS=[0,2,4,5,7,9,11];
const FINGERS=[0,1,1,2,2,3,3,4],ADJUST={1:'low ',3:'low ',6:'high '};
const pitchClass=m=>M.noteName(m).replace(/-?\d+$/,'');

let mode='guess',target=null,answered=false,firstTry=true,advanceTimer=0;
const scores={guess:{correct:0,total:0},read:{correct:0,total:0}};
let context,audio,stream,source,analyser,samples,tracker=new M.AttackTracker(),ignoreUntil=0,lastFrame=0,micToken=0;

// ---------- helpers
function pool(){const out=[];for(let m=OPEN[0];m<=OPEN[3]+MAX_OFFSET;m++)if($('pr-sharps').checked||NATURALS.includes(m%12))out.push(m);return out}
function pick(){const notes=pool().filter(m=>m!==target);return notes[Math.floor(Math.random()*notes.length)]}
function positionsFor(midi){return OPEN.map((open,string)=>({string,offset:midi-open})).filter(p=>p.offset>=0&&p.offset<=MAX_OFFSET)}
function describe({string,offset}){return offset===0?'Open '+STRING_NAMES[string]+' string':STRING_NAMES[string]+' string · '+(ADJUST[offset]||'')+'finger '+FINGERS[offset]}
function feedback(title,text,type=''){const box=$('pr-feedback');box.classList.remove('good','bad');if(type)box.classList.add(type);$('pr-feedback-title').textContent=title;$('pr-feedback-text').textContent=text}
function updateScore(){const s=scores[mode];$('pr-score').textContent=s.correct+' / '+s.total}
function finishRound(correct){if(answered)return;answered=true;scores[mode].total++;if(correct&&firstTry)scores[mode].correct++;updateScore();$('pr-reveal').disabled=true}

// ---------- sound
function audioContext(){context??=new(window.AudioContext||window.webkitAudioContext)();audio??=new window.ArohaAudio(context);return context}
async function play(midi,length=1.1){
 const ac=audioContext();await ac.resume();
 try{await audio.prepare('violin',[midi]);audio.play('violin',midi,ac.currentTime+.03,length,.3)}
 catch(error){if(error.name==='AbortError')return false;feedback('Couldn’t load the violin sound.','Check your connection and try again.','bad');return false}
 // Keep the microphone from grading the reference note.
 ignoreUntil=performance.now()+(length+.5)*1000;tracker.reset();return true;
}

// ---------- violin diagram (shared by both exercises)
function buildDiagram(){
 const box=$('pr-diagram');box.innerHTML=V.diagram('violin',0).markup;
 const svg=box.querySelector('svg');svg.setAttribute('aria-label','Violin fingerboard, first position');
 // Crop the empty margins so the strings are as large as possible to tap.
 svg.setAttribute('viewBox','40 6 640 192');
 const targets=document.createElementNS(SVG,'g');targets.setAttribute('class','pr-targets');
 for(let string=0;string<4;string++)for(let offset=0;offset<=MAX_OFFSET;offset++){
  const here=V.violinPoint(string,offset),prev=offset?V.violinPoint(string,offset-1).x:86,next=offset<MAX_OFFSET?V.violinPoint(string,offset+1).x:668;
  const left=offset?(prev+here.x)/2:86,right=(here.x+next)/2;
  const g=document.createElementNS(SVG,'g');g.setAttribute('class','pr-target');g.setAttribute('role','button');g.setAttribute('tabindex','0');
  g.dataset.string=string;g.dataset.offset=offset;g.setAttribute('aria-label',offset?STRING_NAMES[string]+' string, '+offset+' semitone'+(offset>1?'s':'')+' above open':'Open '+STRING_NAMES[string]+' string');
  g.innerHTML=`<rect x="${left}" y="${here.y-16}" width="${right-left}" height="32" fill="transparent"/><circle class="pr-hover" cx="${here.x}" cy="${here.y}" r="11"/>`;
  targets.append(g);
 }
 const marks=document.createElementNS(SVG,'g');marks.setAttribute('class','pr-marks');marks.id='pr-marks';
 svg.append(targets,marks);
 targets.addEventListener('click',event=>{const g=event.target.closest('.pr-target');if(g)tap(+g.dataset.string,+g.dataset.offset)});
 targets.addEventListener('keydown',event=>{if(event.key!=='Enter'&&event.key!==' ')return;const g=event.target.closest('.pr-target');if(g){event.preventDefault();tap(+g.dataset.string,+g.dataset.offset)}});
}
function clearMarks(){$('pr-marks').replaceChildren()}
function mark({string,offset},kind,label){
 const {x,y}=V.violinPoint(string,offset),g=document.createElementNS(SVG,'g');g.setAttribute('class','pr-mark '+kind);
 g.innerHTML=`<circle cx="${x}" cy="${y}" r="14"/><text x="${x}" y="${y+4}">${label}</text>`;$('pr-marks').append(g);
}
function revealTarget(kind='is-correct'){for(const p of positionsFor(target))mark(p,kind,pitchClass(target))}

// ---------- Guess the note: hear it, tap it
function tap(string,offset){
 if(mode!=='guess')return;
 const midi=OPEN[string]+offset,spot={string,offset};
 if(target===null){feedback('Press Play note first.','Then tap where that note is played.');return}
 play(midi,.6);
 if(answered)return;
 if(midi===target){
  mark(spot,'is-correct',pitchClass(midi));finishRound(true);
  feedback(firstTry?'That’s it!':'Got it.',M.noteName(midi)+' · '+describe(spot)+'. Press Next note to keep going.','good');
 }else{
  mark(spot,'is-wrong',pitchClass(midi));firstTry=false;
  feedback('Not quite — that’s '+M.noteName(midi)+'.','The note you heard is '+(midi<target?'higher':'lower')+'. Play it again and try another spot.','bad');
 }
}

// ---------- Read the note: see it, play it
function abcPitch(m){const names=['C','^C','D','^D','E','F','^F','G','^G','A','^A','B'],n=names[m%12],oct=Math.floor(m/12)-1,letter=n.at(-1),acc=n.length>1?'^':'';return acc+(oct>=5?letter.toLowerCase()+"'".repeat(oct-5):letter+','.repeat(Math.max(0,4-oct)))}
function renderStaff(){
 const staff=$('pr-staff');staff.setAttribute('aria-label','Note on the staff: '+M.noteName(target));
 if(!window.ABCJS){staff.textContent=M.noteName(target);return}
 window.ABCJS.renderAbc(staff,'X:1\nL:1/4\nK:C clef=treble\n'+abcPitch(target)+'4|]',{foregroundColor:'currentColor',scale:1.5,staffwidth:150,paddingtop:8,paddingbottom:8,paddingleft:8,paddingright:8});
}
function heard(attack){
 if(mode!=='read'||answered||target===null)return;
 const midi=attack.midi,spot=positionsFor(midi)[positionsFor(midi).length-1]; // lowest finger: highest string that reaches it
 clearMarks();
 if(midi===target){
  if(spot)mark(spot,'is-correct',pitchClass(midi));finishRound(true);
  feedback(firstTry?'Spot on!':'There it is.',M.noteName(midi)+(spot?' · '+describe(spot):'')+'. Next note coming up…','good');
  clearTimeout(advanceTimer);advanceTimer=setTimeout(()=>{if(mode==='read')newRound()},1800);
 }else{
  if(spot)mark(spot,'is-wrong',pitchClass(midi));firstTry=false;
  feedback('That was '+M.noteName(midi)+'.','Try a little '+(midi<target?'higher':'lower')+'.','bad');
 }
}
async function toggleMic(){
 if(stream){stopMic();return}
 const token=++micToken;
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone access needs a secure (HTTPS) browser tab.');
  const ac=audioContext();await ac.resume();
  const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
  if(token!==micToken||mode!=='read'){incoming.getTracks().forEach(t=>t.stop());return}
  stream=incoming;source=ac.createMediaStreamSource(stream);analyser=ac.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=0;source.connect(analyser);samples=new Float32Array(analyser.fftSize);tracker.reset();
  $('pr-mic').textContent='Turn off microphone';feedback('Listening.','Play the note on the staff. Your audio stays on this device.');requestAnimationFrame(listen);
 }catch(error){
  const messages={NotAllowedError:'Microphone access was blocked. Allow it in your browser’s site settings.',NotFoundError:'No microphone was found.',NotReadableError:'The microphone is busy. Close other recording apps and try again.'};
  feedback('Let’s connect your microphone.',messages[error.name]||error.message,'bad');
 }
}
function stopMic(){micToken++;if(stream)stream.getTracks().forEach(t=>t.stop());try{source?.disconnect();analyser?.disconnect()}catch{}stream=source=analyser=samples=null;$('pr-mic').textContent='Turn on microphone';$('pr-heard').textContent='—'}
function listen(now){
 if(!analyser)return;requestAnimationFrame(listen);
 if(now-lastFrame<35)return;lastFrame=now;
 analyser.getFloatTimeDomainData(samples);
 const detected=M.detectPitch(samples,context.sampleRate,{...M.instruments.violin,gate:.008});
 $('pr-heard').textContent=detected.frequency?M.noteName(detected.midi):'—';
 if(now<ignoreUntil){tracker.reset();return}
 const attack=tracker.observe(detected,now/1000);if(attack)heard(attack);
}

// ---------- rounds and modes
function newRound(){
 clearTimeout(advanceTimer);target=pick();answered=false;firstTry=true;clearMarks();$('pr-reveal').disabled=false;
 if(mode==='guess'){feedback('Listen…','Tap where your finger goes for this note.');play(target)}
 else{renderStaff();feedback('Play this note.',stream?'We’re listening.':'Turn on the microphone, then play it.')}
}
function setMode(next,{focus=false}={}){
 if(next===mode&&target!==null)return;
 mode=next;clearTimeout(advanceTimer);audio?.stop();
 for(const tab of document.querySelectorAll('.pr-tab')){const on=tab.dataset.mode===mode;tab.setAttribute('aria-selected',String(on));tab.tabIndex=on?0:-1;if(on){$('pr-panel').setAttribute('aria-labelledby',tab.id);if(focus)tab.focus()}}
 $('guess-prompt').hidden=mode!=='guess';$('read-prompt').hidden=mode!=='read';$('pr-hear').hidden=mode!=='read';
 $('pr-diagram').classList.toggle('is-tappable',mode==='guess');
 if(mode!=='read')stopMic();
 history.replaceState(null,'','#'+mode);updateScore();newRound();
}

$('pr-play').onclick=()=>{if(target===null)newRound();else play(target)};
$('pr-hear').onclick=()=>{if(target!==null)play(target)};
$('pr-next').onclick=()=>{if(!answered&&target!==null){scores[mode].total++;updateScore()}newRound()};
$('pr-reveal').onclick=()=>{if(target===null||answered)return;clearMarks();revealTarget();finishRound(false);feedback('Here it is: '+M.noteName(target)+'.',positionsFor(target).map(describe).join(' or ')+'. Press Next note to keep going.')};
$('pr-mic').onclick=toggleMic;
$('pr-sharps').onchange=()=>newRound();
const tabs=[...document.querySelectorAll('.pr-tab')];
for(const tab of tabs){
 tab.onclick=()=>setMode(tab.dataset.mode);
 tab.onkeydown=event=>{const i=tabs.indexOf(tab),step={ArrowRight:1,ArrowLeft:-1}[event.key];if(!step)return;event.preventDefault();setMode(tabs[(i+step+tabs.length)%tabs.length].dataset.mode,{focus:true})};
}
window.addEventListener('pagehide',()=>{stopMic();audio?.stop()});

buildDiagram();
// Wait for a click before the first sound; browsers block audio until then.
mode=location.hash==='#read'?'read':'guess';
if(mode==='read'){mode='';setMode('read')}
else{$('pr-diagram').classList.add('is-tappable');updateScore()}
})();
