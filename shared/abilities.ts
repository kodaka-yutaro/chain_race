import type { Input, Runner, World } from './physics';
import { isSolidChar, tileAt, TILE } from './physics';
import { wordBoxSolid, type WordCollision } from './word-blocks';

export type Ability='hand'|'hook'|'hammer'|'bicycle'|'bun';
export const ABILITY_NAMES:Record<Ability,string>={hand:'マジックハンド',hook:'フック',hammer:'ハンマー',bicycle:'自転車',bun:'中華まん'};
export const ITEM_ABILITIES:Record<string,Ability>={G:'hand',H:'hook',M:'hammer',V:'bicycle',N:'bun'};
export const BALL_RADIUS=32, COLLECTION_RADIUS=320, BALL_GRAVITY=.4;
export interface Ball {carriedBy?:number;id:number;x:number;y:number;vx:number;vy:number;homeX:number;homeY:number}
export function metalPart(t:Runner){
  if(t.ability==='bicycle')return {x:t.x-30,y:t.y+14,w:60,h:26};
  if(t.hammerBrace)return {x:t.x-8,y:t.y+22,w:16,h:9};
  return null;
}
export function metalOverlap(w:World,x:number,y:number,width:number,height:number,ignore=-1){
  return w.runners.some(r=>{if(r.id===ignore)return false;const b=metalPart(r);return b&&x<b.x+b.w&&x+width>b.x&&y<b.y+b.h&&y+height>b.y;});
}
export function shotLaunch(t:Runner,dx=t.aimX*t.aimDistance,dy=t.aimY*t.aimDistance){
  const length=Math.hypot(dx,dy)||1,scale=Math.max(96,Math.min(960,length))/length;dx*=scale;dy*=scale;
  const side=dx>=0?1:-1,x=t.x+side*66,y=t.y-10;
  const frames=Math.max(18,Math.sqrt(Math.hypot(dx,dy)/BALL_GRAVITY)*1.6);
  return {x,y,vx:(t.x+dx-x)/frames,vy:(t.y+dy-y)/frames-BALL_GRAVITY*(frames+1)/2,frames};
}
export function ballStep(b:{x:number;y:number;vx:number;vy:number}){b.vy+=BALL_GRAVITY;b.x+=b.vx;b.y+=b.vy;}
export function shotPreview(w:World,t:Runner,collision:WordCollision){
  const b=shotLaunch(t),points=[{x:b.x,y:b.y}];
  for(let frame=0;frame<180;frame++){
    const before={...b};ballStep(b);
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))));
    for(let i=1;i<=n;i++){
      const x=before.x+(b.x-before.x)*i/n,y=before.y+(b.y-before.y)*i/n;
      if(collision.staticRect(x-32,y-32,64,64)||wordBoxSolid(w,x-32,y-32,64,64)||metalOverlap(w,x-32,y-32,64,64,t.id)){points.push({x,y});return points;}
    }
    points.push({x:b.x,y:b.y});
  }
  return points;
}
export function ballCount(w:World,id:number){return w.balls.filter(b=>b.carriedBy===id).length;}
function collectBall(w:World,t:Runner,b:Ball){
  b.carriedBy=t.id;b.vx=b.vy=0;
  for(const r of w.runners){if(r.held?.kind==='ball'&&r.held.id===b.id)r.held=null;if(r.wireBall===b.id){r.wireBall=-1;r.wireState=0;r.hookLengthLock=-1;}}
}
export const bodyBounds=(t:Runner)=>t.ability==='bicycle'?{left:30,top:14,bottom:40}:{left:14,top:14,bottom:14};

/** Bicycle geometry blocks narrow gaps, but hazards only touch the rider's 28px body. */
export function bicycleBlocked(w:World,x:number,y:number):boolean{
  for(let px=x-29.99;px<=x+30;px+=10)for(let py=y-13.99;py<=y+40;py+=9){
    if(isSolidChar(tileAt(w.map,Math.floor(px/TILE),Math.floor(py/TILE)),w.doorsOpen))return true;
  }
  for(const px of [x-29.99,x+29.99])for(const py of [y-13.99,y+39.99])
    if(isSolidChar(tileAt(w.map,Math.floor(px/TILE),Math.floor(py/TILE)),w.doorsOpen))return true;
  return wordBoxSolid(w,x-30,y-14,60,54);
}
export function bicycleFloor(w:World,x:number,y:number):boolean{
  const c=tileAt(w.map,Math.floor(x/TILE),Math.floor(y/TILE));return c==='~'||c==='^';
}
export function initBalls(w:World){
  for(let y=0;y<w.map.height;y++)for(let x=0;x<w.map.width;x++)if(w.map.tiles[y][x]==='o')
    w.balls.push({id:w.balls.length,x:x*TILE+16,y:y*TILE,vx:0,vy:0,homeX:x*TILE+16,homeY:y*TILE});
}
function blockedLine(w:World,ax:number,ay:number,bx:number,by:number){
  const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));
  for(let i=1;i<=steps;i++)if(isSolidChar(tileAt(w.map,Math.floor((ax+(bx-ax)*i/steps)/32),Math.floor((ay+(by-ay)*i/steps)/32)),w.doorsOpen))return true;
  return false;
}
export function abilityInput(w:World,t:Runner,raw:Input,collision:WordCollision):Input{
  if(!w.map.abilityMode)return raw;
  const aimLength=Math.hypot(raw.aimX,raw.aimY);t.aimDistance=Number.isFinite(aimLength)?Math.min(960,aimLength):160;if(aimLength>.0001){t.aimX=raw.aimX/aimLength;t.aimY=raw.aimY/aimLength;}
  for(let y=Math.floor((t.y-13)/32);y<=Math.floor((t.y+13)/32);y++)for(let x=Math.floor((t.x-13)/32);x<=Math.floor((t.x+13)/32);x++){
    const key=y*w.map.width+x,a=ITEM_ABILITIES[tileAt(w.map,x,y)];
    if(!a||a===t.ability||(w.pickups[key]??0)>w.tick)continue;
    const ny=t.y+(t.ability==='bicycle'?26:t.hammerBrace?17:0)-(a==='bicycle'?26:0);
    if(a==='bicycle'?bicycleBlocked(w,t.x,ny):collision.runnerBox(t.x,ny,-1))continue;
    t.y=ny;t.hammerBrace=false;t.ability=a;t.held=null;t.wireState=0;t.wireRunner=-1;t.wireWord=-1;t.wireBall=-1;t.spit.charge=0;
    w.pickups[key]=w.tick+150;
  }
  const pressed=raw.fire&&!t.actionDown,subPressed=raw.wire&&!t.subDown;t.actionDown=raw.fire;t.subDown=raw.wire;
  const brace=t.ability==='hammer'&&raw.wire&&t.stun===0;
  if(brace!==t.hammerBrace){
    const ny=t.y+(brace?-17:17);
    if(!collision.runnerBox(t.x,ny,-1)){t.y=ny;t.hammerBrace=brace;}
    else if(!brace)t.hammerBrace=false;
  }
  if(subPressed&&t.stun===0){
    if(t.ability==='hand'){t.gesture=(Math.imul(w.tick+1,1103515245)^(t.id*12345))>>>0;t.gesture%=3;t.gestureTick=w.tick;}
    if(t.ability==='bicycle'){t.wheelieTick=w.tick;for(const b of w.balls)if(b.carriedBy===undefined&&Math.hypot(b.x-t.x,b.y-t.y)<=COLLECTION_RADIUS)collectBall(w,t,b);}
  }
  if(t.stun>0)t.held=null;
  if(pressed&&t.stun===0&&t.ability==='hand'){
    if(t.held)t.held=null;
    else{
      const occupied=(kind:string,id:number)=>w.runners.some(r=>r.held?.kind===kind&&r.held.id===id);
      const candidates=[...w.balls.filter(b=>b.carriedBy===undefined).map(b=>({kind:'ball' as const,id:b.id,x:b.x,y:b.y})),
        ...w.words.filter(b=>b.solid&&b.kind==='mini').map(b=>({kind:'word' as const,id:b.id,x:b.x+16,y:b.y+16})),
        ...w.runners.filter(r=>r!==t&&!r.held).map(r=>({kind:'runner' as const,id:r.id,x:r.x,y:r.y}))]
        .filter(o=>!occupied(o.kind,o.id)&&Math.hypot(o.x-t.x,o.y-t.y)<75&&(o.x-t.x)*t.aimX+(o.y-t.y)*t.aimY>0&&!blockedLine(w,t.x,t.y,o.x,o.y))
        .sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y));
      if(candidates[0])t.held={kind:candidates[0].kind,id:candidates[0].id};
    }
  }
  if(t.stun===0&&t.ability==='bicycle'){
    if(w.tick-t.shotTick>15)for(const b of w.balls){
      if(b.carriedBy===undefined&&!w.runners.some(r=>r.wireState===2&&r.wireBall===b.id)&&Math.hypot(b.x-t.x,b.y-(t.y+24))<62&&!blockedLine(w,t.x,t.y,b.x,b.y))collectBall(w,t,b);
    }
    if(pressed){
      const b=w.balls.find(b=>b.carriedBy===t.id),launch=shotLaunch(t);
      if(b&&!blockedLine(w,t.x,t.y,launch.x,launch.y)&&!collision.staticRect(launch.x-32,launch.y-32,64,64)&&!wordBoxSolid(w,launch.x-32,launch.y-32,64,64)&&!metalOverlap(w,launch.x-32,launch.y-32,64,64,t.id)){
        delete b.carriedBy;Object.assign(b,{x:launch.x,y:launch.y,vx:launch.vx,vy:launch.vy});t.shotTick=w.tick;
      }
    }
  }
  return {...raw,left:raw.left&&!t.hammerBrace,right:raw.right&&!t.hammerBrace,jump:raw.jump&&!t.hammerBrace,wire:t.ability==='hook'&&(raw.fire||(raw.wire&&t.wireState===2)),fire:t.ability==='hammer'&&raw.fire&&!t.hammerBrace,
    spit:t.ability==='bun'&&(raw.fire||raw.spit),miniSpit:t.ability==='bun'&&(raw.wire||raw.miniSpit),clearWord:t.ability==='bun'&&raw.clearWord,weapon:undefined};
}
export function stepBalls(w:World,collision:WordCollision){
  for(const b of w.balls){
    if(b.carriedBy!==undefined){const rider=w.runners.find(r=>r.id===b.carriedBy&&r.ability==='bicycle');if(rider){b.x=rider.x;b.y=rider.y;continue;}delete b.carriedBy;b.x=b.homeX;b.y=b.homeY;b.vx=b.vy=0;}
    if(w.runners.some(r=>r.held?.kind==='ball'&&r.held.id===b.id))continue;
    b.vy+=BALL_GRAVITY;
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))));
    for(let i=0;i<n;i++){
      const nx=b.x+b.vx/n,ny=b.y+b.vy/n;
      if(!collision.staticRect(nx-32,b.y-32,64,64)&&!wordBoxSolid(w,nx-32,b.y-32,64,64)&&!metalOverlap(w,nx-32,b.y-32,64,64))b.x=nx;else b.vx*=-.65;
      if(!collision.staticRect(b.x-32,ny-32,64,64)&&!wordBoxSolid(w,b.x-32,ny-32,64,64)&&!metalOverlap(w,b.x-32,ny-32,64,64))b.y=ny;else {b.vy*=-.55;if(Math.abs(b.vy)<.8)b.vy=0;}
    }
    if(tileAt(w.map,Math.floor(b.x/32),Math.floor(b.y/32))==='^'){b.x=b.homeX;b.y=b.homeY;b.vx=b.vy=0;}
    for(const r of w.runners){
      if(r.held?.kind==='ball'&&r.held.id===b.id)continue;
      const cy=r.y+(r.ability==='bicycle'?24:0),dx=b.x-r.x,dy=b.y-cy,d=Math.hypot(dx,dy);
      if(d>0&&d<46){b.vx+=dx/d*.8+r.vx*.1;b.vy+=dy/d*.5;}
    }
  }
}
export function moveHeld(w:World,collision:WordCollision){
  for(const t of w.runners){
    if(!t.held||t.ability!=='hand'||t.stun){t.held=null;continue;}
    const h=t.held,o=h.kind==='ball'?w.balls.find(o=>o.id===h.id):h.kind==='word'?w.words.find(o=>o.id===h.id):w.runners.find(o=>o.id===h.id);
    if(!o){t.held=null;continue;}
    const x=t.x+t.aimX*70,y=t.y+t.aimY*70-(h.kind==='ball'?18:0),rad=h.kind==='ball'?32:16,offset=h.kind==='word'?16:0;
    if(blockedLine(w,t.x,t.y,x,y)||collision.staticRect(x-rad,y-rad,rad*2,rad*2)||wordBoxSolid(w,x-rad,y-rad,rad*2,rad*2,h.kind==='word'?h.id:-1)
      ||(h.kind==='runner'&&(o as Runner).ability==='bicycle'&&bicycleBlocked(w,x,y))){t.held=null;continue;}
    // Move in small steps so held objects cannot pass through walls when the aim turns.
    if(blockedLine(w,o.x+offset,o.y+offset,x,y)){t.held=null;continue;}
    o.x=x-offset;o.y=y-offset;o.vx=t.vx;o.vy=t.vy;
  }
}
