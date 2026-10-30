import {composeMusic,musicId,type MusicId,type Note,type Score} from '../shared/music';

/** One local audio player: preview and game music never overlap. */
class CourseMusic {
 private context?:AudioContext;
 private master?:GainNode;
 private bus?:GainNode;
 private timer?:number;
 private score?:Score;
 private index=0;
 private startTime=0;
 private selected:MusicId='none';
 private noise?:AudioBuffer;
 private listeners=new Set<()=>void>();
 volume=.3;
 get hasTrack(){return this.selected!=='none';}
 constructor(){try{const v=localStorage.getItem('chainrace-bgm-volume')??localStorage.getItem('kd.music.volume');if(v!==null&&Number.isFinite(+v))this.volume=Math.max(0,Math.min(1,+v));}catch{}
  window.addEventListener('pointerdown',this.unlock);window.addEventListener('keydown',this.unlock);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void this.context?.suspend();else this.unlock();});
 }
 subscribe(fn:()=>void){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 private notify(){this.listeners.forEach(fn=>fn());}
 private unlock=()=>{if(this.selected==='none'||document.hidden)return;this.ensure();void this.context!.resume().then(()=>{if(!this.timer&&this.selected!=='none')this.begin();}).catch(()=>{});};
 private ensure(){
  if(this.context)return;const c=this.context=new AudioContext();this.master=c.createGain();this.master.gain.value=this.volume;
  const limiter=c.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=6;this.master.connect(limiter);limiter.connect(c.destination);
  this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=73;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)|0;data[i]=seed/2147483648;}
 }
 setVolume(value:number){this.volume=Math.max(0,Math.min(1,Number.isFinite(value)?value:0));try{localStorage.setItem('chainrace-bgm-volume',String(this.volume));}catch{}if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context!.currentTime,.04);this.unlock();this.notify();}
 play(value:unknown){const id=musicId(value);this.stop();this.selected=id;this.notify();if(id==='none')return;this.score=composeMusic(id);this.unlock();}
 stop(){this.selected='none';if(this.timer)clearInterval(this.timer);this.timer=undefined;this.bus?.disconnect();this.bus=undefined;this.score=undefined;this.notify();}
 private begin(){
  if(!this.score||!this.context||!this.master)return;const c=this.context;
  this.bus=c.createGain();this.bus.connect(this.master);
  this.index=0;this.startTime=c.currentTime+.05;this.schedule();this.timer=window.setInterval(()=>this.schedule(),80);
 }
 private schedule(){
  if(!this.context||!this.score||!this.bus)return;const s=this.score,seconds=60/s.bpm,loop=s.beats*seconds;
  // Resume from a fresh phrase after a throttled background tab, without a burst of queued notes.
  if(this.startTime+loop<this.context.currentTime-.5){this.startTime=this.context.currentTime+.05;this.index=0;}
  while(this.startTime+s.notes[this.index].beat*seconds<this.context.currentTime+.25){
   const n=s.notes[this.index],when=this.startTime+n.beat*seconds;
   if(when>=this.context.currentTime-.02)this.note(n,Math.max(when,this.context.currentTime),n.duration*seconds);
   if(++this.index===s.notes.length){this.index=0;this.startTime+=loop;}
  }
 }
 private note(n:Note,time:number,duration:number){
  const c=this.context!,gain=c.createGain(),pan=c.createStereoPanner(),filter=c.createBiquadFilter();
  pan.pan.value=n.pan;filter.type='lowpass';filter.frequency.value=n.voice==='strings'?1100:n.voice==='brass'||n.voice==='guitar'?2100:7500;
  gain.connect(filter);filter.connect(pan);pan.connect(this.bus!);
  const attack=n.voice==='strings'?.15:.008,tail=n.voice==='bell'?.7:n.voice==='strings'?.4:.08,end=time+Math.max(duration,attack)+tail;
  gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(n.gain,time+attack);gain.gain.exponentialRampToValueAtTime(.0001,end);
  const frequency=440*Math.pow(2,(n.pitch-69)/12);
  if(n.voice==='snare'||n.voice==='hat'){
   const source=c.createBufferSource();source.buffer=this.noise!;filter.type='highpass';filter.frequency.value=n.voice==='hat'?6500:1300;source.connect(gain);source.start(time);source.stop(end);source.onended=()=>{source.disconnect();gain.disconnect();filter.disconnect();pan.disconnect();};return;
  }
  const harmonics=n.voice==='bell'?[1,2.76,5.4]:n.voice==='piano'||n.voice==='electric'?[1,2,3]:[1];
  let remaining=harmonics.length;
  harmonics.forEach((h,i)=>{
   const osc=c.createOscillator(),level=c.createGain();level.gain.value=i===0?1:.18/(i+1);
   osc.type=n.voice==='brass'||n.voice==='strings'||n.voice==='guitar'?'sawtooth':n.voice==='synth'||n.voice==='pluck'?'triangle':'sine';
   osc.frequency.setValueAtTime(n.voice==='kick'?140:frequency*h,time);
   if(n.voice==='kick')osc.frequency.exponentialRampToValueAtTime(38,time+.12);
   osc.connect(level);level.connect(gain);osc.start(time);osc.stop(end);
   osc.onended=()=>{osc.disconnect();level.disconnect();if(--remaining===0){gain.disconnect();filter.disconnect();pan.disconnect();}};
  });
 }
}
export const courseMusic=new CourseMusic();

// Reuse the existing title-screen music controls with the same player.
export function mountMusic(button:HTMLButtonElement,slider:HTMLInputElement){
 let previous=courseMusic.volume||.3;
 const update=()=>{const active=courseMusic.hasTrack&&courseMusic.volume>0;button.textContent=active?'♫ BGM ON':'♫ BGM OFF';button.setAttribute('aria-pressed',String(active));slider.value=String(Math.round(courseMusic.volume*100));};
 button.onclick=()=>{if(!courseMusic.hasTrack){courseMusic.play('chinatown');if(!courseMusic.volume)courseMusic.setVolume(previous);}else if(courseMusic.volume){previous=courseMusic.volume;courseMusic.setVolume(0);}else courseMusic.setVolume(previous);};
 slider.oninput=()=>courseMusic.setVolume(+slider.value/100);courseMusic.subscribe(update);update();
}
