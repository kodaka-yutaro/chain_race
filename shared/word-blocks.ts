import type { Input, Runner, World } from './physics';

export const WORD_CELL = 8;
export const WORD_WIDTH = 35 * WORD_CELL;
export const WORD_HEIGHT = 18 * WORD_CELL;
export const WORD_CHARGE = 18;
export const WORD_FORM = 8;
export const WORD_COOLDOWN = 300;
export const WORD_LIMIT = 1;
export const MINI_SIZE = 32;
export const MINI_COOLDOWN = 12;

// One shared pixel silhouette drives drawing AND collision. The counters in 中
// and the spaces between the strokes stay empty; no browser font is used at runtime.
export const WORD_PIXELS = [
  ['.......##.......','.......##.......','.......##.......','......###.......',
   '################','################','##.....##.....##','##.....##.....##',
   '##.....##.....##','###...###....###','################','################',
   '##.....##.....##','.......##.......','.......##.......','.......##.......',
   '.......##.......','.......##.......'],
  ['....##...##.....','################','################','....###..###....',
   '.....#....#.....','.##############.','...##..##..##...','...##..##..##...',
   '################','################','...##..##..##...','.##############.',
   '.##############.','.......##.......','################','.##############.',
   '.......##.......','.......##.......'],
];
export interface WordRect { x:number; y:number; w:number; h:number; character:number }
export const WORD_RECTS:WordRect[]=[];
for(let ch=0;ch<2;ch++)for(let y=0;y<18;y++){
  const row=WORD_PIXELS[ch][y];
  for(let x=0;x<16;){
    if(row[x]!== '#'){x++;continue;}
    const start=x;while(x<16&&row[x]==='#')x++;
    const rx=(start+ch*19)*WORD_CELL,rw=(x-start)*WORD_CELL;
    const above=WORD_RECTS.find(r=>r.character===ch&&r.x===rx&&r.w===rw&&r.y+r.h===y*WORD_CELL);
    if(above)above.h+=WORD_CELL;
    else WORD_RECTS.push({x:rx,y:y*WORD_CELL,w:rw,h:WORD_CELL,character:ch});
  }
}
export interface WordBlock {
  id:number; owner:number; x:number; y:number; vx:number; vy:number;
  kind?:'mini';
  /** -1 means it remains until its owner removes it or leaves the course. */
  born:number; expires:number; solid:boolean; mouthX:number; mouthY:number;
}
export interface SpitState {
  charge:number; cooldown:number; prev:boolean; started:number; ax:number; ay:number; blockedUntil:number;
  miniCooldown:number; prevMini:boolean;
}
export const newSpitState = ():SpitState => ({charge:0,cooldown:0,prev:false,started:-100,ax:1,ay:0,blockedUntil:0,miniCooldown:0,prevMini:false});
const MINI_RECTS:WordRect[]=[{x:0,y:0,w:MINI_SIZE,h:MINI_SIZE,character:0}];
const rects=(b:WordBlock)=>b.kind==='mini'?MINI_RECTS:WORD_RECTS;
const overlap=(ax:number,ay:number,aw:number,ah:number,bx:number,by:number,bw:number,bh:number)=>
  ax<bx+bw-.001&&ax+aw>bx+.001&&ay<by+bh-.001&&ay+ah>by+.001;
export function wordBoxHit(b:WordBlock,x:number,y:number,w:number,h:number) {
  if(b.kind==='mini')return overlap(x,y,w,h,b.x,b.y,MINI_SIZE,MINI_SIZE);
  if(!overlap(x,y,w,h,b.x,b.y,WORD_WIDTH,WORD_HEIGHT))return false;
  return WORD_RECTS.some(r=>overlap(x,y,w,h,b.x+r.x,b.y+r.y,r.w,r.h));
}
export function wordPoint(w:World,x:number,y:number):WordBlock|undefined {
  return w.words.find(b=>{
    if(!b.solid)return false;
    if(b.kind==='mini')return x>=b.x&&x<b.x+MINI_SIZE&&y>=b.y&&y<b.y+MINI_SIZE;
    const cx=Math.floor((x-b.x)/WORD_CELL),cy=Math.floor((y-b.y)/WORD_CELL);
    const ch=cx>=19?1:0,col=cx-ch*19;
    return cy>=0&&cy<18&&col>=0&&col<16&&WORD_PIXELS[ch][cy][col]==='#';
  });
}
export const wordBoxSolid=(w:World,x:number,y:number,width:number,height:number,ignore=-1)=>
  w.words.some(b=>b.solid&&b.id!==ignore&&wordBoxHit(b,x,y,width,height));

export interface WordCollision {
  staticRect(x:number,y:number,width:number,height:number):boolean;
  runnerBox(x:number,y:number,ignoreWord:number):boolean;
}
function fits(w:World,b:WordBlock,collision:WordCollision,checkRunners:boolean) {
  if(rects(b).some(r=>collision.staticRect(b.x+r.x,b.y+r.y,r.w,r.h)||wordBoxSolid(w,b.x+r.x,b.y+r.y,r.w,r.h,b.id)))return false;
  return !checkRunners||!w.runners.some(t=>wordBoxHit(b,t.x-14,t.y-14,28,28));
}
function standing(b:WordBlock,t:Runner) {
  return rects(b).some(r=>Math.abs(t.y+14-(b.y+r.y))<=3 && t.x+13>b.x+r.x && t.x-13<b.x+r.x+r.w);
}
function move(w:World,b:WordBlock,dx:number,dy:number,collision:WordCollision) {
  const next={...b,x:b.x+dx,y:b.y+dy};
  if(!fits(w,next,collision,false))return false;
  const carried=new Map<Runner,{x:number;y:number}>();
  for(const t of w.runners)if(standing(b,t)||wordBoxHit(next,t.x-14,t.y-14,28,28))carried.set(t,{x:t.x+dx,y:t.y+dy});
  for(const [t,p] of carried){
    if(collision.runnerBox(p.x,p.y,b.id)||wordBoxHit(next,p.x-14,p.y-14,28,28))return false;
    // A moving word must not squeeze a rider into a wall or another player.
    for(const o of w.runners){
      if(o===t)continue;
      const q=carried.get(o)??o;
      if(Math.hypot(p.x-q.x,p.y-q.y)<27.5 && Math.hypot(t.x-o.x,t.y-o.y)>=27.5)return false;
    }
  }
  b.x=next.x;b.y=next.y;
  for(const [t,p] of carried){t.x=p.x;t.y=p.y;}
  return true;
}
export function stepWords(w:World,collision:WordCollision) {
  if(!w.map.wordBlocks){w.words=[];return;}
  const owners=new Set(w.runners.map(t=>t.id));
  w.words=w.words.filter(b=>(b.expires<0||b.expires>w.tick)&&owners.has(b.owner)&&b.y<w.map.height*32+128);
  for(const b of w.words){
    if(!b.solid){
      if(w.tick-b.born>=WORD_FORM){
        if(fits(w,b,collision,true))b.solid=true;
        else if(w.tick-b.born>50){b.expires=w.tick;const t=w.runners.find(t=>t.id===b.owner);if(t)t.spit.blockedUntil=w.tick+60;}
      }
      continue;
    }
    if(b.kind==='mini'){
      const grounded=!fits(w,{...b,y:b.y+1},collision,false);
      b.vx*=grounded?.84:.99;
      if(Math.abs(b.vx)<.03)b.vx=0;
      b.vy=Math.min(10,b.vy+.45);
      // Small steps keep pulled blocks from passing through thin word strokes.
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))/4));
      for(let n=0;n<steps;n++){
        if(b.vx&&!move(w,b,b.vx/steps,0,collision))b.vx=0;
        if(b.vy&&!move(w,b,0,b.vy/steps,collision))b.vy=0;
      }
    }else{
      if(!move(w,b,b.vx,0,collision))b.vx=-b.vx;
      if(b.vy&&!move(w,b,0,b.vy,collision))b.vy=-b.vy;
    }
  }
}
export function stepSpit(w:World,t:Runner,input:Input,collision:WordCollision) {
  const s=t.spit;
  if(s.cooldown>0)s.cooldown--;
  if(s.miniCooldown>0)s.miniCooldown--;
  if(input.clearWord){
    w.words=w.words.filter(b=>b.owner!==t.id||b.kind==='mini');
    s.charge=0;
  }
  if(!w.map.wordBlocks||t.stun>0){s.charge=0;s.prev=!!input.spit;s.prevMini=!!input.miniSpit;return;}
  if(input.miniSpit&&!s.prevMini&&!s.miniCooldown){
    const len=Math.hypot(t.aimX,t.aimY)||1,ax=t.aimX/len,ay=t.aimY/len;
    const b:WordBlock={id:w.wordSeq+1,owner:t.id,kind:'mini',x:t.x+ax*46-MINI_SIZE/2,y:t.y-4+ay*46-MINI_SIZE/2,
      vx:ax*3,vy:ay*3-.8,born:w.tick,expires:-1,solid:false,mouthX:t.x+ax*18,mouthY:t.y+ay*12};
    if(fits(w,b,collision,true)){w.wordSeq++;w.words.push(b);s.miniCooldown=MINI_COOLDOWN;}
    else s.blockedUntil=w.tick+60;
  }
  if(s.charge>0){
    if(--s.charge===0){
      const vertical=Math.abs(s.ay)>.85;
      const b:WordBlock={id:w.wordSeq+1,owner:t.id,
        x:vertical?t.x-WORD_WIDTH/2:s.ax>=0?t.x+30:t.x-30-WORD_WIDTH,
        y:vertical?(s.ay<0?t.y-30-WORD_HEIGHT:t.y+30):t.y+14-WORD_HEIGHT,
        vx:vertical?s.ax*1.15:(s.ax>=0?1.15:-1.15),vy:s.ay*1.15,
        born:w.tick,expires:-1,solid:false,mouthX:t.x+s.ax*18,mouthY:t.y+s.ay*12};
      if(fits(w,b,collision,true)){w.wordSeq++;w.words.push(b);}
      else{s.blockedUntil=w.tick+60;s.cooldown=40;}
    }
  } else if(input.spit&&!input.clearWord&&!s.prev&&s.cooldown===0&&w.words.filter(b=>b.owner===t.id&&b.kind!=='mini').length<WORD_LIMIT){
    s.charge=WORD_CHARGE;s.cooldown=WORD_COOLDOWN;s.started=w.tick;
    const len=Math.hypot(t.aimX,t.aimY)||1;s.ax=t.aimX/len;s.ay=t.aimY/len;
  }
  s.prev=!!input.spit;
  s.prevMini=!!input.miniSpit;
}
