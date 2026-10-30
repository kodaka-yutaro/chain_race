import {ddCache,ballStopperBlocks} from './ddrace';
import type { Input, Runner, World } from './physics';
import { isSolidChar, tileAt, TILE } from './physics';
import { wordBoxSolid, type WordCollision } from './word-blocks';

export type Ability='basic'|'ghost'|'hand'|'hook'|'hammer'|'bicycle'|'bun';
export const ABILITY_NAMES:Record<Ability,string>={basic:'ハンマー＋フック',ghost:'幽霊',hand:'マジックハンド',hook:'フック',hammer:'ハンマー',bicycle:'自転車',bun:'中華まん'};
export const ITEM_ABILITIES:Record<string,Ability>={G:'basic',H:'basic',M:'basic',P:'ghost',V:'bicycle',N:'bun'};
export const BALL_RADIUS=32, COLLECTION_RADIUS=320, BALL_GRAVITY=.4;
export const SHOT_MAX_DISTANCE=1200, BLAST_RADIUS=192, BLAST_FORCE=32;
export interface Blast {x:number;y:number;tick:number;radius:number}
export interface Ball {teleLock?:boolean;respawnAt?:number;owner?:number;carriedBy?:number;id:number;x:number;y:number;vx:number;vy:number;homeX:number;homeY:number}
export function metalPart(t:Runner){
  if(t.ability==='bicycle')return {x:t.x-42,y:t.y-14,w:84,h:56};
  if(t.hammerBrace)return {x:t.x-8,y:t.y+22,w:16,h:9};
  return null;
}
export function metalOverlap(w:World,x:number,y:number,width:number,height:number,ignore=-1){
  return w.runners.some(r=>{if(r.id===ignore)return false;const b=metalPart(r);return b&&x<b.x+b.w&&x+width>b.x&&y<b.y+b.h&&y+height>b.y;});
}
export function shotLaunch(t:Runner,dx=t.aimX*t.aimDistance,dy=t.aimY*t.aimDistance){
  const length=Math.hypot(dx,dy)||1,scale=Math.max(96,Math.min(SHOT_MAX_DISTANCE,length))/length;dx*=scale;dy*=scale;
  const side=dx>=0?1:-1,x=t.x+side*80,y=t.y-10;
  const frames=Math.max(18,Math.sqrt(Math.hypot(dx,dy)/BALL_GRAVITY)*1.6);
  return {x,y,vx:(t.x+dx-x)/frames,vy:(t.y+dy-y)/frames-BALL_GRAVITY*(frames+1)/2,frames};
}
export function ballStep(b:{x:number;y:number;vx:number;vy:number}){b.vy+=BALL_GRAVITY;b.x+=b.vx;b.y+=b.vy;}
/** Sweep the full ball to its muzzle; a shot cannot appear beyond a thin wall or one-way tile. */
export function clearShotLaunch(w:World,t:Runner,collision:WordCollision):boolean {
  const target=shotLaunch(t),sx=t.x,sy=t.y-10,n=Math.max(1,Math.ceil(Math.hypot(target.x-sx,target.y-sy)));
  let x=sx,y=sy;
  for(let i=0;i<=n;i++){
    const nx=sx+(target.x-sx)*i/n,ny=sy+(target.y-sy)*i/n;
    if(ballStopperBlocks(w,x,y,nx,ny,BALL_RADIUS)||collision.staticRect(nx-32,ny-32,64,64)||wordBoxSolid(w,nx-32,ny-32,64,64)||metalOverlap(w,nx-32,ny-32,64,64,t.id))return false;
    x=nx;y=ny;
  }
  return true;
}
export function shotPreview(w:World,t:Runner,collision:WordCollision){
  const b=shotLaunch(t),points=[{x:b.x,y:b.y}];
  if(!clearShotLaunch(w,t,collision))return [{x:t.x,y:t.y-10}];
  for(let frame=0;frame<180;frame++){
    const before={...b};ballStep(b);
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))));
    for(let i=1;i<=n;i++){
      const x=before.x+(b.x-before.x)*i/n,y=before.y+(b.y-before.y)*i/n;
      if(ballStopperBlocks(w,before.x,before.y,x,y,32)||collision.staticRect(x-32,y-32,64,64)||wordBoxSolid(w,x-32,y-32,64,64)||metalOverlap(w,x-32,y-32,64,64,t.id)){points.push({x,y});return points;}
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
export function explodeOwned(w:World,owner:number){
  const rider=w.runners.find(r=>r.id===owner);
  if(!rider)return;
  // Range uses ball centers and deliberately ignores intervening walls.
  const bombs=w.balls.filter(b=>b.carriedBy===undefined&&!(b.respawnAt&&b.respawnAt>w.tick)&&Math.hypot(b.x-rider.x,b.y-rider.y)<=COLLECTION_RADIUS);
  for(const b of bombs){
    w.blasts.push({x:b.x,y:b.y,tick:w.tick,radius:BLAST_RADIUS});
    const push=(o:{x:number;y:number;vx:number;vy:number},offset=0)=>{const dx=o.x+offset-b.x,dy=o.y+offset-b.y,d=Math.hypot(dx,dy);if(d>=BLAST_RADIUS)return;const force=BLAST_FORCE*(1-d/BLAST_RADIUS);o.vx+=(d?dx/d:0)*force;o.vy+=(d?dy/d:-1)*force;};
    w.runners.forEach(r=>push(r));w.words.filter(o=>o.kind==='mini').forEach(o=>push(o,16));w.balls.filter(o=>o!==b&&o.carriedBy===undefined).forEach(o=>push(o));
    for(const r of w.runners){if(r.wireBall===b.id){r.wireState=0;r.wireBall=-1;}if(r.held?.kind==='ball'&&r.held.id===b.id)r.held=null;}

    b.vx=b.vy=0;delete b.owner;delete b.respawnAt;
    if(rider){collectBall(w,rider,b);b.x=rider.x;b.y=rider.y;}
  }
}
export const bodyBounds=(t:Runner)=>t.ability==='bicycle'?{left:42,top:14,bottom:42}:{left:14,top:14,bottom:14};

/** Bicycle geometry blocks narrow gaps, but hazards only touch the rider's 28px body. */
export function bicycleBlocked(w:World,x:number,y:number):boolean{
  for(let px=x-41.99;px<=x+42;px+=10)for(let py=y-13.99;py<=y+42;py+=9){
    if(isSolidChar(tileAt(w.map,Math.floor(px/TILE),Math.floor(py/TILE)),w.doorsOpen))return true;
  }
  for(const px of [x-41.99,x+41.99])for(const py of [y-13.99,y+41.99])
    if(isSolidChar(tileAt(w.map,Math.floor(px/TILE),Math.floor(py/TILE)),w.doorsOpen))return true;
  return wordBoxSolid(w,x-42,y-14,84,56);
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
  if(t.bodyOwner!==undefined)return {...raw,fire:false,wire:false,spit:false,miniSpit:false};
  if(!w.map.abilityMode)return raw;
  const aimLength=Math.hypot(raw.aimX,raw.aimY);t.aimDistance=Number.isFinite(aimLength)?Math.min(SHOT_MAX_DISTANCE,aimLength):160;if(aimLength>.0001){t.aimX=raw.aimX/aimLength;t.aimY=raw.aimY/aimLength;}
  for(let y=Math.floor((t.y-13)/32);y<=Math.floor((t.y+13)/32);y++)for(let x=Math.floor((t.x-13)/32);x<=Math.floor((t.x+13)/32);x++){
    const key=y*w.map.width+x,a=ITEM_ABILITIES[tileAt(w.map,x,y)];
    if(t.ghostBody)continue;
    if(!a||a===t.ability||(a!=='basic'&&(w.pickups[key]??0)>w.tick))continue;
    const ny=t.y+(t.ability==='bicycle'?28:t.hammerBrace?17:0)-(a==='bicycle'?28:0);
    if(a==='bicycle'&&w.runners.some(o=>o!==t&&!o.ghostBody&&t.x-42<o.x+14&&t.x+42>o.x-14&&ny-14<o.y+14&&ny+42>o.y-14))continue;
    if(a==='bicycle'?bicycleBlocked(w,t.x,ny):collision.runnerBox(t.x,ny,-1))continue;
    w.words=w.words.filter(b=>b.owner!==t.id);
    t.y=ny;t.hammerBrace=false;t.holdTicks=0;t.ability=a;t.held=null;t.wireState=0;t.wireRunner=-1;t.wireWord=-1;t.wireBall=-1;t.spit.charge=0;
    if(a==='basic')delete w.pickups[key];else w.pickups[key]=w.tick+150;
  }
  const released=!raw.fire&&t.actionDown,previousHold=t.holdTicks;
  t.holdTicks=raw.fire?t.holdTicks+1:0;
  const pressed=raw.fire&&!t.actionDown,subPressed=raw.wire&&!t.subDown;t.actionDown=raw.fire;t.subDown=raw.wire;
  const brace=t.ability==='hammer'&&raw.wire&&t.stun===0;
  if(brace!==t.hammerBrace){
    const ny=t.y+(brace?-17:17);
    if(!collision.runnerBox(t.x,ny,-1)){t.y=ny;t.hammerBrace=brace;}
    else if(!brace)t.hammerBrace=false;
  }
  if(subPressed&&t.stun===0){
    if(t.ability==='hand'){t.gesture=(Math.imul(w.tick+1,1103515245)^(t.id*12345))>>>0;t.gesture%=3;t.gestureTick=w.tick;}
    if(t.ability==='bicycle'){t.wheelieTick=w.tick;explodeOwned(w,t.id);}
  }
  if(t.stun>0)t.held=null;
  if(pressed&&t.stun===0&&t.ability==='hand'){
    if(t.held)t.held=null;
    else{
      const occupied=(kind:string,id:number)=>w.runners.some(r=>r.held?.kind===kind&&r.held.id===id);
      const candidates=[...w.balls.filter(b=>b.carriedBy===undefined&&!(b.respawnAt&&b.respawnAt>w.tick)).map(b=>({kind:'ball' as const,id:b.id,x:b.x,y:b.y})),
        ...w.words.filter(b=>b.solid&&b.kind==='mini').map(b=>({kind:'word' as const,id:b.id,x:b.x+16,y:b.y+16})),
        ...w.runners.filter(r=>r!==t&&!r.held).map(r=>({kind:'runner' as const,id:r.id,x:r.x,y:r.y}))]
        .filter(o=>!occupied(o.kind,o.id)&&Math.hypot(o.x-t.x,o.y-t.y)<75&&(o.x-t.x)*t.aimX+(o.y-t.y)*t.aimY>0&&!blockedLine(w,t.x,t.y,o.x,o.y))
        .sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y));
      if(candidates[0])t.held={kind:candidates[0].kind,id:candidates[0].id};
    }
  }
  if(t.stun===0&&t.ability==='bicycle'){
    if(w.tick-t.shotTick>15)for(const b of w.balls){
      if(b.carriedBy===undefined&&!(b.respawnAt&&b.respawnAt>w.tick)&&!w.runners.some(r=>r.wireState===2&&r.wireBall===b.id)&&Math.hypot(b.x-t.x,b.y-(t.y+24))<62&&!blockedLine(w,t.x,t.y,b.x,b.y))collectBall(w,t,b);
    }
    if(pressed){
      const b=w.balls.find(b=>b.carriedBy===t.id),launch=shotLaunch(t);
      if(b&&clearShotLaunch(w,t,collision)){
        delete b.carriedBy;b.owner=t.id;Object.assign(b,{x:launch.x,y:launch.y,vx:launch.vx,vy:launch.vy});t.shotTick=w.tick;
      }
    }
  }
  if(t.ability==='ghost'&&t.holdTicks===30&&(!t.stun||!!t.ghostBody)){
    if(t.ghostBody){if(collision.runnerBox(t.ghostBody.x,t.ghostBody.y,-1))return {...raw,fire:false,wire:raw.wire};t.x=t.ghostBody.x;t.y=t.ghostBody.y;t.stun=t.ghostBody.stun;if(t.dd&&t.ghostBody.teleCheckpoint!==undefined)t.dd.teleCheckpoint=t.ghostBody.teleCheckpoint;t.ghostBody=null;}
    else t.ghostBody={x:t.x,y:t.y,vx:0,vy:0,stun:0,...(t.dd?.teleCheckpoint!==undefined?{teleCheckpoint:t.dd.teleCheckpoint}:{})};
    t.vx=t.vy=0;t.wireState=0;t.wireRunner=t.wireBall=t.wireWord=-1;
  }
  if(t.ability==='bun'&&t.stun===0&&released&&previousHold<18){
    const b=w.words.find(b=>b.owner===t.id&&b.kind!=='mini');
    if(b){b.vx=t.aimX*2.9;b.vy=t.aimY*2.9;}
  }
  return {...raw,left:raw.left&&!t.hammerBrace,right:raw.right&&!t.hammerBrace,jump:raw.jump&&!t.hammerBrace,wire:(t.ability==='basic'||t.ability==='ghost')?raw.wire:t.ability==='hook'&&(raw.fire||(raw.wire&&t.wireState===2)),fire:t.ability==='basic'?raw.fire:t.ability==='ghost'?released&&previousHold<30:t.ability==='hammer'&&raw.fire&&!t.hammerBrace,
    spit:t.ability==='bun'&&((raw.fire&&t.holdTicks>=18)||raw.spit),miniSpit:t.ability==='bun'&&(raw.wire||raw.miniSpit),clearWord:t.ability==='bun'&&raw.clearWord,weapon:t.ability==='basic'?raw.weapon:undefined};
}
export function recoverBicycle(w:World,t:Runner){
  if(t.ability!=='bicycle'||!bicycleBlocked(w,t.x,t.y))return;
  const ox=t.x,oy=t.y;
  for(let radius=1;radius<=96;radius++)for(const [dx,dy] of [[0,-radius],[-radius,0],[radius,0],[0,radius],[-radius,-radius],[radius,-radius],[-radius,radius],[radius,radius]]){
    const x=ox+dx,y=oy+dy;if(!bicycleBlocked(w,x,y)&&!metalOverlap(w,x-42,y-14,84,56,t.id)&&!w.runners.some(o=>o!==t&&!o.ghostBody&&Math.abs(o.x-x)<56&&o.y+14>y-14&&o.y-14<y+42)){t.x=x;t.y=y;t.vx=t.vy=0;return;}
  }
  // A one-cell destination cannot fit a bike: retain the rider and release the equipment.
  t.ability='basic';t.bikeTicks=0;
}
function teleportBall(w:World,b:Ball,collision:WordCollision){
  if(!w.map.dd)return false;
  const c=ddCache(w.map);let portal:number[]|undefined;
  for(let y=Math.floor((b.y-31.99)/32);y<=Math.floor((b.y+31.99)/32);y++)for(let x=Math.floor((b.x-31.99)/32);x<=Math.floor((b.x+31.99)/32);x++){
    if(x<0||y<0||x>=w.map.width||y>=w.map.height)continue;const row=c.tele.get(y*w.map.width+x);if(row?.[1]===241)portal=row;
  }
  if(!portal){b.teleLock=false;return false;}if(b.teleLock)return false;
  const exits=c.exits.get(portal[2]);if(!exits?.length)return false;
  const idx=exits[(w.tick+b.id)%exits.length],x=(idx%w.map.width)*32+16,y=Math.floor(idx/w.map.width)*32+16;
  for(let r=0;r<=96;r++)for(const [dx,dy] of [[0,-r],[-r,0],[r,0],[0,r]]){const nx=x+dx,ny=y+dy;if(collision.staticRect(nx-32,ny-32,64,64)||wordBoxSolid(w,nx-32,ny-32,64,64)||metalOverlap(w,nx-32,ny-32,64,64))continue;
    b.x=nx;b.y=ny;b.teleLock=true;for(const t of w.runners)if(t.wireBall===b.id){t.wireState=0;t.wireBall=-1;}return true;
  }return false;
}
export function stepBalls(w:World,collision:WordCollision){
  w.blasts=w.blasts.filter(b=>w.tick-b.tick<30);
  for(const b of w.balls){
    if(b.respawnAt&&b.respawnAt>w.tick)continue;
    if(b.carriedBy!==undefined){const rider=w.runners.find(r=>r.id===b.carriedBy&&r.ability==='bicycle');if(rider){b.x=rider.x;b.y=rider.y;continue;}delete b.carriedBy;b.x=b.homeX;b.y=b.homeY;b.vx=b.vy=0;}
    if(w.runners.some(r=>r.held?.kind==='ball'&&r.held.id===b.id))continue;
    if(teleportBall(w,b,collision))continue;
    b.vy+=BALL_GRAVITY;
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))));
    for(let i=0;i<n;i++){
      if(teleportBall(w,b,collision))break;
      const nx=b.x+b.vx/n,ny=b.y+b.vy/n;
      if(ballStopperBlocks(w,b.x,b.y,nx,b.y,32)){b.vx=0;}
      else if(!collision.staticRect(nx-32,b.y-32,64,64)&&!wordBoxSolid(w,nx-32,b.y-32,64,64)&&!metalOverlap(w,nx-32,b.y-32,64,64))b.x=nx;else b.vx*=-.65;
      if(ballStopperBlocks(w,b.x,b.y,b.x,ny,32)){b.vy=0;}
      else if(!collision.staticRect(b.x-32,ny-32,64,64)&&!wordBoxSolid(w,b.x-32,ny-32,64,64)&&!metalOverlap(w,b.x-32,ny-32,64,64))b.y=ny;else {b.vy*=-.55;if(Math.abs(b.vy)<.8)b.vy=0;}
    }
    if(teleportBall(w,b,collision))continue;
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
    if(h.kind==='ball'){let blocked=false;const n=Math.max(1,Math.ceil(Math.hypot(x-o.x,y-o.y)));for(let i=1;i<=n;i++){const px=o.x+(x-o.x)*(i-1)/n,py=o.y+(y-o.y)*(i-1)/n,nx=o.x+(x-o.x)*i/n,ny=o.y+(y-o.y)*i/n;if(ballStopperBlocks(w,px,py,nx,ny,32)||collision.staticRect(nx-32,ny-32,64,64)||wordBoxSolid(w,nx-32,ny-32,64,64)||metalOverlap(w,nx-32,ny-32,64,64,t.id)){blocked=true;break;}}if(blocked){t.held=null;continue;}}
    o.x=x-offset;o.y=y-offset;o.vx=t.vx;o.vy=t.vy;
  }
}
