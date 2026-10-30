export const MUSIC = [
  ['none','BGMなし',''],
  ['wetland','暗めの湿地帯','霧の底を漂う低音と、遠くで響く鐘'],
  ['autumn','紅葉の風を抜けて','軽快なリズムと木管の明るいメロディ'],
  ['chinatown','中華街','五音音階の弦と笛、にぎやかな打楽器'],
  ['arena','闘技場','重い太鼓と勇壮なブラス'],
  ['cosmos','星虹のロード','宇宙を駆けるシンセときらめくアルペジオ'],
  ['classical','クラシック','三拍子のピアノと弦の小品'],
  ['jazz','ジャズ','スウィングする鍵盤とウォーキングベース'],
  ['deep','地底の鼓動（低音）','低いベースと深い弦がゆっくり響く短調の曲'],
  ['sunrise','朝の広場（長調）','ハ長調の穏やかなピアノと軽いリズム'],
  ['warmbass','陽だまりの低音（長調）','ヘ長調の温かい低音と落ち着いた鍵盤'],
  ['anthem','ともに走れ（伴奏版）','激しいロック。男性ボーカル版は準備中'],
] as const;
export type MusicId=typeof MUSIC[number][0];
export function musicId(value:unknown):MusicId{return MUSIC.some(m=>m[0]===value)?value as MusicId:'none';}
export type Voice='bell'|'flute'|'pluck'|'brass'|'synth'|'piano'|'electric'|'strings'|'guitar'|'bass'|'kick'|'snare'|'hat';
export interface Note {beat:number;duration:number;pitch:number;voice:Voice;gain:number;pan:number}
export interface Score {bpm:number;beats:number;notes:Note[]}
type Arrangement={bpm:number;root:number;scale:number[];chords:number[];melody:number[];voice:Voice;meter?:number};
// Original motifs. Each tune has a 32-bar A / A' / B / A'' arrangement.
const tunes:Record<Exclude<MusicId,'none'>,Arrangement>={
 deep:{bpm:72,root:43,scale:[0,2,3,5,7,8,10],chords:[0,5,3,4,0,2,5,0],melody:[0,-1,2,4,3,-1,1,0,4,3,-1,2,1,0,4,0],voice:'strings'},
 sunrise:{bpm:104,root:60,scale:[0,2,4,5,7,9,11],chords:[0,3,4,0,5,1,4,0],melody:[0,2,4,2,3,5,4,2,1,3,4,6,5,4,2,0],voice:'piano'},
 warmbass:{bpm:88,root:53,scale:[0,2,4,5,7,9,11],chords:[0,5,1,4,3,0,4,0],melody:[0,2,-1,4,3,2,1,0,2,4,5,4,3,1,2,0],voice:'electric'},
 wetland:{bpm:76,root:50,scale:[0,2,3,5,7,8,10],chords:[0,5,3,4,0,2,5,4],melody:[0,-1,4,3,1,-1,0,-1,5,4,2,-1,1,3,1,0],voice:'bell'},
 autumn:{bpm:132,root:60,scale:[0,2,4,5,7,9,11],chords:[0,4,5,3,0,1,4,0],melody:[0,2,4,6,5,4,2,1,2,4,7,6,4,3,2,0],voice:'flute'},
 chinatown:{bpm:118,root:62,scale:[0,2,4,7,9],chords:[0,3,4,1,0,4,3,0],melody:[0,2,3,4,3,2,1,0,2,3,5,4,3,1,2,0],voice:'pluck'},
 arena:{bpm:140,root:50,scale:[0,2,3,5,7,8,10],chords:[0,0,5,3,0,5,4,4],melody:[0,0,4,4,3,2,1,0,5,5,4,3,2,1,4,0],voice:'brass'},
 cosmos:{bpm:150,root:61,scale:[0,2,4,6,7,9,11],chords:[0,3,5,4,0,2,3,4],melody:[0,4,7,6,4,2,3,5,7,6,4,3,2,4,1,0],voice:'synth'},
 classical:{bpm:110,root:60,scale:[0,2,4,5,7,9,11],chords:[0,4,5,2,3,0,4,0],melody:[4,3,2,1,0,2,4,5,6,5,4,2,3,1,2,0],voice:'piano',meter:3},
 jazz:{bpm:116,root:58,scale:[0,2,4,5,7,9,10],chords:[1,4,0,5,1,4,0,4],melody:[2,-1,4,6,5,3,2,-1,1,3,5,6,4,-1,2,0],voice:'electric'},
 anthem:{bpm:168,root:52,scale:[0,2,3,5,7,8,10],chords:[0,5,3,4,0,3,5,4],melody:[0,0,4,5,4,2,3,4,7,6,5,4,3,2,1,0],voice:'guitar'},
};
export function composeMusic(id:MusicId):Score{
 if(id==='none')return {bpm:120,beats:0,notes:[]};
 const a=tunes[id],meter=a.meter??4,notes:Note[]=[];
 const pitch=(degree:number,octave=0)=>a.root+a.scale[((degree%a.scale.length)+a.scale.length)%a.scale.length]+12*(Math.floor(degree/a.scale.length)+octave);
 const add=(beat:number,duration:number,n:number,voice:Voice,gain:number,pan=0)=>notes.push({beat,duration,pitch:n,voice,gain,pan});
 for(let bar=0;bar<32;bar++){
  const at=bar*meter,chord=a.chords[bar%8],section=Math.floor(bar/8),bridge=section===2;
  const low=id==='deep'||id==='warmbass',wet=id==='wetland'||id==='deep',jazz=id==='jazz',classic=id==='classical',heavy=id==='arena'||id==='anthem';
  // Warm harmony beneath each phrase, with a contrasting middle section.
  for(const [i,d] of [0,2,4,...(jazz?[6]:[])].entries())add(at,meter*.95,pitch(chord+d,bridge?0:-1),wet?'strings':classic?'strings':jazz?'electric':'synth',wet?.065:.035,(i-1)*.32);
  const bassSteps=wet?1:jazz?meter:2;
  for(let k=0;k<bassSteps;k++)add(at+k*meter/bassSteps,meter/bassSteps*.8,pitch(chord+(jazz?[0,2,4,6][k]:k%2*4),id==='deep'?-1:-2),'bass',.16);
  const count=wet?2:classic?3:4;
  for(let k=0;k<count;k++){
   let d=a.melody[(bar%4*count+k)%a.melody.length];if(d<0)continue;
   if(bridge)d=(d+2)%a.scale.length;
   const offset=jazz&&k%2?1/3:0;
   add(at+k*meter/count+offset,meter/count*(wet?1.65:.72),pitch(d,low?-1:1),a.voice,heavy?.11:.09,k%2?.16:-.16);
   if(section===3&&k===count-1&&!wet)add(at+k*meter/count+.5,.35,pitch(d+2,low?-1:1),a.voice,.055,-.25);
  }
  if(!wet&&!jazz&&!low){
   for(let k=0;k<meter*2;k++)add(at+k/2,.35,pitch(chord+[0,2,4,2][k%4],classic?0:1),classic?'piano':id==='chinatown'?'pluck':'bell',id==='cosmos'?.055:.025,k%2?.45:-.45);
  }
  if(id==='anthem')for(let k=0;k<8;k++){add(at+k*.5,.28,pitch(chord,-1),'guitar',.06,-.5);add(at+k*.5,.28,pitch(chord+4,-1),'guitar',.04,.5);}
  if(!classic){
   for(let k=0;k<meter;k++){
    if(k%2===0||id==='cosmos')add(at+k,.24,36,'kick',wet?.07:.23);
    if(k%2===1&&!wet)add(at+k,.2,42,'snare',heavy?.15:jazz?.035:.09,.1);
    if(!wet){add(at+k,.07,80,'hat',jazz?.025:.04,-.35);add(at+k+(jazz?2/3:.5),.06,80,'hat',.025,.35);}
   }
   if(bar%8===7&&!wet)for(let k=0;k<4;k++)add(at+meter-1+k*.25,.12,42,'snare',.07+k*.015,(k-1.5)*.15);
  }
 }
 return {bpm:a.bpm,beats:32*meter,notes:notes.sort((a,b)=>a.beat-b.beat)};
}
