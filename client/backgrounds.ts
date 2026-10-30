import {backgroundId,type BackgroundId} from '../shared/backgrounds';
import {drawDusk} from './dusk';

/** Original vector scenery, cached as independent depth layers during play. */
export function paintBackground(g:CanvasRenderingContext2D,id:BackgroundId,w:number,h:number,depth?:number){
 if(id==='dusk'){g.save();g.scale(w/1280,h/720);drawDusk(g,1280,720);g.restore();return;}
 g.save();g.scale(w/960,h/540);
 const layer=(n:number)=>{g.globalAlpha=depth===undefined||depth===n?1:0;};layer(0);
 const rect=(x:number,y:number,w:number,h:number,c:string)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
 const ellipse=(x:number,y:number,rx:number,ry:number,c:string)=>{g.fillStyle=c;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
 const line=(points:number[][],c:string,width=2)=>{g.strokeStyle=c;g.lineWidth=width;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();};
 const poly=(points:number[][],c:string)=>{g.fillStyle=c;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
 const sky=(top:string,bottom:string)=>{const a=g.createLinearGradient(0,0,0,540);a.addColorStop(0,top);a.addColorStop(1,bottom);g.fillStyle=a;g.fillRect(0,0,960,540);};
 const random=(n:number)=>{const v=Math.sin(n*127.1+31.7)*43758.5453;return v-Math.floor(v);};
 const hill=(base:number,height:number,color:string,phase:number)=>{const p=[[0,540]];for(let x=0;x<=980;x+=20)p.push([x,base+Math.sin(x*.007+phase)*height+Math.sin(x*.019)*height*.2]);p.push([960,540]);poly(p,color);};
 if(id==='morning'){
  sky('#6fa4bd','#f6deb1');ellipse(720,155,43,43,'#fff1c2');
  layer(1);for(const [x,y,k] of [[100,95,1],[390,150,.7],[800,66,.9]]){ellipse(x,y,95*k,12*k,'#e9e9dd99');ellipse(x+28,y-10,47*k,16*k,'#e9e9dd99');}
  hill(310,28,'#a0b8ab',1);layer(2);hill(365,37,'#749c92',3);layer(3);hill(440,28,'#3d746c',4);
  for(let i=0;i<10;i++){const x=i*113+20,y=460+random(i)*25;rect(x,y-44,4,90,'#345f59');poly([[x+2,y-96],[x-23,y-25],[x+27,y-25]],'#477d70');}
  layer(1);line([[195,167],[203,162],[211,167]],'#637f83');line([[220,153],[227,149],[234,153]],'#637f83');
 }else if(id==='marsh'){
  sky('#172e30','#667c61');layer(1);hill(270,22,'#344b45',3);rect(0,348,960,192,'#293f3d');
  layer(2);for(let i=0;i<15;i++){const x=i*79-20,y=280+random(i)*45;line([[x,370],[x+8,y-105],[x-3,y-220]],'#1d3330',8);line([[x+5,y-96],[x-26,y-151],[x-47,y-164]],'#1d3330',4);ellipse(x-2,y-166,60,34,'#30463c');for(let j=0;j<4;j++)line([[x+j*17-30,y-150],[x+j*17-34,y-102]],'#53664c',2);}
  layer(1);for(let i=0;i<38;i++){const x=random(i+40)*960,y=365+random(i+90)*145;ellipse(x,y,8+random(i)*19,2,'#63796766');}
  layer(3);for(let i=0;i<36;i++){const x=i*29,y=490+random(i)*50;line([[x,y],[x-5,y-42],[x-10,y-55]],'#142e2c',2);line([[x,y],[x+9,y-36]],'#142e2c',2);}
  layer(2);for(let i=0;i<5;i++)ellipse(110+i*210,310+i%2*40,180,13,'#b0b9a71b');
 }else if(id==='rome'){
  sky('#576c83','#d2a782');ellipse(770,135,48,48,'#ebd1a487');layer(1);hill(315,26,'#8c8582',1);
  // Repeating aqueduct, with the sky visible through its arches.
  rect(20,285,920,29,'#948b81');rect(20,278,920,7,'#b6a58c');
  for(let x=34;x<930;x+=94){rect(x,310,19,130,'#948b81');g.strokeStyle='#948b81';g.lineWidth=17;g.beginPath();g.arc(x+56,352,37,Math.PI,0);g.stroke();}
  layer(2);rect(58,440,315,16,'#a39784');rect(73,432,285,8,'#c0af94');
  for(let x=99;x<350;x+=48){rect(x,300,18,130,'#b7a68e');rect(x-5,295,28,9,'#cbbc9f');rect(x-4,422,26,9,'#cbbc9f');line([[x+6,308],[x+6,418]],'#948a79');}
  rect(75,279,280,15,'#baaa90');poly([[61,279],[215,209],[370,279]],'#c4b397');poly([[96,270],[215,224],[337,270]],'#948b80');
  layer(3);for(const x of [450,850,912]){rect(x,370,5,134,'#414d44');ellipse(x+2,365,16,75,'#465a4d');}hill(506,8,'#595f53',0);
 }else if(id==='nursery'){
  sky('#657789','#829398');for(let x=0;x<960;x+=64)rect(x,0,28,420,'#d9d3b50b');
  rect(0,414,960,13,'#b7ac95');rect(0,427,960,113,'#73665a');for(let y=446;y<540;y+=27)line([[0,y],[960,y]],'#514e4c',1);
  layer(1);rect(638,72,200,236,'#b7b49e');rect(648,82,180,216,'#afc6c4');rect(731,82,9,216,'#d4c9ac');rect(648,186,180,8,'#d4c9ac');poly([[617,66],[666,66],[663,321],[615,328]],'#9c8584');poly([[818,66],[865,66],[868,328],[822,321]],'#9c8584');
  rect(68,192,310,12,'#8c7e70');for(let i=0;i<7;i++)rect(87+i*24,145+random(i)*16,17,47-random(i)*16,['#9eaaa0','#b7a087','#a18480'][i%3]);
  layer(2);rect(76,263,262,147,'#8b8173');rect(88,277,238,57,'#9c9180');rect(88,343,238,56,'#9c9180');ellipse(207,305,5,5,'#5c6261');ellipse(207,370,5,5,'#5c6261');
  layer(3);ellipse(480,480,210,36,'#647d83');
  // Teddy bear and toy blocks.
  ellipse(415,398,25,32,'#a7957d');ellipse(415,358,25,24,'#b5a084');ellipse(395,339,10,11,'#b5a084');ellipse(435,339,10,11,'#b5a084');ellipse(415,365,11,9,'#d0bb98');ellipse(407,355,2,2,'#525653');ellipse(423,355,2,2,'#525653');
  for(let i=0;i<4;i++){rect(550+i*38,452-i%2*32,33,33,['#b99579','#8b9f93','#9a899e','#b6ac80'][i]);rect(556+i*38,458-i%2*32,21,21,'#ffffff13');}
  layer(2);line([[80,57],[290,87],[500,66]],'#aeb1a4');for(let i=0;i<8;i++)poly([[90+i*51,62+i%3*5],[117+i*51,65+i%3*5],[104+i*51,92+i%3*5]],['#b69e8c','#97ad9e','#a49bac'][i%3]);
 }else if(id==='chinatown'){
  sky('#17283f','#846b73');ellipse(785,100,28,28,'#dcc5a2');
  layer(1);for(let i=0;i<8;i++){const x=i*140-50,y=180+random(i)*90;rect(x,y,116,300,'#354453');rect(x+11,y+15,92,11,'#52606a');for(let r=0;r<4;r++)for(let c=0;c<3;c++)rect(x+13+c*31,y+40+r*48,14,22,'#c9a06438');}
  layer(2);rect(88,335,17,205,'#713d3d');rect(832,335,17,205,'#713d3d');rect(80,311,780,27,'#8d5550');rect(348,238,264,77,'#713f40');rect(369,253,222,43,'#2f3e4b');
  poly([[45,311],[91,287],[125,281],[815,281],[850,287],[892,311]],'#253d49');line([[45,311],[95,293],[850,293],[892,311]],'#b89967',3);
  poly([[311,240],[356,225],[390,208],[570,208],[604,225],[649,240]],'#29414b');line([[311,240],[366,230],[594,230],[649,240]],'#b89967',3);
  g.fillStyle='#c6aa77';g.font='bold 25px serif';g.textAlign='center';g.fillText('中 華 街',480,282);
  layer(3);line([[0,107],[240,158],[480,181],[720,155],[960,104]],'#9b8a6b',2);
  for(let i=0;i<9;i++){const x=35+i*110,y=122+Math.sin(i/8*Math.PI)*63;line([[x,y-15],[x,y+18]],'#ae9a69');ellipse(x,y+30,17,23,'#a6584d');line([[x-13,y+14],[x+13,y+14]],'#cfaa68',3);line([[x-13,y+46],[x+13,y+46]],'#cfaa68',3);line([[x,y+49],[x,y+65]],'#bb985b',2);}
 }else if(id==='spirals'){
  rect(0,0,960,540,'#090f1b');g.lineCap='round';
  for(let i=0;i<10;i++){const cx=(i%4)*280-25+random(i)*60,cy=Math.floor(i/4)*260+random(i+40)*45,r=72+random(i+9)*54;
   const points:number[][]=[];for(let j=0;j<240;j++){const t=j/239,a=t*Math.PI*5.5+i;const rr=r*t+Math.sin(j*.47+i)*1.3;points.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr*.88]);}line(points,['#674936','#79553b','#584331'][i%3],4+random(i)*3);
  }
 }else if(id==='dots'){
  rect(0,0,960,540,'#303338');for(let row=-1;row<8;row++)for(let col=-1;col<12;col++)ellipse(col*100+(row%2)*50,row*94,17,17,'#d4c78b');
 }else if(id==='space'){
  sky('#090c29','#24103e');
  layer(1);for(let i=0;i<7;i++){const x=i*170-50,y=310-Math.sin(i*.7)*160,r=160+random(i)*90,a=g.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,['#832ca65e','#1c94b451','#c5497755'][i%3]);a.addColorStop(1,'#00000000');g.fillStyle=a;g.fillRect(x-r,y-r,r*2,r*2);}
  layer(2);for(let i=0;i<200;i++){const x=random(i)*960,y=random(i+800)*540,r=.5+random(i+200)*1.4;ellipse(x,y,r,r,['#c7daf0','#e8bcdb','#b3dfe1'][i%3]);if(i%30===0){line([[x-5,y],[x+5,y]],'#deeaff66',1);line([[x,y-5],[x,y+5]],'#deeaff66',1);}}
  layer(3);ellipse(770,146,63,63,'#495c9d');g.save();g.translate(770,146);g.rotate(-.35);g.strokeStyle='#b199ba';g.lineWidth=8;g.beginPath();g.ellipse(0,0,104,21,0,0,Math.PI*2);g.stroke();g.restore();ellipse(135,419,35,35,'#9a636f');ellipse(121,410,10,7,'#754a64');
 }else if(id==='notebook'){
  rect(0,0,960,540,'#eeeae0');for(let y=34;y<540;y+=30)line([[0,y],[960,y]],'#c0cdd14d',1);line([[83,0],[83,540]],'#d3a9a36e',1.5);
  for(let y=55;y<540;y+=100){ellipse(28,y,8,8,'#d0cec5');ellipse(28,y-1,6,6,'#dad8cf');}
 }
 g.restore();
}
export const depthSpeeds=[0,.025,.065,.13] as const;
export function backgroundOffset(camX:number,depth:number,width:number){
 const distance=camX*depthSpeeds[depth];
 return ((distance%width)+width)%width;
}
const fixed=new Set<BackgroundId>(['spirals','dots','notebook']);
let cached:HTMLCanvasElement[]=[],cacheId:BackgroundId|undefined;
export function drawThemeBackground(g:CanvasRenderingContext2D,value:unknown,w:number,h:number,camX=0){
 const id=backgroundId(value);if(id==='dusk'){drawDusk(g,w,h,camX);return;}
 const isFixed=fixed.has(id);
 if(cacheId!==id){
  cached=Array.from({length:isFixed?1:4},(_,depth)=>{
   const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
   paintBackground(canvas.getContext('2d')!,id,1280,720,isFixed?undefined:depth);return canvas;
  });cacheId=id;
 }
 for(let depth=0;depth<cached.length;depth++){
  const canvas=cached[depth];
  if(isFixed||depth===0){g.drawImage(canvas,0,0,w,h);continue;}
  // Reflected tiles join exactly at their edges, including when the camera moves left.
  // The Chinatown sign is kept upright by repeating its self-contained gate instead.
  const mirrored=id!=='chinatown';
  const period=mirrored?w*2:w,offset=backgroundOffset(camX,depth,period);
  g.save();g.beginPath();g.rect(0,0,w,h);g.clip();
  for(let tile=0;tile<3;tile++){
   const x=tile*w-offset;if(x>=w||x+w<=0)continue;
   g.save();g.translate(x,0);
   if(mirrored&&tile%2===1){g.translate(w,0);g.scale(-1,1);}
   g.drawImage(canvas,0,0,w,h);g.restore();
  }
  g.restore();
 }
}
