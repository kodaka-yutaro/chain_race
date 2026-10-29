// Optional DDRace map mechanics. Original map indices remain available for audit.
// This is the KD engine adaptation, not a binary-compatible DDNet simulation.
import type { Input, MapDef, Runner, World } from './physics';

export interface DDMapData {
  entities?:number[][];game: number[][]; front: number[][]; tele: number[][]; speed: number[][];
  switches: number[][]; doors: number[][];
}
export interface DDRunner {
  deepFreeze?:boolean;liveFreeze?:boolean;noCollision?:boolean;noHook?:boolean;noHit?:boolean;teleCheckpoint?:number;solo: boolean; endlessHook: boolean; endlessJump: boolean; jetpack: boolean;
  jumps: number; usedJumps: number; weapon: number; weapons: number; cooldown: number;
  ninjaUntil: number; dash: number; dashX: number; dashY: number;
  hookBaseX: number; hookBaseY: number; checkpoint: number;
  hookTeleported: boolean;
}
export interface DDShot { owner: number; weapon: number; x: number; y: number; vx: number; vy: number; life: number }
export interface DDBeam { x: number; y: number; ex: number; ey: number; weapon: number; until: number }
export interface DDWorld {
  switches: Record<number, { on: boolean; until: number; after: boolean }>;
  shots: DDShot[]; beams: DDBeam[];
}
export const WEAPON_NAMES = ['ハンマー', 'ピストル', 'ショットガン', 'グレネード', 'レーザー', '忍者'];
export const newDDRunner = (): DDRunner => ({ solo: false, endlessHook: false, endlessJump: false, jetpack: false,
  jumps: 2, usedJumps: 0, weapon: 0, weapons: 3, cooldown: 0, ninjaUntil: 0, dash: 0, dashX: 0, dashY: 0,
  hookBaseX: 0, hookBaseY: 0, hookTeleported: false, checkpoint: -1 });
export const newDDWorld = (): DDWorld => ({ switches: {}, shots: [], beams: [] });

interface Cache {
  game: Map<number, number[]>; front: Map<number, number[]>; tele: Map<number, number[]>;
  switches: Map<number, number[]>; speed: Map<number, number[]>; exits: Map<number, number[]>;
  doorCells: Map<number, number[]>;
}
const caches = new WeakMap<MapDef, Cache>();
const indexAt = (m: MapDef, x: number, y: number) => Math.max(0, Math.min(m.height - 1, Math.floor(y / 32))) * m.width + Math.max(0, Math.min(m.width - 1, Math.floor(x / 32)));
const position = (m: MapDef, index: number) => ({ x: (index % m.width) * 32 + 16, y: Math.floor(index / m.width) * 32 + 16 });
const wall = (m: MapDef, x: number, y: number) => {
  const tx = Math.floor(x / 32), ty = Math.floor(y / 32);
  return tx < 0 || ty < 0 || tx >= m.width || ty >= m.height || '#XO'.includes(m.tiles[ty][tx]);
};
export function ddCache(m: MapDef): Cache {
  let c = caches.get(m); if (c) return c;
  const d = m.dd!;
  const entries = (a: number[][]) => new Map(a.map(row => [row[0], row]));
  c = { game: entries(d.game), front: entries(d.front), tele: entries(d.tele), switches: entries(d.switches), speed: entries(d.speed), exits: new Map(), doorCells: new Map() };
  for (const [idx, type, n] of d.tele) if (type === 27) c.exits.set(n, [...(c.exits.get(n) ?? []), idx]);
  for (const [x, y, dx, dy, length, n] of d.doors) {
    const len = Math.hypot(dx, dy), seen = new Set<number>();
    for (let s = 0; s < length - 1; s++) {
      const px = x + dx / len * s, py = y + dy / len * s;
      if (wall(m, px, py)) break;
      seen.add(indexAt(m, px, py));
    }
    for (const idx of seen) c.doorCells.set(idx, [...(c.doorCells.get(idx) ?? []), n]);
  }
  caches.set(m, c); return c;
}
export function ddInteracts(a: Runner, b: Runner) { return !a.dd?.solo && !b.dd?.solo; }
export function ddSwitchActive(w: World, n: number) { return w.dd?.switches[n]?.on ?? true; }

// Movement restrictions use the centre and four neighbouring tiles, as DDRace
// stoppers do. They stop movement, but do not stop a hook or weapon beam.
function restriction(type: number, flags: number) {
  if (type === 62) return 15;
  if (type === 61) return flags & 8 ? 5 : 10;
  if (type !== 60) return 0;
  return ({ 0: 2, 8: 4, 3: 8, 11: 1, 2: 8, 10: 1, 1: 2, 9: 4 } as Record<number, number>)[flags & 11] ?? 0;
}
export function ddRestrictions(w: World, x: number, y: number) {
  if (!w.map.dd) return 0;
  const c = ddCache(w.map); let mask = 0;
  for (const [dx, dy, side] of [[0,0,0],[18,0,1],[0,18,2],[-18,0,4],[0,-18,8]]) {
    const idx = indexAt(w.map, x + dx, y + dy);
    for (const row of [c.game.get(idx), c.front.get(idx)]) {
      if (!row) continue;
      const r = restriction(row[1], row[2]);
      mask |= side === 0 && row[1] === 60 ? r : r & side;
    }
    if (side && c.doorCells.get(idx)?.some(n => ddSwitchActive(w,n))) mask |= side;
  }
  return mask;
}
export function ddClamp(w: World, t: Runner) {
  const r = ddRestrictions(w,t.x,t.y);
  if ((r & 1 && t.vx > 0) || (r & 4 && t.vx < 0)) t.vx = 0;
  if ((r & 8 && t.vy < 0) || (r & 2 && t.vy > 0)) {
    if (t.vy > 0 && t.dd) { t.dd.usedJumps = 0; t.jumped &= ~2; }
    t.vy = 0;
  }
}
export function ddHookThrough(m: MapDef, x: number, y: number, dx: number, dy: number) {
  if (!m.dd) return false;
  const c = ddCache(m), idx = indexAt(m,x,y);
  if ([5,66].includes(c.front.get(idx)?.[1]??0)) return true;
  const behind = indexAt(m,x - (Math.abs(dx) > Math.abs(dy) ? Math.sign(dx)*32 : 0),y - (Math.abs(dx) <= Math.abs(dy) ? Math.sign(dy)*32 : 0));
  return c.front.get(behind)?.[1] === 6 || c.game.get(behind)?.[1] === 6;
}
export function ddHookExit(m: MapDef, x: number, y: number) {
  if (!m.dd) return;
  const c = ddCache(m), row = c.tele.get(indexAt(m,x,y));
  if (row?.[1] !== 15) return;
  const exit = c.exits.get(row[2])?.[0];
  if (exit !== undefined) return position(m,exit);
}

export function ddPressSwitch(w:World,idx:number){
  if(!w.dd)return;
  const sw=ddCache(w.map).switches.get(idx);if(!sw)return;
  const [,type,number,,delay]=sw;
  if([22,23,24,25].includes(type)&&number>0){const on=type===22||type===24;w.dd.switches[number]={on,until:type<24?w.tick+1+delay*50:0,after:!on};}
}
export function ddTiles(w: World, t: Runner, fromX = t.x, fromY = t.y, allowTeleport = true) {
  if (!t.dd || !w.dd) return;
  const d = t.dd, c = ddCache(w.map), n = Math.max(1,Math.ceil(Math.hypot(t.x-fromX,t.y-fromY)/8));
  const indices = new Set<number>();
  for (let s = 0; s <= n; s++) indices.add(indexAt(w.map,fromX+(t.x-fromX)*s/n,fromY+(t.y-fromY)*s/n));
  for (const idx of indices) {
    for (const row of [c.game.get(idx),c.front.get(idx)]) {
      const type = row?.[1];
      if(type===9)t.stun=150;if(type===11)t.stun=0;
      if(type===12)d.deepFreeze=true;if(type===13){d.deepFreeze=false;t.stun=0;}
      if(type===144)d.liveFreeze=true;if(type===145)d.liveFreeze=false;
      if(type===104)d.noCollision=true;if(type===88)d.noCollision=false;
      if(type===107)d.noHook=true;if(type===91)d.noHook=false;
      if(type===20)d.noHit=true;if(type===19)d.noHit=false;
      if(type===32){d.usedJumps=0;t.jumped&=~2;}
      if(type===16&&(wall(w.map,t.x-16,t.y)||wall(w.map,t.x+16,t.y))){d.usedJumps=0;t.jumped&=~2;}
      if (type === 17) d.endlessHook = true;
      if (type === 18) d.endlessHook = false;
      if (type === 21 && !d.solo) { d.solo = true; if(t.wireRunner>=0){t.wireState = 0; t.wireRunner = -1;} }
      if (type === 22) d.solo = false;
      if (type === 89) d.endlessJump = false;
      if (type === 105) d.endlessJump = true;
      if (type === 90) d.jetpack = false;
      if (type === 106) d.jetpack = true;
      if (type && type >= 35 && type <= 59) d.checkpoint = Math.max(d.checkpoint,type-35);
      if (type === 197) { d.weapons = 3; d.weapon = Math.min(d.weapon,1); d.ninjaUntil = 0; d.dash = 0; }
      const weapon = ({199:2,200:3,202:4,201:5} as Record<number,number>)[type ?? 0];
      if (weapon !== undefined) {
        if (!(d.weapons & 1 << weapon)) d.weapon = weapon;
        d.weapons |= 1 << weapon;
        if (weapon === 5) d.ninjaUntil = w.tick + 750;
      }
    }
    const sw = c.switches.get(idx);
    if (sw) {
      const [,type,number,,delay] = sw;
      if(type===9&&ddSwitchActive(w,number))t.stun=150;
      if (type === 7) d.jumps = delay === 255 ? -1 : delay;
      if ([22,23,24,25].includes(type) && number > 0) {
        const on = type === 22 || type === 24;
        w.dd.switches[number] = {on,until:type < 24 ? w.tick+1+delay*50 : 0,after:!on};
      }
    }
    const tele = c.tele.get(idx);
    if(tele?.[1]===29)d.teleCheckpoint=tele[2];
    if(allowTeleport&&tele&&[10,26,31,63].includes(tele[1])){
      const checkpoint=[31,63].includes(tele[1]);
      const exits=checkpoint?w.map.dd!.tele.filter(row=>row[1]===30&&row[2]===d.teleCheckpoint).map(row=>row[0]):c.exits.get(tele[2]);
      if(exits?.length){const p=position(w.map,exits[(w.tick+t.id)%exits.length]);t.x=p.x;t.y=p.y;
        if([10,63].includes(tele[1])){t.vx=t.vy=0;t.wireState=0;t.wireRunner=-1;for(const o of w.runners)if(o.wireRunner===t.id){o.wireState=0;o.wireRunner=-1;}}
        return;
      }
    }
  }
}

export function ddTick(w: World) {
  if (!w.dd) return;
  for (const s of Object.values(w.dd.switches)) if (s.until && w.tick >= s.until) { s.on=s.after; s.until=0; }
  w.dd.beams = w.dd.beams.filter(b => b.until > w.tick);
}
export function ddPrepare(w: World, t: Runner, input: Input) {
  if (!t.dd) return;
  const d = t.dd; ddTiles(w,t,t.x,t.y,false);
  if(d.deepFreeze||d.liveFreeze)t.stun=Math.max(t.stun,2);
  if (d.cooldown > 0) d.cooldown--;
  if (d.ninjaUntil && w.tick >= d.ninjaUntil) { d.weapons &= ~(1<<5); d.ninjaUntil=0; if(d.weapon===5)d.weapon=0; }
  if (Number.isInteger(input.weapon) && input.weapon! >= 0 && input.weapon! < 6 && d.weapons & 1 << input.weapon!) d.weapon=input.weapon!;
  const speed=ddCache(w.map).speed.get(indexAt(w.map,t.x,t.y));
  if(speed) {
    const [,force,max,angle]=speed, dx=Math.cos(angle*Math.PI/180),dy=Math.sin(angle*Math.PI/180);
    const add=max ? Math.max(0,Math.min(force,max/5-(t.vx*dx+t.vy*dy))) : force;
    t.vx+=dx*add; t.vy+=dy*add;
  }
}

function ray(m: MapDef, x: number, y: number, dx: number, dy: number, reach: number) {
  let px=x,py=y;
  for(let s=1;s<=reach;s+=2) {
    const nx=x+dx*s,ny=y+dy*s;
    if(wall(m,nx,ny)||(m.dd&&ddCache(m).game.get(indexAt(m,nx,ny))?.[1]===4)) return {x:px,y:py,hit:true,flipX:wall(m,nx,py),distance:s};
    px=nx;py=ny;
  }
  return {x:x+dx*reach,y:y+dy*reach,hit:false,flipX:false,distance:reach};
}
function segmentHit(x:number,y:number,ex:number,ey:number,t:Runner) {
  const dx=ex-x,dy=ey-y, len=dx*dx+dy*dy;
  const a=Math.max(0,Math.min(1,((t.x-x)*dx+(t.y-y)*dy)/(len||1)));
  return Math.hypot(x+a*dx-t.x,y+a*dy-t.y)<14 ? a : Infinity;
}
export function ddFire(w: World,t:Runner,input:Input): boolean {
  const d=t.dd;
  if(!d || d.weapon===0) return false;
  if(t.stun>0 || !input.fire || d.cooldown) return true;
  const wp=d.weapon;
  d.cooldown=wp===1?6:wp===5?40:25;
  if(wp===5) {d.dash=10;d.dashX=t.aimX;d.dashY=t.aimY;return true;}
  if(wp===1 || wp===3) {
    if(wp===1 && d.jetpack) {t.vx-=t.aimX*4;t.vy-=t.aimY*4;}
    w.dd!.shots.push({owner:t.id,weapon:wp,x:t.x+t.aimX*21,y:t.y+t.aimY*21,vx:t.aimX*(wp===1?44:20),vy:t.aimY*(wp===1?44:20),life:wp===1?100:100});
    return true;
  }
  let x=t.x,y=t.y,dx=t.aimX,dy=t.aimY,energy=wp===2?380:800;
  for(let bounce=0;bounce<=1;bounce++) {
    const hit=ray(w.map,x,y,dx,dy,energy);
    let target:Runner|undefined,nearest=Infinity;
    for(const o of w.runners) {
      if((o===t && bounce===0) || (o!==t && !ddInteracts(t,o)))continue;
      const a=segmentHit(x,y,hit.x,hit.y,o);
      if(a<nearest){nearest=a;target=o;}
    }
    const ex=target ? x+(hit.x-x)*nearest : hit.x, ey=target ? y+(hit.y-y)*nearest : hit.y;
    w.dd!.beams.push({x,y,ex,ey,weapon:wp,until:w.tick+8});
    if(target) {
      if(wp===4) target.stun=0;
      else {const len=Math.hypot(x-target.x,y-target.y)||1;target.vx+=(x-target.x)/len*10;target.vy+=(y-target.y)/len*10;}
      break;
    }
    if(!hit.hit)break;
    energy-=hit.distance;
    if(hit.flipX)dx=-dx;else dy=-dy;
    x=hit.x+dx*2;y=hit.y+dy*2;
  }
  return true;
}
export function ddMove(w:World,t:Runner) {
  if(!t.dd)return;
  const d=t.dd;
  if(d.dash>0) {
    d.dash--;t.vx=d.dashX*50;t.vy=d.dashY*50;
    for(const o of w.runners)if(o!==t&&ddInteracts(t,o)&&Math.hypot(o.x-t.x,o.y-t.y)<48){o.vy=-10;}
    if(d.dash===0){t.vx=d.dashX*10;t.vy=d.dashY*10;}
  }
  ddClamp(w,t);
}
export function ddProjectiles(w:World) {
  if(!w.dd)return;
  for(const row of w.map.dd?.entities??[]){
    const [idx,kind,number,angle,strength]=row;if(number&&!ddSwitchActive(w,number))continue;
    const p=position(w.map,idx),a=angle*Math.PI/180+(kind===1?w.tick*.01*Math.max(1,strength):0);
    const hit=ray(w.map,p.x,p.y,Math.cos(a),Math.sin(a),320);
    if(kind===1||kind===5){w.dd.beams.push({x:p.x,y:p.y,ex:hit.x,ey:hit.y,weapon:4,until:w.tick+1});for(const r of w.runners)if(segmentHit(p.x,p.y,hit.x,hit.y,r)<Infinity)r.stun=150;}
    else for(const r of w.runners){const dx=p.x-r.x,dy=p.y-r.y,d=Math.hypot(dx,dy);if(d>320||d<1)continue;
      if(ray(w.map,p.x,p.y,-dx/d,-dy/d,d).hit)continue;
      if(kind===3){r.vx+=dx/d*.15*Math.max(1,strength);r.vy+=dy/d*.15*Math.max(1,strength);}
      if(w.tick%60===0){if(kind===2)r.stun=150;if(kind===4){r.vx-=dx/d*14;r.vy-=dy/d*14;w.blasts.push({x:p.x,y:p.y,tick:w.tick,radius:160});}}
    }
  }
  const keep:DDShot[]=[];
  for(const p of w.dd.shots) {
    const owner=w.runners.find(t=>t.id===p.owner);
    if(!owner)continue;
    const speed=Math.hypot(p.vx,p.vy)||1,hit=ray(w.map,p.x,p.y,p.vx/speed,p.vy/speed,speed);
    const target=w.runners.find(t=>t!==owner&&ddInteracts(owner,t)&&segmentHit(p.x,p.y,hit.x,hit.y,t)<Infinity);
    p.x=hit.x;p.y=hit.y;
    const tele=ddCache(w.map).tele.get(indexAt(w.map,p.x,p.y));if(tele?.[1]===14){const exit=ddCache(w.map).exits.get(tele[2])?.[0];if(exit!==undefined){const pos=position(w.map,exit);p.x=pos.x;p.y=pos.y;}}
    p.life--;p.vy+=p.weapon===3?.56:.48;
    if(hit.hit||target||p.life<=0) {
      if(p.weapon===3) {
        for(const t of w.runners) {
          if(t!==owner&&!ddInteracts(owner,t))continue;
          const dx=t.x-p.x,dy=t.y-p.y,dist=Math.hypot(dx,dy);
          if(dist>=135)continue;
          const force=12*(1-Math.max(0,dist-48)/87);
          t.vx+=(dist?dx/dist:0)*force;t.vy+=(dist?dy/dist:-1)*force;
        }
        w.dd.beams.push({x:p.x-14,y:p.y-14,ex:p.x+14,ey:p.y+14,weapon:3,until:w.tick+6});
      }
    } else keep.push(p);
  }
  w.dd.shots=keep;
}
