import {paintBackground} from './backgrounds';
import {backgroundId} from '../shared/backgrounds';
import {areaKind} from './course-art';
import type {MapDef} from '../shared/physics';
/** One pixel per cell, scaled to fit the whole map without cropping. */
export function courseOverview(map:MapDef):HTMLCanvasElement{
 const source=document.createElement('canvas');source.width=map.width;source.height=map.height;
 const g=source.getContext('2d')!,pixels=g.createImageData(map.width,map.height);
 const colors:Record<string,number[]>={'.':[23,40,61],'#':[159,180,193],X:[82,105,132],'~':[65,96,123],U:[93,99,87],O:[152,98,57],'^':[245,105,117],S:[255,230,125],'>':[119,228,170],F:[255,195,92]};
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const i=(y*map.width+x)*4,c=colors[map.tiles[y][x]]??[187,146,219];pixels.data[i]=c[0];pixels.data[i+1]=c[1];pixels.data[i+2]=c[2];pixels.data[i+3]=map.tiles[y][x]==='.'?0:255;}
 g.putImageData(pixels,0,0);g.save();g.globalCompositeOperation='destination-over';paintBackground(g,backgroundId(map.background),map.width,map.height);g.restore();g.fillStyle='#c799e8';
 for(const k of ['game','front','tele','speed','switches','entities'] as const)for(const r of map.dd?.[k]??[]){const kind=areaKind(`dd:${k}:${r[1]}:0`);g.fillStyle=kind==='freeze'?'#41607b':kind==='thaw'?'#5d6357':kind==='mesh'?'#986239':kind==='entrance'?(r[3]===2?'#dc4e59':r[3]===1?'#c9cdd2':'#000'):kind==='exit'?(r[3]===2?'#dc4e59':r[3]===1?'#d7dce3':'#101d2c'):r[1]===243?'#ff828c':r[1]===240?'#ef535b':'#c799e8';g.fillRect(r[0]%map.width,Math.floor(r[0]/map.width),1,1);}
 g.strokeStyle='#ffd48b';for(const [x,y,dx,dy,len] of map.dd?.doors??[]){g.beginPath();g.moveTo(x/32,y/32);g.lineTo((x+dx*len)/32,(y+dy*len)/32);g.stroke();}
 source.className='course-overview';source.setAttribute('role','img');source.setAttribute('aria-label',`${map.name}のコース全体像（${map.width}×${map.height}マス）`);return source;
}
