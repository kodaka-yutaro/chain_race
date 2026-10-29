import {hammerImpulse} from './hammer';
import { TICK_RATE, type Input, type Runner, type World } from './physics';

export const WORD_CELL = 7;
export const WORD_WIDTH = 35 * WORD_CELL;
export const WORD_HEIGHT = 18 * WORD_CELL;
export const WORD_CHARGE = 18;
export const WORD_FORM = 8;
export const WORD_COOLDOWN = 300;
export const WORD_LIMIT = 1;
export const MINI_SIZE = 32;
export const MINI_COOLDOWN = 12;
export const MINI_LIMIT = 5;

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
  hitTick?:number;
  /** -1 means it remains until its owner removes it or leaves the course. */
  born:number; expires:number; solid:boolean; mouthX:number; mouthY:number;
}
export interface SpitState {
  charge:number; cooldown:number; prev:boolean; started:number; ax:number; ay:number; blockedUntil:number;
  miniCooldown:number; prevMini:boolean; spent?:boolean;
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
export const wordBoxSolid=(w:World,x:number,y:number,width:number,height:number,ignore:number|ReadonlySet<number>=-1)=>
  w.words.some(b=>b.solid&&(typeof ignore==='number'?b.id!==ignore:!ignore.has(b.id))&&wordBoxHit(b,x,y,width,height));

export interface WordCollision {
  staticRect(x:number,y:number,width:number,height:number):boolean;
  runnerBox(x:number,y:number,ignoreWord:number|ReadonlySet<number>):boolean;
}
function fits(w:World,b:WordBlock,collision:WordCollision,checkRunners:boolean) {
  if(rects(b).some(r=>collision.staticRect(b.x+r.x,b.y+r.y,r.w,r.h)||wordBoxSolid(w,b.x+r.x,b.y+r.y,r.w,r.h,b.id)))return false;
  return !checkRunners||!w.runners.some(t=>runnerHit(b,t));
}
function bounds(t:Runner){return {half:t.ability==='bicycle'?30:14,bottom:t.ability==='bicycle'?40:t.hammerBrace?31:14};}
function runnerHit(b:WordBlock,t:Runner,x=t.x,y=t.y){const r=bounds(t);return wordBoxHit(b,x-r.half,y-14,r.half*2,r.bottom+14);}
function standing(b:WordBlock,t:Runner) {
  return rects(b).some(r=>Math.abs(t.y+bounds(t).bottom-(b.y+r.y))<=3 && t.x+bounds(t).half-1>b.x+r.x && t.x-bounds(t).half+1<b.x+r.x+r.w);
}
function move(w:World,b:WordBlock,dx:number,dy:number,collision:WordCollision) {
  const next={...b,x:b.x+dx,y:b.y+dy};
  if(!fits(w,next,collision,false))return false;
  const carried=new Map<Runner,{x:number;y:number}>();
  for(const t of w.runners)if(standing(b,t)||runnerHit(next,t))carried.set(t,{x:t.x+dx,y:t.y+dy});
  for(const [t,p] of carried){
    const box=bounds(t);if(collision.staticRect(p.x-box.half,p.y-14,box.half*2,box.bottom+14)||wordBoxSolid(w,p.x-box.half,p.y-14,box.half*2,box.bottom+14,b.id)||collision.runnerBox(p.x,p.y,b.id)||runnerHit(next,t,p.x,p.y))return false;
    // A moving word must not squeeze a rider into a wall or another player.
    for(const o of w.runners){
      if(o===t)continue;
      const q=carried.get(o)??o;
      if(Math.hypot(p.x-q.x,p.y-q.y)<27.5 && Math.hypot(t.x-o.x,t.y-o.y)>=27.5)return false;
    }
  }
  const carriedBalls=w.balls.filter(o=>o.carriedBy===undefined&&!(o.respawnAt&&o.respawnAt>w.tick)&&wordBoxHit(next,o.x-32,o.y-32,64,64));
  if(carriedBalls.some(o=>collision.staticRect(o.x+dx-32,o.y+dy-32,64,64)||wordBoxSolid(w,o.x+dx-32,o.y+dy-32,64,64,b.id)||wordBoxHit(next,o.x+dx-32,o.y+dy-32,64,64)))return false;
  for(const o of carriedBalls){o.x+=dx;o.y+=dy;}
  b.x=next.x;b.y=next.y;
  for(const [t,p] of carried){t.x=p.x;t.y=p.y;}
  return true;
}

/** Plan a whole chain first, then move it atomically. Walls and large words stay fixed. */
function moveMinis(w:World,roots:WordBlock[],dx:number,dy:number,collision:WordCollision,exclude?:Runner) {
  const group=new Set(roots),ids=new Set(roots.map(b=>b.id));
  for(const b of group){
    const next={...b,x:b.x+dx,y:b.y+dy};
    if(collision.staticRect(next.x,next.y,MINI_SIZE,MINI_SIZE))return false;
    for(const o of w.words){
      if(!o.solid||group.has(o)||!wordBoxHit(o,next.x,next.y,MINI_SIZE,MINI_SIZE))continue;
      if(o.kind!=='mini')return false;
      group.add(o);ids.add(o.id);
    }
  }
  const carried=new Map<Runner,{x:number;y:number}>();
  for(const t of w.runners){
    if(t===exclude)continue;
    if([...group].some(b=>standing(b,t)||runnerHit({...b,x:b.x+dx,y:b.y+dy},t)))
      carried.set(t,{x:t.x+dx,y:t.y+dy});
  }
  for(const [t,p] of carried){
    const box=bounds(t);if(collision.staticRect(p.x-box.half,p.y-14,box.half*2,box.bottom+14)||wordBoxSolid(w,p.x-box.half,p.y-14,box.half*2,box.bottom+14,ids)||collision.runnerBox(p.x,p.y,ids)||[...group].some(b=>runnerHit({...b,x:b.x+dx,y:b.y+dy},t,p.x,p.y)))return false;
    for(const o of w.runners){
      if(o===t)continue;
      const q=carried.get(o)??o;
      if(Math.hypot(p.x-q.x,p.y-q.y)<27.5&&Math.hypot(t.x-o.x,t.y-o.y)>=27.5)return false;
    }
  }
  for(const b of group){b.x+=dx;b.y+=dy;}
  for(const [t,p] of carried){t.x=p.x;t.y=p.y;}
  return true;
}

/** Walking and jumping can push minis; landing still treats them as a floor. */
export function pushMinis(w:World,t:Runner,nx:number,ny:number,collision:WordCollision) {
  const h=13.99;
  if(collision.staticRect(nx-h,ny-h,h*2,h*2))return false;
  if(w.words.some(b=>b.solid&&b.kind!=='mini'&&wordBoxHit(b,nx-h,ny-h,h*2,h*2)))return false;
  const roots=w.words.filter(b=>b.solid&&b.kind==='mini'&&wordBoxHit(b,nx-h,ny-h,h*2,h*2));
  return roots.length>0&&moveMinis(w,roots,nx-t.x,ny-t.y,collision,t);
}

function emitMini(w:World,t:Runner,ax:number,ay:number,collision:WordCollision):boolean {
  // All failed attempts roll back, including any boxes or riders in a push chain.
  const boxes=w.words.map(b=>({b,x:b.x,y:b.y}));
  const runners=w.runners.map(r=>({r,x:r.x,y:r.y}));
  const origin={x:t.x,y:t.y};
  const restore=()=>{for(const p of boxes){p.b.x=p.x;p.b.y=p.y;}for(const p of runners){p.r.x=p.x;p.r.y=p.y;}};
  const px=Math.abs(ax)>=Math.abs(ay)?Math.sign(ax)||1:0,py=px?0:Math.sign(ay)||-1;
  for(let back=0;back<=64;back++){
    restore();
    const x=origin.x-ax*back,y=origin.y-ay*back;
    // Check each successive retreat position: never materialize across a wall.
    if(collision.runnerBox(x,y,-1)||w.runners.some(o=>o!==t&&Math.hypot(x-o.x,y-o.y)<27.5))break;
    t.x=x;t.y=y;
    const b:WordBlock={id:w.wordSeq+1,owner:t.id,kind:'mini',x:x+ax*46-MINI_SIZE/2,y:y-4+ay*46-MINI_SIZE/2,
      vx:ax*3,vy:ay*3-.8,born:w.tick,expires:-1,solid:true,mouthX:x+ax*18,mouthY:y+ay*12};
    // Include the short path from the mouth, so a thin fixed stroke cannot be skipped.
    let fixed=false;
    for(let d=0;d<=16;d+=4){
      const sx=b.x-ax*d,sy=b.y-ay*d;
      if(collision.staticRect(sx,sy,MINI_SIZE,MINI_SIZE)||w.words.some(o=>o.solid&&o.kind!=='mini'&&wordBoxHit(o,sx,sy,MINI_SIZE,MINI_SIZE))){fixed=true;break;}
    }
    if(fixed)continue;
    for(let step=0;step<=MINI_SIZE;step++){
      const hits=w.words.filter(o=>o.solid&&wordBoxHit(o,b.x,b.y,MINI_SIZE,MINI_SIZE));
      if(!hits.length)break;
      if(hits.some(o=>o.kind!=='mini')||!moveMinis(w,hits,px,py,collision,t))break;
    }
    if(!fits(w,b,collision,true))continue;
    // Only replace after a successful placement, so a blocked attempt keeps all five.
    const owned=w.words.filter(o=>o.owner===t.id&&o.kind==='mini').sort((a,b)=>a.id-b.id);
    if(owned.length>=MINI_LIMIT){
      const remove=new Set(owned.slice(0,owned.length-MINI_LIMIT+1).map(o=>o.id));
      w.words=w.words.filter(o=>!remove.has(o.id));
    }
    w.wordSeq++;w.words.push(b);
    if(back){t.vx-=ax*3;t.vy-=ay*3;}
    return true;
  }
  restore();return false;
}

/** The normal hammer's short arc also transfers an impulse into loose boxes. */
export function hammerMinis(w:World,t:Runner,hx:number,hy:number) {
  for(const b of w.words){
    if(!b.solid||b.kind!=='mini')continue;
    const cx=Math.max(b.x,Math.min(b.x+MINI_SIZE,hx)),cy=Math.max(b.y,Math.min(b.y+MINI_SIZE,hy));
    if(Math.hypot(hx-cx,hy-cy)>22)continue;
    const impulse=hammerImpulse(b.x+MINI_SIZE/2-t.x,b.y+MINI_SIZE/2-t.y);
    b.vx=Math.max(-32,Math.min(32,b.vx+impulse.vx));
    b.vy=Math.max(-32,Math.min(32,b.vy+impulse.vy));b.hitTick=w.tick;
  }
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
      const onHead=w.runners.some(t=>!t.ghostBody&&Math.abs(b.y+MINI_SIZE-(t.y-14))<=1&&Math.abs(b.x+16-t.x)<22);
      const grounded=onHead||!fits(w,{...b,y:b.y+1},collision,false);
      b.vx*=grounded?.84:.99;
      if(Math.abs(b.vx)<.03)b.vx=0;
      b.vy=Math.min(10,b.vy+.45);
      // Small steps keep pulled blocks from passing through thin word strokes.
      const steps=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))/4));
      for(let n=0;n<steps;n++){
        if(b.vx&&!moveMinis(w,[b],b.vx/steps,0,collision))b.vx=0;
        if(b.vy>0){
          const head=w.runners.filter(t=>!t.ghostBody&&Math.abs(b.x+16-t.x)<22&&b.y+MINI_SIZE<=t.y-14+.01&&b.y+MINI_SIZE+b.vy/steps>=t.y-14).sort((a,c)=>a.y-c.y)[0];
          if(head){const dy=head.y-14-(b.y+MINI_SIZE);if(dy>0)moveMinis(w,[b],0,dy,collision);b.vy=0;continue;}
        }
        if(b.vy&&!moveMinis(w,[b],0,b.vy/steps,collision))b.vy=0;
      }
    }else{
      if(!move(w,b,b.vx,0,collision)&&!w.map.abilityMode)b.vx=-b.vx;
      if(b.vy&&!move(w,b,0,b.vy,collision)&&!w.map.abilityMode)b.vy=-b.vy;
    }
  }
}
/** Follow a head only while resting on it; launched or pulled boxes stay free. */
export function carryHeadMinis(w:World,before:Map<Runner,[number,number]>,collision:WordCollision){
  for(const b of w.words){
    if(b.kind!=='mini'||!b.solid||b.vy<0)continue;
    const support=w.runners.find(t=>{const p=before.get(t);return p&&!t.ghostBody&&Math.abs(b.y+32-(p[1]-14))<=1&&Math.abs(b.x+16-p[0])<22;});
    if(!support)continue;const old=before.get(support)!;
    moveMinis(w,[b],support.x-old[0],support.y-old[1],collision);
  }
}
export function stepSpit(w:World,t:Runner,input:Input,collision:WordCollision) {
  const s=t.spit,repeat=!!w.map.abilityMode,interval=Math.round(.6*TICK_RATE);
  if(repeat&&!input.spit){s.spent=false;s.charge=0;}
  if(s.cooldown>0)s.cooldown--;
  if(s.miniCooldown>0)s.miniCooldown--;
  if(input.clearWord){
    w.words=w.words.filter(b=>b.owner!==t.id||b.kind==='mini');
    s.charge=0;
  }
  if(!w.map.wordBlocks||t.stun>0){s.charge=0;s.prev=!!input.spit;s.prevMini=!!input.miniSpit;return;}
  if(input.miniSpit&&(repeat||!s.prevMini)&&!s.miniCooldown){
    const len=Math.hypot(t.aimX,t.aimY)||1,ax=t.aimX/len,ay=t.aimY/len;
    s.miniCooldown=repeat?interval:MINI_COOLDOWN;
    if(emitMini(w,t,ax,ay,collision))s.blockedUntil=0;
    else s.blockedUntil=w.tick+60;
  }
  if(s.charge>0){
    if(--s.charge===0){
      if(repeat)s.spent=true;
      const vertical=Math.abs(s.ay)>.85;
      const b:WordBlock={id:w.wordSeq+1,owner:t.id,
        x:vertical?t.x-WORD_WIDTH/2:s.ax>=0?t.x+30:t.x-30-WORD_WIDTH,
        y:vertical?(s.ay<0?t.y-30-WORD_HEIGHT:t.y+30):t.y+14-WORD_HEIGHT,
        vx:vertical?s.ax*1.15:(s.ax>=0?1.15:-1.15),vy:s.ay*1.15,
        born:w.tick,expires:-1,solid:false,mouthX:t.x+s.ax*18,mouthY:t.y+s.ay*12};
      const previous=w.words;
      if(repeat)w.words=w.words.filter(o=>o.owner!==t.id||o.kind==='mini');
      if(fits(w,b,collision,true)){w.wordSeq++;w.words.push(b);}
      else {w.words=previous;s.blockedUntil=w.tick+60;if(!repeat)s.cooldown=40;}

    }
  } else if(input.spit&&!input.clearWord&&(repeat?!s.spent:!s.prev)&&s.cooldown===0&&(repeat||w.words.filter(b=>b.owner===t.id&&b.kind!=='mini').length<WORD_LIMIT)){
    s.charge=WORD_CHARGE;s.cooldown=repeat?interval:WORD_COOLDOWN;s.started=w.tick;
    const len=Math.hypot(t.aimX,t.aimY)||1;s.ax=t.aimX/len;s.ay=t.aimY/len;
  }
  s.prev=!!input.spit;
  s.prevMini=!!input.miniSpit;
}
