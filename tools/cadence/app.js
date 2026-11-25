(()=>{
'use strict';
const M=window.CadenceMusic,$=id=>document.getElementById(id);
let scoreSource='midi',song,notes=[],part,page=0,scoreMap=new Map(),noteLookup=new Map();
let practiceView='instrument',instrumentNotes=[],instrumentNoteIndex=new Map(),instrumentIndex=0,instrumentSignature='',instrumentDiagramSignature='',instrumentRange={minMidi:60,maxMidi:60},instrumentFingers=new Map();
const isInstrumentView=()=>practiceView==='instrument';
let context,instrumentAudio,stream,source,analyser,buffer,metronomeVoices=[],tracker=new M.AttackTracker(),generation=0,referenceUntil=0,referenceNeedsQuiet=false,referenceQuietSince=null,armedNote=null,importController=null;
let phase='idle',position=0,origin=0,endTime=0,basePosition=0,clockStart=0,judge=null,sessionNotes=[],lastBeat=-1,lastFrame=0,lastCurrent=null,previewEnd=0;
let detectedSpeed=null,tempoEstimated=false,calibration=null,calibrationNotes=[],learningIndex=0;
let seeking=false,seekWasPreview=false;
const running=()=>['playing','armed','learning','preview','requesting','importing'].includes(phase),timed=()=>$('check-timing').checked,autoTempo=()=>$('automatic-tempo').checked,speed=()=>timed()?(autoTempo()&&detectedSpeed!==null?detectedSpeed:Number($('speed').value)/100):1,instrument=()=>M.instruments[$('instrument-select').value]||M.instruments.piano;
const status=text=>$('app-status').textContent=text;
const formatTime=t=>{t=Math.max(0,Math.floor(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')};
function feedback(title,text,type=''){const panel=$('feedback-copy').closest('section');panel.classList.remove('good','bad');if(type)panel.classList.add(type);$('feedback-headline').textContent=title;$('feedback-copy').textContent=text;$('feedback-icon').textContent=type==='good'?'✓':type==='bad'?'!':'♪'}
function audioContext(){context??=new(window.AudioContext||window.webkitAudioContext)();instrumentAudio??=new window.CadenceAudio(context);return context}
function silence(){instrumentAudio?.stop();for(const item of metronomeVoices){try{item.osc.stop();item.osc.disconnect();item.gain.disconnect()}catch{}}metronomeVoices=[]}
async function prepareInstrument(token){
 const key=$('instrument-select').value;status('Loading '+instrument().name+' sound…');
 try{await instrumentAudio.prepare(key,selectedNotes().map(n=>n.midi))}catch(error){if(token===generation){$('instrument-help').textContent='Instrument sound unavailable';$('instrument-help').title=error.message}throw error}
 if(token!==generation)return;$('instrument-help').textContent=instrument().clef+' clef · sampled sound';$('instrument-help').title='';
}
function stopMicrophone(){armedNote=null;referenceUntil=0;referenceNeedsQuiet=false;referenceQuietSince=null;if(stream)stream.getTracks().forEach(track=>track.stop());stream=null;try{source?.disconnect();analyser?.disconnect()}catch{}source=null;analyser=null;buffer=null;tracker.reset();$('mic-state').textContent='MIC OFF';$('mic-state').classList.remove('on');$('mic-button').textContent='Check microphone';$('input-level').style.width='0%';$('heard-note').textContent='—';$('heard-detail').textContent='Let’s hear you play';$('tuning-needle').style.left='50%'}
async function openMicrophone(token){
 if(stream)return true;
 if(!navigator.mediaDevices?.getUserMedia)throw Error('Microphone access needs a secure browser tab. Open this site directly over HTTPS in Chrome, Edge, Firefox, or Safari.');
 const ac=audioContext();await ac.resume();
 const incoming=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
 if(token!==generation){incoming.getTracks().forEach(t=>t.stop());return false}
 stream=incoming;source=ac.createMediaStreamSource(stream);analyser=ac.createAnalyser();analyser.fftSize=4096;analyser.smoothingTimeConstant=0;source.connect(analyser);buffer=new Float32Array(analyser.fftSize);tracker.reset();
 $('mic-state').textContent='MIC ON';$('mic-state').classList.add('on');$('mic-button').textContent='Turn off microphone';status('Microphone is on. Your audio is analyzed locally and isn’t recorded or uploaded.');return true;
}
function micError(error){const messages={NotAllowedError:'Microphone access was denied or blocked. Allow the microphone in your browser’s site settings, or open the site in a full browser tab.',NotFoundError:'No microphone was found. Connect one and try again.',NotReadableError:'The microphone is busy or unavailable. Close other recording apps and try again.'};status(messages[error.name]||'Could not start the microphone: '+error.message);feedback('Let’s connect your microphone.',messages[error.name]||error.message);}
function metronomeClick(midi,when,length=.25,volume=.09,type='triangle'){
 const ac=audioContext(),osc=ac.createOscillator(),gain=ac.createGain();osc.type=type;osc.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(volume,when+.008);gain.gain.exponentialRampToValueAtTime(.0001,when+Math.max(.02,length));osc.connect(gain);gain.connect(ac.destination);osc.start(when);osc.stop(when+length+.02);const item={osc,gain};metronomeVoices.push(item);osc.onended=()=>{osc.disconnect();gain.disconnect();metronomeVoices=metronomeVoices.filter(n=>n!==item)};
}
function setControls(){const locked=running();$('playhead').disabled=!song||['importing','requesting'].includes(phase);$('start-button').disabled=!song||phase==='importing';$('reset-button').disabled=!song&&phase!=='importing';for(const id of ['check-timing','part-select','instrument-select','speed','start-bar','line-select','timing-select','midi-file','select-song','automatic-playback','measure-count','automatic-tempo'])$(id).disabled=locked;$('preview-button').disabled=!song||['playing','armed','learning','requesting','importing'].includes(phase);$('mic-button').disabled=locked&&phase!=='requesting';const text=phase==='requesting'?'Cancel':phase==='preview'?'Start practice':['playing','armed','learning'].includes(phase)?'Pause practice':phase==='paused'?'Resume practice':phase==='finished'?'Try again':'Start practice';$('start-button').lastElementChild.textContent=text;$('preview-button').lastElementChild.textContent=phase==='preview'?'Stop preview':'Hear this part';for(const id of ['speed','timing-select','latency','click-sound'])$(id).disabled=locked||!timed();$('wrong-label').textContent=timed()?'Pitch / timing':'Wrong attempts';$('missed-stat').hidden=!timed();$('speed').disabled=locked||!timed()||autoTempo();$('automatic-tempo').disabled=locked||!timed();$('speed-value').textContent=!timed()?'—':autoTempo()&&detectedSpeed===null?'Automatic':Math.round(speed()*100)+'%';renderInstrumentNote()}
function reset({keepFeedback=false}={}){seeking=false;seekWasPreview=false;if($('pdf-import-dialog').open)$('pdf-import-dialog').close();instrumentIndex=0;instrumentSignature='';detectedSpeed=null;tempoEstimated=false;calibration=null;calibrationNotes=[];learningIndex=0;importController?.abort();importController=null;generation++;silence();stopMicrophone();phase='idle';judge=null;sessionNotes=[];lastCurrent=null;position=song?.bars[Number($('start-bar').value)||0]?.time||0;origin=position;endTime=song?practiceEnd():0;clearResults();setControls();updateStats();updateClock();if(!keepFeedback)feedback('A fresh start, every time.',timed()?'Press Start practice, then play the highlighted note to start the clock.':'Press Start practice and play the highlighted note. We’ll wait until it’s right.');}
function clearResults(){for(const id of scoreMap.keys())paint(id);$('review-list').replaceChildren();$('review-count').textContent='0 notes to revisit';$('extra-notes').textContent='';$('session-caption').textContent='Small steps sound good.'}
function barForTick(tick){let best=0;for(let i=0;i<song.bars.length;i++){if(song.bars[i].start>tick)break;best=i}return best}
function currentNote(){let lo=0,hi=notes.length;while(lo<hi){const mid=(lo+hi)>>1;if(notes[mid].end<position)lo=mid+1;else hi=mid}const n=notes[lo];return n&&position>=n.time-.1&&position<=n.end?n:null}
function paint(id){const result=judge?.results.get(id);for(const el of scoreMap.get(id)||[]){el.classList.remove('score-correct','score-wrong','score-current');if(result)el.classList.add(result.status==='correct'?'score-correct':'score-wrong');else if(id===lastCurrent&&['playing','armed','learning','preview','paused'].includes(phase))el.classList.add('score-current');const note=noteLookup.get(id);el.setAttribute('aria-label',(note?M.noteName(note.midi+instrument().transpose):'Note')+(result?' · '+(result.reasons.join(', ')||'On track'):''));}}
function showResult(id){const note=noteLookup.get(id),r=judge?.results.get(id);if(!note)return;if(!r){feedback(M.noteName(note.midi+instrument().transpose),'Expected at '+formatTime((note.time-origin)/speed())+' from the start of this take.');return}describe(r)}
function updateViewControls(){
 const inst=isInstrumentView();
 $('piano-hand-control').hidden=!inst||$('instrument-select').value!=='piano';$('instrument-view').hidden=!inst;$('score').hidden=inst;$('sheet-toolbar').hidden=inst;$('page-size-control').hidden=inst;$('measures-per-page').disabled=inst;$('score-fallback').hidden=true;$('follow-score-control').hidden=inst;
 $('instrument-view-button').setAttribute('aria-pressed',String(inst));$('sheet-view-button').setAttribute('aria-pressed',String(!inst));
 for(const [id,word]of [['previous-page','Previous'],['next-page','Next']]){$(id).textContent=(id==='previous-page'?'← ':'')+word+(id==='next-page'?' →':'');$(id).setAttribute('aria-label',word+(inst?' note':' score page'))}
}
function setPracticeView(view){
 if(view===practiceView)return;
 const target=instrumentNotes[instrumentIndex];practiceView=view;if(!song){updateViewControls();return}
 if(view==='sheet'&&target)page=pageForBar(barForTick(target.tick));
 else if(!['playing','armed','learning','preview'].includes(phase))instrumentIndex=Math.max(0,instrumentNotes.findIndex(n=>barForTick(n.tick)>=practiceRange().startIndex+page*measuresPerPage()));
 renderScore();
}
function renderInstrumentNote(){
 if(!isInstrumentView()||!song)return;
 const items=instrumentNotes;let target;
 if(phase==='learning')target=calibrationNotes[learningIndex];
 else if(phase==='armed')target=armedNote;
 else if(phase==='playing'&&judge?.waitForCorrect)target=judge.current;
 else if(phase==='preview'||phase==='playing'){
  let lo=0,hi=items.length;while(lo<hi){const mid=(lo+hi)>>1;if(items[mid].time<=position)lo=mid+1;else hi=mid}
  target=items[Math.max(0,lo-1)];
 }
 else if(phase==='finished')target=items.at(-1);
 if(target)instrumentIndex=instrumentNoteIndex.get(target.id)??instrumentIndex;
 else target=items[Math.max(0,Math.min(items.length-1,instrumentIndex))];
 const result=phase!=='preview'&&target&&judge?.results.get(target.id),state=result?.status==='correct'?'correct':result&&result.status!=='correct'?'wrong':'current';
 const key=$('instrument-select').value,signature=[key,target?.id,target?.midi,state,phase,items.length].join(':');
 $('previous-page').disabled=running()||!items.length||instrumentIndex<=0;$('next-page').disabled=running()||!items.length||instrumentIndex>=items.length-1;
 if(signature===instrumentSignature)return;instrumentSignature=signature;
 $('instrument-view').dataset.state=state;
 $('instrument-name').textContent=instrument().name;$('instrument-note').textContent=target?M.noteName(target.midi+instrument().transpose):'—';
 $('instrument-note-detail').textContent=!target?'No notes in this range':instrument().transpose?'Sounds '+M.noteName(target.midi):'Concert pitch';
 const hand=$('piano-hand').value||'right',finger=instrumentFingers.get(target?.id)||1;
 const diagramSignature=[key,target?.midi,instrumentRange.minMidi,instrumentRange.maxMidi,instrumentRange.guitarFrets,hand,finger].join(':');
 if(diagramSignature!==instrumentDiagramSignature){instrumentDiagramSignature=diagramSignature;$('instrument-position').textContent=target?window.CadenceInstrumentView.render($('instrument-diagram'),key,target.midi,instrument().transpose,{...instrumentRange,hand,finger}):'';if(!target){$('instrument-diagram').innerHTML='';delete $('instrument-diagram').dataset.instrumentLayout}}
 $('measure-label').textContent=target?'MEASURE '+(barForTick(target.tick)+1):'NO NOTES';$('score-transposition').textContent=instrument().transpose?'Written pitch · concert sound':'Concert pitch';
 $('page-label').textContent=items.length?'Note '+(instrumentIndex+1)+' of '+items.length:'0 notes';
}
function measuresPerPage(){const value=Number($('measures-per-page').value);return Number.isFinite(value)?Math.max(1,Math.min(16,Math.floor(value)||4)):4}
function renderScore(){
 if(!song){updateViewControls();return}updateViewControls();instrumentNotes=selectedNotes();instrumentRange=instrumentNotes.reduce((range,n)=>({minMidi:Math.min(range.minMidi,n.midi),maxMidi:Math.max(range.maxMidi,n.midi)}),{minMidi:Infinity,maxMidi:-Infinity});instrumentNoteIndex=new Map(instrumentNotes.map((n,i)=>[n.id,i]));instrumentRange.guitarFrets=instrumentNotes.some(n=>(window.CadenceInstrumentView.stringPosition('guitar',n.midi)?.fret||0)>12)?24:12;const fingers=$('instrument-select').value==='piano'?window.CadenceInstrumentView.pianoFingerings(instrumentNotes,$('piano-hand').value||'right'):[];instrumentFingers=new Map(instrumentNotes.map((n,i)=>[n.id,fingers[i]]));instrumentSignature='';
 if(isInstrumentView()){scoreMap=new Map();renderInstrumentNote();return}
 const maxPage=Math.max(0,Math.ceil((practiceRange().endIndex-practiceRange().startIndex)/measuresPerPage())-1);page=Math.min(maxPage,Math.max(0,page));
 const range=practiceRange(),firstBar=range.startIndex+page*measuresPerPage(),lastBar=Math.min(range.endIndex,firstBar+measuresPerPage());
 const notation=M.makeNotation(song,selectedNotes(),firstBar,lastBar-firstBar,instrument());scoreMap=new Map();$('score-fallback').hidden=true;
 if(window.ABCJS){try{
  const width=Math.max(280,$('score').clientWidth),scale=Number($('score-size').value);
  const tune=ABCJS.renderAbc('score',notation.abc,{foregroundColor:'currentColor',staffwidth:Math.max(200,width/scale-24),scale,wrap:{minSpacing:1.8,maxSpacing:2.6,preferredMeasuresPerLine:width<620?2:4},add_classes:true,paddingtop:24,paddingbottom:28,paddingleft:12,paddingright:12,minPadding:4,lineThickness:.2,format:{stretchlast:0,staffsep:64,barnumbers:1,measurefirst:firstBar+1}})[0];
  for(const entry of notation.map){const elem=tune.getElementFromChar(entry.char),elements=elem?.abselem?.elemset||[];if(!scoreMap.has(entry.id))scoreMap.set(entry.id,[]);scoreMap.get(entry.id).push(...elements);for(const element of elements){element.dataset.noteId=entry.id;element.setAttribute('tabindex','0');element.setAttribute('role','button');element.addEventListener('click',()=>showResult(entry.id));element.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();showResult(entry.id)}})}}
 }catch(error){showFallback(notation);status('The score renderer had trouble with this excerpt. The note guide and listening still work.')}}else showFallback(notation);
 for(const id of scoreMap.keys())paint(id);
 $('measure-label').textContent=`MEASURES ${firstBar+1}–${lastBar}`;$('page-label').textContent=`Page ${page+1} of ${maxPage+1}`;$('previous-page').disabled=page===0;$('next-page').disabled=page===maxPage;
}
function showFallback(notation){$('score').replaceChildren();$('score-fallback').replaceChildren();$('score-fallback').hidden=false;for(const entry of notation.map.filter((entry,index,all)=>all.findIndex(other=>other.id===entry.id)===index)){const span=document.createElement('span');span.textContent=M.noteName(noteLookup.get(entry.id).midi+instrument().transpose);$('score-fallback').append(span);if(!scoreMap.has(entry.id))scoreMap.set(entry.id,[]);scoreMap.get(entry.id).push(span)}}
function rebuild(){if(!song){setControls();return}reset();part=song.parts.find(p=>p.id===$('part-select').value)||song.parts.find(p=>!p.percussion);if(!part){status('This MIDI contains percussion only. Choose a file with a pitched instrument part.');$('start-button').disabled=true;return}$('start-button').disabled=false;const lineInfo=M.practiceLine(part,$('line-select').value);notes=lineInfo.notes.map(n=>scoreSource==='pdf'?{...n,midi:n.midi-instrument().transpose}:n);noteLookup=new Map(notes.map(n=>[n.id,n]));$('score-subtitle').textContent=part.name+' · '+part.instrument;$('note-count').textContent=selectedNotes().length+' notes';const inst=instrument();$('instrument-help').textContent=inst.clef+' clef · '+(inst.transpose?'written +'+inst.transpose:'concert pitch');$('score-transposition').textContent=scoreSource==='pdf'?'PDF written pitch · listening at concert pitch':inst.transpose?'Written pitch · listening at concert pitch':'Concert pitch';const meter=song.bars[Number($('start-bar').value)||0]||song.bars[0];$('meter-label').textContent=meter.n+'/'+meter.d+' time';$('tempo-label').textContent=!timed()?'':'♩ = '+Math.round(60e6/song.tempoMap[0].us*speed())+' BPM'+(song.tempoMap.length>1?' · tempo map':'');page=0;origin=meter.time;position=origin;endTime=practiceEnd();tempoReadout();renderScore();updateClock();$('next-note').textContent='NEXT: '+M.noteName((selectedNotes()[0]?.midi??60)+inst.transpose);const range=practiceRange();$('measure-help').textContent='0 = all remaining';$('measure-count').title='Selected measures: '+(range.startIndex+1)+'–'+range.endIndex;status(song.warnings.join(' '));}
function loadMidi(bytes,title,sourceKind='midi'){
 const parsed=M.parseMidi(bytes);if(!parsed.parts.some(p=>!p.percussion))throw Error('This MIDI contains percussion only. Choose a file with a pitched instrument part.');reset();song=parsed;scoreSource=sourceKind;$('score-title').textContent=title;$('file-kind').textContent='YOUR MIDI SCORE';$('part-select').replaceChildren();for(const p of song.parts){const option=new Option(`${p.name} · ${p.instrument}`,p.id);option.disabled=p.percussion;$('part-select').add(option)}const first=song.parts.find(p=>!p.percussion);if(first)$('part-select').value=first.id;$('start-bar').replaceChildren();for(const bar of song.bars)$('start-bar').add(new Option('Measure '+(bar.index+1),bar.index));$('start-bar').value='0';rebuild();
}
function showPdfImport(file){
 const dialog=$('pdf-import-dialog');dialog.dataset.state='working';dialog.setAttribute('aria-busy','true');
 $('pdf-import-title').textContent='Reading your score';$('pdf-import-filename').textContent=file.name;
 $('pdf-import-error-details').hidden=true;$('pdf-import-error-details').open=false;$('pdf-import-error-text').textContent='';
 $('pdf-import-progress').hidden=false;$('pdf-import-progress-label').hidden=false;
 $('pdf-import-hint').textContent='First use downloads about 150 MB of models. Your PDF stays on your device.';
 $('pdf-import-action').textContent='Cancel import';$('pdf-import-action').disabled=false;
 if(!dialog.open)dialog.showModal();updatePdfProgress('Preparing your PDF…',{stage:'prepare'});
}
function updatePdfProgress(text,{stage='load',done,total}={}){
 const dialog=$('pdf-import-dialog');if(!dialog.open||dialog.dataset.state!=='working')return;
 const steps=['prepare','load','read','finish'],current=steps.indexOf(stage==='download'?'load':stage);
 for(const item of dialog.querySelectorAll('[data-stage]')){const index=steps.indexOf(item.dataset.stage);item.dataset.state=index<current?'done':index===current?'current':'waiting';if(index===current)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current')}
 $('pdf-import-message').textContent=text;
 const progress=$('pdf-import-progress'),known=Number.isFinite(done)&&Number.isFinite(total)&&total>0,percent=known?Math.max(0,Math.min(100,Math.round(done/total*100))):null;
 if(known)progress.value=percent;else progress.removeAttribute('value');
 const label=stage==='download'?'Download':stage==='prepare'?'Page preparation':stage==='read'?'Pages processed':stage==='finish'?'Finishing':'Loading recognition tools';
 $('pdf-import-progress-label').textContent=known?label+' · '+percent+'%':label+'…';
}
function pdfImportError(message,{title='Could not read this PDF',details=''}={}){
 const dialog=$('pdf-import-dialog');dialog.dataset.state='error';dialog.setAttribute('aria-busy','false');
 $('pdf-import-title').textContent=title;$('pdf-import-message').textContent=message;
 $('pdf-import-progress').hidden=true;$('pdf-import-progress-label').hidden=true;$('pdf-import-hint').textContent='You can close this window and choose another PDF or MIDI.';
 $('pdf-import-error-details').hidden=!details;$('pdf-import-error-text').textContent=details;
 $('pdf-import-action').textContent='Close';$('pdf-import-action').disabled=false;
}
function cancelPdfImport(){
 if($('pdf-import-dialog').dataset.state!=='working'){ $('pdf-import-dialog').close();return }
 $('pdf-import-action').disabled=true;$('pdf-import-message').textContent='Canceling import…';importController?.abort();
}
async function importFile(file){
 if(!file)return;if($('song-dialog').open)$('song-dialog').close();const pdf=/\.pdf$/i.test(file.name)||file.type==='application/pdf';
 if(!pdf){if(file.size>5*1024*1024){status('Choose a MIDI file smaller than 5 MB.');return}try{loadMidi(await file.arrayBuffer(),file.name.replace(/\.(mid|midi)$/i,''));status('Your MIDI is ready. Choose a part and your instrument, then start a take.')}catch(error){status(error.message);feedback('Let’s try another file.',error.message,'bad')}return}
 reset();showPdfImport(file);status('');
 if(file.size>20*1024*1024){pdfImportError('Choose a PDF smaller than 20 MB.');return}
 const token=++generation;importController=new AbortController();const controller=importController;phase='importing';setControls();let timedOut=false;
 const timer=setTimeout(()=>{timedOut=true;controller.abort()},600000);
 try{
  const bytes=await window.CadencePdf.recognizePdf(file,{signal:controller.signal,onProgress:(text,progress)=>{if(token===generation)updatePdfProgress(text,progress)}});
  if(token!==generation)return;loadMidi(bytes,file.name.replace(/\.pdf$/i,''),'pdf');$('file-kind').textContent='RECOGNIZED PDF';status('PDF notes detected. Review the part, pitches and rhythm before practicing; recognition can make mistakes.');feedback('Your PDF is ready to review.','Check the recognized notes, choose your part and instrument, then start practice.');
 }catch(error){
  if(token!==generation)return;phase='idle';importController=null;setControls();
  if(error.name==='AbortError'&&!timedOut){$('pdf-import-dialog').close();status('PDF import canceled.');feedback('Import canceled.','Choose a score whenever you’re ready.');return}
  const noMusic=/No music found on any page/i.test(error.message),technical=/Traceback|PythonError/i.test(error.message);
  const title=timedOut?'Import took too long':noMusic?'No readable music found':'Could not read this PDF';
  const message=timedOut?'Try a PDF with fewer pages. Large scores can take longer to recognize.':noMusic?'No readable music was detected on these pages. Try a clear, upright PDF of printed staff notation, or upload MIDI exported from the original score.':technical?'The recognition engine could not read this score. Try fewer pages or a clearer PDF, or upload MIDI.':error.message;
  pdfImportError(message,{title,details:technical?error.message:''});feedback(title,message,'bad');
 }finally{clearTimeout(timer)}
}
function practiceRange(){const startIndex=Math.min(song.bars.length-1,Math.max(0,Number($('start-bar').value)||0)),raw=Number($('measure-count').value),count=Number.isFinite(raw)?Math.max(0,Math.floor(raw)):0,endIndex=count?Math.min(song.bars.length,startIndex+count):song.bars.length;return {startIndex,endIndex,start:song.bars[startIndex].start,end:song.bars[endIndex-1].end}}
function practiceEnd(){return song.tickToSeconds(practiceRange().end)}
function selectedNotes(){if(!song)return [];const range=practiceRange(),end=song.tickToSeconds(range.end);return notes.filter(n=>n.tick>=range.start&&n.tick<range.end).map(n=>({...n,endTick:Math.min(n.endTick,range.end),end:Math.min(n.end,end)}))}
function pageForBar(index){return Math.max(0,Math.floor((index-practiceRange().startIndex)/measuresPerPage()))}
function configureTiming(){if(!judge||judge.waitForCorrect)return;const tolerance=Number($('timing-select').value);judge.timing=tolerance*speed();judge.window=Math.max(.25,Math.min(.6,tolerance*3))*speed();endTime=practiceEnd()+judge.window}
function newJudge(items){return timed()?new M.Judge(items,{timing:Number($('timing-select').value)*speed()}):new M.WaitJudge(items)}
function tempoReadout(){if(!song)return;$('tempo-label').hidden=!timed();$('tempo-label').textContent=!timed()?'':autoTempo()&&detectedSpeed===null?'Automatic tempo · play to begin':'♩ = '+Math.round(60e6/song.tempoMap[0].us*speed())+' BPM'+(autoTempo()?(tempoEstimated?' · detected':' · manual fallback'):'')}
function syncLearningCursor(){const next=calibrationNotes[learningIndex];if(!next)return;const old=lastCurrent;lastCurrent=next.id;position=next.time;if(!isInstrumentView()&&$('follow-score').checked&&pageForBar(barForTick(next.tick))!==page){page=pageForBar(barForTick(next.tick));renderScore()}if(old)paint(old);paint(next.id);$('next-note').textContent='PLAY: '+M.noteName(next.midi+instrument().transpose);paintBeats(-1,0);updateClock()}
function lockTempo(note,attack,now){tempoEstimated=Boolean(calibration?.ratio);detectedSpeed=calibration?.ratio??Number($('speed').value)/100;$('speed').value=Math.round(detectedSpeed*100);basePosition=note.time;clockStart=attack.time*1000;position=basePosition+Math.max(0,(now-clockStart)/1000)*speed();phase='playing';configureTiming();setControls();tempoReadout();status((tempoEstimated?'Tempo detected: ':'Not enough steady notes; using ')+Math.round(60e6/song.tempoMap[0].us*speed())+' BPM. Keep following the beat.');if(judge.results.size===sessionNotes.length)finish()}
function startFromAttack(first,attack,now){if(judge.results.get(first.id)?.calibration)judge.results.delete(first.id);armedNote=null;basePosition=first.time;clockStart=attack.time*1000;position=first.time;configureTiming();const remaining=sessionNotes.filter(n=>!judge.results.has(n.id)||(judge.results.get(n.id).calibration&&judge.results.get(n.id).status==='wrong'));if(autoTempo()&&detectedSpeed===null&&remaining.length>1){calibration=new M.TempoEstimator();calibrationNotes=remaining;learningIndex=1;calibration.observe(first.time,attack.time);phase='learning';setControls();const opening={...judge.ingest({...attack,time:first.time}),calibration:true};judge.results.set(first.id,opening);resultChanged([opening]);syncLearningCursor();status('Learning your tempo. Play the next '+(Math.min(4,remaining.length)-1)+' notes at your comfortable pace.')}else{if(autoTempo()&&detectedSpeed===null){detectedSpeed=Number($('speed').value)/100;tempoEstimated=false;tempoReadout()}phase='playing';setControls();resultChanged([judge.ingest({...attack,time:first.time})]);position=basePosition+Math.max(0,(now-clockStart)/1000)*speed();status('Timing started. Keep following the beat.')}}
function learnAttack(attack,now){const expected=calibrationNotes[learningIndex];if(!expected)return;const correct=attack.midi===expected.midi&&Math.abs(attack.cents)<=judge.cents,result={id:expected.id,status:correct?'correct':'wrong',reasons:correct?[]:[attack.midi===expected.midi?'Out of tune':'Wrong pitch'],expected:expected.midi,heard:attack.midi,cents:attack.cents,offset:null,calibration:true};judge.results.set(expected.id,result);if(correct){calibration.observe(expected.time,attack.time);learningIndex++}else calibration.ignoreInterval();resultChanged([result]);const target=Math.min(4,calibrationNotes.length),enough=learningIndex>=target&&calibration.samples.length>=Math.min(2,calibrationNotes.length-1);if(correct&&(enough||learningIndex>=Math.min(8,calibrationNotes.length)))lockTempo(expected,attack,now);else{syncLearningCursor();status('Learning tempo · '+learningIndex+' correct notes. Keep a steady pace.')}}
function syncWaitCursor(){const current=judge.current,old=lastCurrent;lastCurrent=current?.id||null;position=current?.time??sessionNotes.at(-1)?.end??origin;if(current&&!isInstrumentView()&&$('follow-score').checked){const nextPage=pageForBar(barForTick(current.tick));if(nextPage!==page){page=nextPage;renderScore()}}if(old)paint(old);if(lastCurrent)paint(lastCurrent);$('next-note').textContent=current?'PLAY: '+M.noteName(current.midi+instrument().transpose):'ALL NOTES COMPLETE';paintBeats(-1,0);updateClock();if(!current&&phase==='playing')finish()}
function startClock(){
 if(judge?.waitForCorrect){phase='playing';tracker.reset();setControls();syncWaitCursor();status('Play the highlighted note. We wait until it’s correct; there is no time limit.');return}
 armedNote=sessionNotes.find(n=>!judge.results.has(n.id)||(judge.results.get(n.id).calibration&&judge.results.get(n.id).status==='wrong'));if(!armedNote){finish();return}
 phase='armed';tracker.reset();lastBeat=-1;lastCurrent=armedNote.id;if(!isInstrumentView()&&$('follow-score').checked){page=pageForBar(barForTick(armedNote.tick));renderScore()}paint(armedNote.id);paintBeats(-1,0);setControls();$('next-note').textContent='PLAY: '+M.noteName(armedNote.midi+instrument().transpose);feedback('Ready when you are.','Play the highlighted note to start the clock.');status('Waiting for the first correct note. Timing starts when we hear it.');
}
async function startLive(){
 if(!song||!notes.length)return;if(!selectedNotes().length){status('Choose an earlier measure; this part has no notes left here.');return}
 if(['playing','armed','learning'].includes(phase)){pause();return}if(phase==='requesting'){reset();return}
 const resume=phase==='paused';generation++;const token=generation;silence();phase='requesting';setControls();status('Waiting for microphone permission…');
 try{if(!await openMicrophone(token))return;if(token!==generation)return;if($('automatic-playback').checked)await prepareInstrument(token);if(token!==generation)return;if(!resume){origin=song.bars[Number($('start-bar').value)||0].time;position=origin;sessionNotes=selectedNotes();judge=newJudge(sessionNotes);endTime=practiceEnd()+judge.window;clearResults();updateStats();}startClock()}catch(error){if(token!==generation)return;phase='idle';stopMicrophone();setControls();if(error.name==='InstrumentAudioError'){status(error.message);feedback('Instrument sound unavailable.','Try again, or turn off Automatic playback to practice without reference audio.','bad')}else micError(error)}
}
function pause(){if(!['playing','armed','learning'].includes(phase))return;generation++;phase='paused';silence();stopMicrophone();setControls();status('Take paused. Resume when you’re ready.');for(const id of scoreMap.keys())paint(id)}
function describe(result){
 if(result.extra){feedback('An extra note slipped in.','That attack was outside a nearby expected note. Keep following the pulse.','bad');return}
 const expected=M.noteName(result.expected+instrument().transpose);
 if(result.calibration){feedback(result.status==='correct'?'Pitch matched. Learning your pace.':result.reasons.join(' + ')+'.',result.status==='correct'?'Keep playing the highlighted notes at a steady, comfortable pace.':'Expected '+expected+'. Try that note again; this interval won’t set your tempo.',result.status==='correct'?'good':'bad');return}
 if(result.waitForCorrect){if(result.status==='correct')feedback('That’s the note.',expected+' accepted. Move to the next highlighted note.','good');else feedback(result.reasons.join(' + ')+'.','Expected '+expected+', heard '+M.noteName(result.heard+instrument().transpose)+'. Try again—we’re staying on this note.','bad');return}
 if(result.status==='correct')feedback('Right note. Right moment.',expected+' · '+Math.round(Math.abs(result.offset)/speed()*1000)+' ms '+(result.offset<0?'early':'late')+' · within your timing window.','good');
 else if(result.status==='missed')feedback('A note to come back to.',expected+' wasn’t detected near its expected attack. It’s marked red in the score.','bad');
 else{const heard=result.heard===undefined?'':M.noteName(result.heard+instrument().transpose);feedback(result.reasons.join(' + ')+'.','Expected '+expected+', heard '+heard+'. '+(result.offset!==null?Math.round(Math.abs(result.offset)/speed()*1000)+' ms '+(result.offset<0?'early':'late')+'.':''),'bad')}
}
function playCorrection(result){if(!$('automatic-playback').checked||!['playing','armed','learning'].includes(phase)||!context||result?.status!=='wrong')return;
 try{instrumentAudio.play($('instrument-select').value,result.expected,context.currentTime+.015,.45);referenceUntil=performance.now()+800;referenceNeedsQuiet=true;referenceQuietSince=null;tracker.reset();status('Playing '+M.noteName(result.expected+instrument().transpose)+'. Let the sound fade, pause briefly, then try again.')}catch{status('Could not play the reference note. You can continue practicing.')}
}
function resultChanged(results){for(const r of results){if(r.id)paint(r.id)}if(results.length){describe(results.at(-1));playCorrection(results.at(-1));updateStats();updateReview();if(judge?.waitForCorrect)syncWaitCursor()}}
function updateStats(){const s=judge?.summary()||{correct:0,wrong:0,missed:0,accuracy:null,judged:0,total:0};$('accuracy').textContent=s.accuracy===null?'—':s.accuracy+'%';$('correct-count').textContent=s.correct;$('wrong-count').textContent=s.wrong;$('missed-count').textContent=s.missed;if(s.judged)$('session-caption').textContent=(judge.waitForCorrect?s.correct:s.judged)+' of '+s.total+(judge.waitForCorrect?' notes completed.':' notes checked.');}
function updateReview(){const list=$('review-list');list.replaceChildren();const results=[...(judge?.results.values()||[])].filter(r=>r.status!=='correct');$('review-count').textContent=results.length+' notes to revisit';for(const r of results.slice(0,150)){const n=noteLookup.get(r.id),li=document.createElement('li'),button=document.createElement('button');button.textContent='Measure '+(barForTick(n.tick)+1)+' · '+M.noteName(n.midi+instrument().transpose)+' · '+r.reasons.join(' / ')+(r.offset===null?'':' · '+Math.round(Math.abs(r.offset)/speed()*1000)+' ms '+(r.offset<0?'early':'late'));button.onclick=()=>{pause();instrumentIndex=instrumentNoteIndex.get(n.id)??0;page=pageForBar(barForTick(n.tick));renderScore();describe(r)};li.append(button);list.append(li)}$('extra-notes').textContent=judge?.extras.length?judge.extras.length+' extra attacks were heard outside the expected note windows.':'';}
function updateClock(){
 const slider=$('playhead'),start=song?song.tickToSeconds(practiceRange().start):0,end=song?practiceEnd():0;
 slider.min=start;slider.max=Math.max(start+.001,end);if(!seeking)slider.value=Math.max(start,Math.min(end,position));
 const percent=end>start?Math.max(0,Math.min(100,(position-start)/(end-start)*100)):0;
 slider.style.setProperty('--seek-fill',percent+'%');$('seek-position').textContent=formatTime((position-start)/speed())+' / '+formatTime((end-start)/speed());
 slider.setAttribute('aria-valuetext',song?'Measure '+(barForTick(song.secondsToTick(position))+1)+', '+formatTime((position-start)/speed()):'No score loaded');
 if(!timed()&&phase!=='preview'){const count=judge?.waitForCorrect?judge.index:0,total=judge?.waitForCorrect?judge.notes.length:song?selectedNotes().length:0;$('elapsed').textContent=count;$('duration').textContent=total+' notes';return}
 $('elapsed').textContent=formatTime(Math.max(0,(position-origin)/speed()));$('duration').textContent=formatTime(Math.max(0,(endTime-origin)/speed()));
}
function beginSeek(){
 if(!song||$('playhead').disabled||seeking)return;
 seeking=true;seekWasPreview=phase==='preview';
 if(['playing','armed','learning'].includes(phase))pause();else{silence();stopMicrophone()}
}
function showSeekPosition(){
 if(!seeking)beginSeek();if(!seeking)return;
 position=Math.max(song.tickToSeconds(practiceRange().start),Math.min(practiceEnd(),Number($('playhead').value)||0));
 const items=selectedNotes(),target=items.find(n=>n.end>position)||items.at(-1);
 instrumentIndex=target?instrumentNoteIndex.get(target.id)??0:0;
 page=pageForBar(barForTick(song.secondsToTick(position)));lastCurrent=target?.id||null;
 renderScore();updateClock();
}
function endSeek(){
 if(!seeking)return;const previewing=seekWasPreview;showSeekPosition();seeking=false;seekWasPreview=false;
 if(previewing){schedulePreview(position);return}
 const items=selectedNotes(),target=items.find(n=>n.end>position)||items.at(-1);
 if(!target){setControls();updateClock();return}
 // A seek starts a fresh take at this note. Earlier notes are not marked missed.
 detectedSpeed=null;tempoEstimated=false;calibration=null;calibrationNotes=[];learningIndex=0;tracker.reset();
 sessionNotes=items.filter(n=>n.time>=target.time);judge=newJudge(sessionNotes);clearResults();
 position=target.time;basePosition=position;origin=song.tickToSeconds(practiceRange().start);endTime=practiceEnd()+judge.window;phase='paused';
 instrumentIndex=instrumentNoteIndex.get(target.id)??0;lastCurrent=target.id;page=pageForBar(barForTick(target.tick));
 renderScore();setControls();updateStats();updateClock();tempoReadout();
 feedback('Ready at this note.','Resume practice to begin a fresh take from here.');status('Moved to measure '+(barForTick(target.tick)+1)+'. Resume practice when you’re ready.');
}
function schedulePreview(from){
 silence();const ac=audioContext(),end=practiceEnd();origin=song.tickToSeconds(practiceRange().start);
 position=Math.max(origin,Math.min(end,from));basePosition=position;
 if(position>=end){phase='idle';setControls();updateClock();status('Reference preview finished.');return}
 previewEnd=Math.min(end,position+120*speed());endTime=previewEnd;clockStart=performance.now()+80;
 const start=ac.currentTime+.08;
 for(const n of selectedNotes().filter(n=>n.end>position&&n.time<previewEnd)){
  const noteStart=Math.max(n.time,position),length=Math.min(n.end,previewEnd)-noteStart;
  if(length>0)instrumentAudio.play($('instrument-select').value,n.midi,start+(noteStart-position)/speed(),Math.max(.04,length/speed()*.9));
 }
 phase='preview';page=pageForBar(barForTick(song.secondsToTick(position)));renderScore();setControls();updateClock();
}
function finish(){phase='finished';stopMicrophone();silence();setControls();judge?.advance(Infinity);updateStats();updateReview();for(const id of scoreMap.keys())paint(id);const summary=judge?.summary();if(judge?.waitForCorrect){feedback('Every note completed.',summary.correct+' notes correct · '+summary.wrong+' wrong attempts corrected. Try again, or turn on Check timing to practice the rhythm.','good')}else feedback('A take worth learning from.',summary?summary.correct+' on track, '+summary.wrong+' pitch or timing, '+summary.missed+' missed. Review a phrase or try again.':'');status('Practice complete. Microphone is off.');}
function readInput(now){if(!analyser||!buffer||now-lastFrame<35)return;lastFrame=now;analyser.getFloatTimeDomainData(buffer);const detected=M.detectPitch(buffer,context.sampleRate,{...instrument(),gate:Number($('sensitivity').value)/1000});$('input-level').style.width=Math.min(100,detected.rms*400)+'%';
 if(detected.frequency){$('heard-note').textContent=M.noteName(detected.midi+instrument().transpose);$('heard-detail').textContent=Math.round(detected.frequency)+' Hz · '+(detected.cents>=0?'+':'')+Math.round(detected.cents)+' cents';$('tuning-needle').style.left=Math.max(0,Math.min(100,50+detected.cents))+'%'}else{$('heard-note').textContent='—';$('heard-detail').textContent=detected.rms>.02?'Listening for a steady note…':'Listening…';$('tuning-needle').style.left='50%'}
 if(['playing','armed','learning'].includes(phase)&&referenceNeedsQuiet){tracker.reset();if(now<referenceUntil){referenceQuietSince=null;return}if(detected.rms<Number($('sensitivity').value)/1000){referenceQuietSince??=now;if(now-referenceQuietSince>=120){referenceNeedsQuiet=false;referenceQuietSince=null;status('Your turn. Play the highlighted note.')}}else referenceQuietSince=null;return}
 if(phase==='learning'){const time=now/1000-buffer.length/(2*context.sampleRate)-Number($('latency').value)/1000,attack=tracker.observe(detected,time);if(attack)learnAttack(attack,now);return}
 if(phase==='armed'&&armedNote){const captureTime=now/1000-buffer.length/(2*context.sampleRate)-Number($('latency').value)/1000,attack=tracker.observe(detected,captureTime);if(attack){if(attack.midi===armedNote.midi&&Math.abs(attack.cents)<=judge.cents)startFromAttack(armedNote,attack,now);else{feedback('Waiting for the starting note.','Play '+M.noteName(armedNote.midi+instrument().transpose)+' to begin. The clock is still waiting.');playCorrection({status:'wrong',expected:armedNote.midi})}}return}
 if(phase==='playing'){const captureTime=now/1000-buffer.length/(2*context.sampleRate)-Number($('latency').value)/1000;const attack=tracker.observe(detected,captureTime);if(attack)resultChanged([judge.ingest(judge.waitForCorrect?attack:{...attack,time:basePosition+(attack.time-clockStart/1000)*speed()})]);else if(judge.waitForCorrect){const current=judge.current,previous=current&&judge.results.get(current.id);if(previous?.status==='wrong'&&detected.frequency&&detected.confidence>=.8&&tracker.frames>=2&&detected.midi===current.midi&&Math.abs(detected.cents)<=judge.cents)resultChanged([judge.ingest({...detected,time:captureTime})])}}else tracker.reset();
}
function frame(now){
 if(seeking){requestAnimationFrame(frame);return}
 if(phase==='learning'){readInput(now);if(phase==='learning')syncLearningCursor()}
 else if(phase==='playing'&&judge?.waitForCorrect){readInput(now);if(phase==='playing')syncWaitCursor()}
 else if(['playing','preview'].includes(phase)){
  const passed=(now-clockStart)/1000;
   position=basePosition+Math.max(0,passed)*speed();
   if(phase==='playing'){
    readInput(now);
    const missed=judge.advance(position);if(missed.length)resultChanged(missed);
   }
   const tick=song.secondsToTick(position),bi=barForTick(tick),bar=song.bars[bi],beatLength=song.ppq*4/bar.d,beat=Math.floor((tick-bar.start)/beatLength);paintBeats(beat,bar.n);
   const beatKey=bi+'-'+beat;if(phase==='playing'&&beatKey!==lastBeat){lastBeat=beatKey;if($('click-sound').checked&&context)metronomeClick(beat===0?88:81,context.currentTime,.03,.025,'sine')}
   if(!isInstrumentView()&&$('follow-score').checked&&pageForBar(bi)!==page){page=pageForBar(bi);renderScore()}
   const current=currentNote(),id=current?.id||null;if(id!==lastCurrent){const old=lastCurrent;lastCurrent=id;if(old)paint(old);if(id)paint(id)}const next=sessionNotes.find(n=>!judge?.results.has(n.id)&&n.time>=position-.15)||selectedNotes().find(n=>n.time>position);$('next-note').textContent=next?'NEXT: '+M.noteName(next.midi+instrument().transpose):'LAST PHRASE';updateClock();
   if(phase==='preview'&&position>=previewEnd){phase='idle';silence();setControls();status('Reference preview finished. Use headphones if you’re checking your microphone.')}else if(phase==='playing'&&position>=endTime)finish();
 }
 readInput(now);renderInstrumentNote();requestAnimationFrame(frame);
}
function paintBeats(index,count){const box=$('beat-indicator');if(box.children.length!==count){box.replaceChildren();for(let i=0;i<count;i++)box.append(document.createElement('i'))}Array.from(box.children).forEach((dot,i)=>dot.classList.toggle('active',i===index))}
async function preview(){
 if(!song)return;
 if(phase==='preview'){generation++;phase='idle';silence();setControls();return}
 if(running())return;
 const from=phase==='finished'?song.tickToSeconds(practiceRange().start):position;
 const token=++generation;stopMicrophone();silence();phase='requesting';setControls();
 try{
  const ac=audioContext();await ac.resume();if(token!==generation)return;
  await prepareInstrument(token);if(token!==generation)return;
  schedulePreview(from);status('Reference preview · '+instrument().name+' sampled sound. The microphone is off.');
 }catch(error){if(token!==generation)return;silence();phase='idle';setControls();status('Could not play the reference: '+error.message)}
}
$('playhead').addEventListener('pointerdown',beginSeek);$('playhead').oninput=showSeekPosition;$('playhead').onchange=endSeek;$('playhead').addEventListener('pointerup',endSeek);$('playhead').addEventListener('pointercancel',endSeek);
$('pdf-import-action').onclick=cancelPdfImport;$('pdf-import-dialog').addEventListener('cancel',event=>{event.preventDefault();cancelPdfImport()});
$('midi-file').onchange=event=>{const file=event.target.files[0];event.target.value='';importFile(file)};
let songRequest=null;
function cancelSongRequest(){songRequest?.abort();songRequest=null;$('song-dialog').removeAttribute('aria-busy')}
function renderSongLibrary(){
 const query=$('song-search').value.trim().toLocaleLowerCase(),key=$('song-instrument').value;
 const entries=(window.CadenceLibrary||[]).filter(s=>(key==='all'||s.instrument===key)&&[s.title,s.work,s.composer,s.instrument].join(' ').toLocaleLowerCase().includes(query));
 $('song-library-count').textContent=entries.length+(entries.length===1?' piece':' pieces');$('song-list').replaceChildren();
 $('browse-scores').href=key==='all'?'https://www.mutopiaproject.org/browse.html':'https://www.mutopiaproject.org/cgibin/make-table.cgi?Instrument='+encodeURIComponent(key[0].toUpperCase()+key.slice(1));
 for(const entry of entries){
  const li=document.createElement('li'),button=document.createElement('button'),title=document.createElement('strong'),detail=document.createElement('span'),tag=document.createElement('small'),credits=document.createElement('div');
  button.type='button';button.className='song-choice';title.textContent=entry.title;detail.textContent=entry.composer+' · '+entry.work;tag.textContent=M.instruments[entry.instrument].name;button.append(title,detail,tag);button.onclick=()=>openLibrarySong(entry);credits.className='song-credits';
  for(const [label,url]of [['Edition: '+entry.credit,entry.source],[entry.license,entry.licenseUrl]]){const a=document.createElement('a');a.textContent=label+' ↗';a.href=url;a.target='_blank';a.rel='noopener';credits.append(a)}
  li.append(button,credits);$('song-list').append(li);
 }
 $('song-library-status').textContent=entries.length?'':'No matching songs. Try another search or import from files.';
}
async function openLibrarySong(entry){
 cancelSongRequest();const controller=new AbortController();songRequest=controller;$('song-dialog').setAttribute('aria-busy','true');$('song-library-status').textContent='Opening '+entry.title+'…';
 const timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch('library/midi/'+entry.file,{signal:controller.signal});if(!response.ok)throw Error('The song file could not load.');const bytes=await response.arrayBuffer();if(songRequest!==controller||!$('song-dialog').open)return;
  M.parseMidi(bytes);$('instrument-select').value=entry.instrument;loadMidi(bytes,entry.title+' · '+entry.work,'library');$('file-kind').textContent='LIBRARY SCORE';$('song-dialog').close();status(entry.composer+' · Mutopia edition by '+entry.credit+' · '+entry.license+'.');feedback('Your song is ready.','Preview the part or start practicing.');
 }catch(error){if(songRequest===controller&&$('song-dialog').open)$('song-library-status').textContent=error.name==='AbortError'?'The song took too long to load. Please try again.':error.message+' Please try again or import from files.'}
 finally{clearTimeout(timeout);if(songRequest===controller)cancelSongRequest()}
}
$('select-song').onclick=()=>{if(running())return;cancelSongRequest();$('song-search').value='';$('song-instrument').value=$('instrument-select').value;renderSongLibrary();$('song-dialog').showModal();$('song-search').focus()};
$('close-song-dialog').onclick=()=>$('song-dialog').close();$('song-dialog').addEventListener('close',cancelSongRequest);$('song-dialog').addEventListener('cancel',cancelSongRequest);
$('song-search').oninput=()=>{cancelSongRequest();renderSongLibrary()};$('song-instrument').onchange=()=>{cancelSongRequest();renderSongLibrary()};
$('import-song').onclick=()=>{cancelSongRequest();$('midi-file').click()};

for(const [key,item]of Object.entries(M.instruments))$('instrument-select').add(new Option(item.name,key));$('instrument-select').value='piano';
for(const id of ['check-timing','part-select','instrument-select','start-bar','line-select','timing-select','measure-count','automatic-tempo'])$(id).onchange=()=>rebuild();
$('speed').oninput=()=>{$('speed-value').textContent=$('speed').value+'%';rebuild()};$('latency').oninput=()=>{$('latency-value').textContent=$('latency').value+' ms'};
$('instrument-view-button').onclick=()=>setPracticeView('instrument');$('sheet-view-button').onclick=()=>setPracticeView('sheet');
$('piano-hand').onchange=renderScore;$('score-size').onchange=renderScore;
$('measures-per-page').onchange=()=>{if(!song){$('measures-per-page').value=measuresPerPage();return}const firstBar=practiceRange().startIndex+page*Number($('measures-per-page').dataset.previous||4);$('measures-per-page').value=measuresPerPage();$('measures-per-page').dataset.previous=measuresPerPage();page=pageForBar(['playing','armed','learning','preview'].includes(phase)&&$('follow-score').checked?barForTick(song.secondsToTick(position)):firstBar);renderScore()};
let scoreWidth=0,resizeTimer;new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width===scoreWidth)return;scoreWidth=width;clearTimeout(resizeTimer);resizeTimer=setTimeout(renderScore,100)}).observe($('score'));
$('start-button').onclick=startLive;$('reset-button').onclick=()=>reset();$('preview-button').onclick=preview;
$('mic-button').onclick=async()=>{if(phase==='requesting'){reset();return}if(stream){stopMicrophone();return}const token=++generation;try{status('Waiting for microphone permission…');await openMicrophone(token)}catch(error){micError(error)}};
$('previous-page').onclick=()=>{if(isInstrumentView()){instrumentIndex=Math.max(0,instrumentIndex-1);renderInstrumentNote()}else{page--;renderScore()}};$('next-page').onclick=()=>{if(isInstrumentView()){instrumentIndex=Math.min(instrumentNotes.length-1,instrumentIndex+1);renderInstrumentNote()}else{page++;renderScore()}};$('help-button').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(['playing','armed','learning'].includes(phase))pause();else{if(['preview','requesting'].includes(phase)){generation++;phase='idle';silence();setControls()}stopMicrophone()}}});addEventListener('beforeunload',()=>{generation++;stopMicrophone();silence();context?.close()});
reset();updateViewControls();feedback('Select a song.','Choose from the library or import a PDF or MIDI.');requestAnimationFrame(frame);
})();
