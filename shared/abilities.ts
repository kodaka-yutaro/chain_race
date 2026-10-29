import type { Input, Runner, World } from './physics';
import { isSolidChar, tileAt, TILE } from './physics';
import { wordBoxSolid, type WordCollision } from './word-blocks';

export type Ability='hand'|'hook'|'hammer'|'bicycle'|'bun';
export const ABILITY_NAMES:Record<Ability,string>={hand:'マジックハンド',hook:'フック',hammer:'ハンマー',bicycle:'自転車',bun:'中華まん'};
export const ITEM_ABILITIES:Record<string,Ability>={G:'hand',H:'hook',M:'hammer',V:'bicycle',N:'bun'};
export interface Ball {id:number;x:number;y:number;vx:number;vy:number;homeX:number;homeY:number}
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
    w.balls.push({id:w.balls.length,x:x*TILE+16,y:y*TILE+16,vx:0,vy:0,homeX:x*TILE+16,homeY:y*TILE+16});
}
function blockedLine(w:World,ax:number,ay:number,bx:number,by:number){
  const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/4));
  for(let i=1;i<=steps;i++)if(isSolidChar(tileAt(w.map,Math.floor((ax+(bx-ax)*i/steps)/32),Math.floor((ay+(by-ay)*i/steps)/32)),w.doorsOpen))return true;
  return false;
}
export function abilityInput(w:World,t:Runner,raw:Input,collision:WordCollision):Input{
  if(!w.map.abilityMode)return raw;
  const aimLength=Math.hypot(raw.aimX,raw.aimY);if(aimLength>.0001){t.aimX=raw.aimX/aimLength;t.aimY=raw.aimY/aimLength;}
  for(let y=Math.floor((t.y-13)/32);y<=Math.floor((t.y+13)/32);y++)for(let x=Math.floor((t.x-13)/32);x<=Math.floor((t.x+13)/32);x++){
    const key=y*w.map.width+x,a=ITEM_ABILITIES[tileAt(w.map,x,y)];
    if(!a||a===t.ability||(w.pickups[key]??0)>w.tick)continue;
    const ny=t.y+(t.ability==='bicycle'?26:0)-(a==='bicycle'?26:0);
    if(a==='bicycle'?bicycleBlocked(w,t.x,ny):collision.runnerBox(t.x,ny,-1))continue;
    t.y=ny;t.ability=a;t.held=null;t.wireState=0;t.wireRunner=-1;t.wireWord=-1;t.wireBall=-1;t.spit.charge=0;
    w.pickups[key]=w.tick+150;
  }
  const pressed=raw.fire&&!t.actionDown;t.actionDown=raw.fire;
  if(t.stun>0)t.held=null;
  if(pressed&&t.stun===0&&t.ability==='hand'){
    if(t.held)t.held=null;
    else{
      const occupied=(kind:string,id:number)=>w.runners.some(r=>r.held?.kind===kind&&r.held.id===id);
      const candidates=[...w.balls.map(b=>({kind:'ball' as const,id:b.id,x:b.x,y:b.y})),
        ...w.words.filter(b=>b.solid&&b.kind==='mini').map(b=>({kind:'word' as const,id:b.id,x:b.x+16,y:b.y+16})),
        ...w.runners.filter(r=>r!==t&&!r.held).map(r=>({kind:'runner' as const,id:r.id,x:r.x,y:r.y}))]
        .filter(o=>!occupied(o.kind,o.id)&&Math.hypot(o.x-t.x,o.y-t.y)<75&&(o.x-t.x)*t.aimX+(o.y-t.y)*t.aimY>0&&!blockedLine(w,t.x,t.y,o.x,o.y))
        .sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y));
      if(candidates[0])t.held={kind:candidates[0].kind,id:candidates[0].id};
    }
  }
  if(pressed&&t.stun===0&&t.ability==='bicycle'){
    const b=w.balls.filter(b=>Math.hypot(b.x-t.x,b.y-(t.y+25))<85&&!blockedLine(w,t.x,t.y,b.x,b.y))
      .sort((a,b)=>Math.hypot(a.x-t.x,a.y-t.y)-Math.hypot(b.x-t.x,b.y-t.y))[0];
    if(b){b.vx=t.aimX*22+t.vx*.4;b.vy=t.aimY*22-3;t.shotTick=w.tick;}
  }
  return {...raw,wire:t.ability==='hook'&&raw.wire,fire:t.ability==='hammer'&&raw.fire,
    spit:t.ability==='bun'&&raw.spit,miniSpit:t.ability==='bun'&&raw.miniSpit,clearWord:t.ability==='bun'&&raw.clearWord,weapon:undefined};
}
export function stepBalls(w:World,collision:WordCollision){
  for(const b of w.balls){
    b.vy=Math.min(24,b.vy+.4);b.vx*=.994;
    const n=Math.max(1,Math.ceil(Math.max(Math.abs(b.vx),Math.abs(b.vy))));
    for(let i=0;i<n;i++){
      const nx=b.x+b.vx/n,ny=b.y+b.vy/n;
      if(!collision.staticRect(nx-9,b.y-9,18,18)&&!wordBoxSolid(w,nx-9,b.y-9,18,18))b.x=nx;else b.vx*=-.65;
      if(!collision.staticRect(b.x-9,ny-9,18,18)&&!wordBoxSolid(w,b.x-9,ny-9,18,18))b.y=ny;else {b.vy*=-.55;if(Math.abs(b.vy)<.8)b.vy=0;}
    }
    if(tileAt(w.map,Math.floor(b.x/32),Math.floor(b.y/32))==='^'){b.x=b.homeX;b.y=b.homeY;b.vx=b.vy=0;}
    for(const r of w.runners){
      if(r.held?.kind==='ball'&&r.held.id===b.id)continue;
      const cy=r.y+(r.ability==='bicycle'?24:0),dx=b.x-r.x,dy=b.y-cy,d=Math.hypot(dx,dy);
      if(d>0&&d<24){b.vx+=dx/d*.8+r.vx*.1;b.vy+=dy/d*.5;}
    }
  }
}
export function moveHeld(w:World,collision:WordCollision){
  for(const t of w.runners){
    if(!t.held||t.ability!=='hand'||t.stun){t.held=null;continue;}
    const h=t.held,o=h.kind==='ball'?w.balls.find(o=>o.id===h.id):h.kind==='word'?w.words.find(o=>o.id===h.id):w.runners.find(o=>o.id===h.id);
    if(!o){t.held=null;continue;}
    const x=t.x+t.aimX*48,y=t.y+t.aimY*48,rad=h.kind==='ball'?9:16,offset=h.kind==='word'?16:0;
    if(blockedLine(w,t.x,t.y,x,y)||collision.staticRect(x-rad,y-rad,rad*2,rad*2)||wordBoxSolid(w,x-rad,y-rad,rad*2,rad*2,h.kind==='word'?h.id:-1)
      ||(h.kind==='runner'&&(o as Runner).ability==='bicycle'&&bicycleBlocked(w,x,y))){t.held=null;continue;}
    // Move in small steps so held objects cannot pass through walls when the aim turns.
    if(blockedLine(w,o.x+offset,o.y+offset,x,y)){t.held=null;continue;}
    o.x=x-offset;o.y=y-offset;o.vx=t.vx;o.vy=t.vy;
  }
}
