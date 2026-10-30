import {drawCourseArea,areaKind} from './course-art';
import {DD_PARTS} from '../shared/dd-parts';
import { ddCache, ddSwitchActive } from '../shared/ddrace';
import type { World } from '../shared/physics';

export function drawDD(g:CanvasRenderingContext2D,w:World,x0:number,y0:number,x1:number,y1:number) {
  if(!w.map.dd || !w.dd)return;
  const c=ddCache(w.map);
  g.save();g.font='bold 11px system-ui';g.textAlign='center';g.textBaseline='middle';
  for(let y=Math.max(0,y0);y<Math.min(w.map.height,y1);y++)for(let x=Math.max(0,x0);x<Math.min(w.map.width,x1);x++) {
    const idx=y*w.map.width+x,px=x*32,py=y*32;
    let text='',col='#74eddf';
    const tele=c.tele.get(idx);
    if(tele){text=(tele[1]===27?'出':tele[1]===15?'鉤':'転')+tele[2];col=tele[1]===27?'#88edaa':'#db8bff';}
    for(const row of [c.game.get(idx),c.front.get(idx)]) {
      if(!row)continue;
      const [,type,flags]=row;const part=DD_PARTS.find(p=>p.type===type&&p.layer==='game');if(part)text=part.name.slice(0,4);
      if(type===60){text=({0:'↓',8:'←',3:'↑',11:'→',2:'↑',10:'→',1:'↓',9:'←'} as Record<number,string>)[flags&11]??'止';col='#f1c56b';}
      if(type===62){text='止';col='#b3a8d1';}
      if(type===21)text='SOLO';if(type===22)text='DUO';
      if(type===17)text='鉤∞';if(type===18)text='鉤';
      if(type===105)text='跳∞';if(type===89)text='跳';
      if(type===106)text='JET';if(type===90)text='JET×';
      if(type===6){text='鉤→';col='#9ce2e9';}
      const pickup=({197:'武器×',199:'散',200:'爆',201:'忍',202:'光'} as Record<number,string>)[type];
      if(pickup){text=pickup;col='#ffe48b';}
      if(type>=35&&type<=59&&!text){text='CP'+(type-34);col='#90b5c6';}
    }
    const sw=c.switches.get(idx);
    if(sw&&sw[1]<190){text=sw[1]===7?'跳'+(sw[4]===255?'地':sw[4]):(sw[1]===25?'OFF':'ON')+sw[2];col='#ff9b87';}
    const speed=c.speed.get(idx);
    if(speed){text='加速';col='#86e5a1';}
    const entity=w.map.dd.entities?.find(row=>row[0]===idx);if(entity){text=DD_PARTS.find(p=>p.layer==='entities'&&p.type===entity[1])?.name.slice(0,3)??'装置';col='#ffb1a4';}
    const blocked=c.doorCells.get(idx)?.some(n=>ddSwitchActive(w,n));
    if(blocked){g.fillStyle='#f05ac168';g.fillRect(px,py,32,32);g.strokeStyle='#ff8bd5';g.strokeRect(px+2,py+2,28,28);}
    let spriteDrawn=false;
    if(!blocked&&!speed&&!entity){
      if(sw?.[1]===9)spriteDrawn=drawCourseArea(g,'dd:switches:9:0',px,py,32,String(sw[2]));
      else if(!sw){
        // Follow the same front-over-game-over-tele precedence as the tile labels.
        const front=c.front.get(idx),game=c.game.get(idx);
        const row=front??game??tele;
        const layer=front?'front':game?'game':'tele';
        if(row){const id=`dd:${layer}:${row[1]}:${layer==='tele'?0:row[2]}`;if(areaKind(id))spriteDrawn=drawCourseArea(g,id,px,py,32);}
      }
    }
    if(text&&!spriteDrawn){g.fillStyle='#101d32e8';g.fillRect(px+1,py+1,30,30);g.strokeStyle=col;g.lineWidth=1;g.strokeRect(px+2,py+2,28,28);g.fillStyle=col;g.fillText(text,px+16,py+16,28);}
  }
  for(const p of w.dd.shots){g.fillStyle=p.weapon===3?'#ffce70':'#e5f4ff';g.beginPath();g.arc(p.x,p.y,p.weapon===3?5:3,0,Math.PI*2);g.fill();}
  for(const b of w.dd.beams){g.strokeStyle=b.weapon===4?'#7ceeff':b.weapon===2?'#ffc879':'#ffb161';g.lineWidth=b.weapon===3?12:4;g.beginPath();g.moveTo(b.x,b.y);g.lineTo(b.ex,b.ey);g.stroke();}
  g.restore();
}
