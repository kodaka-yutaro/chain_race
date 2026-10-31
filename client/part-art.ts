import {drawCourseArea,drawPickupArt,drawClothBall} from './course-art';
import { DD_PARTS } from '../shared/dd-parts';

// Simple original areas, generated pickups, and existing temporary fallback artwork.
export function drawPart(g: CanvasRenderingContext2D, id: string, x: number, y: number, size: number, badge?: string, angle = 0, teleColor = 0) {
  if(id==='o'){drawClothBall(g,x+size/2,y+size/2,size*.47);return;}
  if(drawCourseArea(g,id,x,y,size,badge,teleColor)||drawPickupArt(g,id,x,y,size))return;
  const part = DD_PARTS.find(p => p.id === id);
  let kind = id, color = '#9eacf0', mark = '', state = '';
  if (part) {
    const n = part.name;
    color = '#b3a0ed'; kind = 'symbol';
    mark = n.slice(0, 2);
    if (n.includes('凍結') || n.includes('解凍')) { kind = 'ice'; color = '#68d6f1'; }
    if (n.includes('解除') || n === '解凍') { color = '#f5c575'; state = '✓'; }
    if (n.includes('ジャンプ')) { kind = 'spring'; color = '#a6df84'; }
    if (n.includes('フック')) { mark = 'J'; color = '#81dccc'; }
    if (n.includes('ソロ')) mark = '1人';
    if (n.includes('衝突')) mark = '↔';
    if (n.includes('攻撃')) mark = '打';
    if (n.includes('ジェット')) mark = '噴';
    if (n.includes('ストッパー')) { kind = 'stop'; color = '#f5c575'; mark = n.startsWith('縦') ? '↕' : n.startsWith('横') ? '↔' : n.startsWith('全') ? '×' : ({下:'↓',上:'↑',左:'←',右:'→'}[n[0]] ?? '止'); }
    if (part.layer === 'tele') { kind = 'portal'; color = n.includes('出口') ? '#8be5ad' : '#ca9bff'; mark = n.includes('出口') ? '↗' : '↘'; }
    if (part.layer === 'speed') { kind = 'speed'; color = '#8be5ad'; }
    if (part.layer === 'switches') { kind = 'switch'; color = '#ffc175'; mark = n.includes('凍結') ? '❄' : n.includes('ジャンプ') ? '↑' : n.includes('時限') ? '◷' : ''; }
    if (part.layer === 'doors') { kind = 'door'; color = '#ffc175'; }
    if (part.layer === 'entities') { kind = 'device'; color = '#ff968a'; mark = ['','↻','❄','↙','✹','╱'][part.type] ?? '?'; }
    if (n.endsWith('ON')) state = '+';
    if (n.endsWith('OFF')) state = '−';
    if (n.includes('永久')) state = '∞';
    if (n.includes('入力')) state = '鍵';
  } else {
    const defs: Record<string, string[]> = {
      '#':['rock','#91b58a'], X:['metal','#aebdce'], '.':['erase','#94a3b8'], '~':['ice','#68d6f1'], U:['ice','#f5c575','✓'], '^':['spike','#ff8c9b'],
      G:['symbol','#f6d28b','⚒'], P:['ghost','#d2bbff'], V:['bike','#82d9df'], N:['bun','#ffe0a7'], o:['ball','#ff6579'],
      O:['metal','#88e4da','↔'], J:['spring','#a6df84'], S:['spawn','#ffd27d'], '>':['speed','#8be5ad'], F:['flag','#fff'],
    };
    if (defs[id]) [kind,color,mark=''] = defs[id];
    if (/^[1-5]$/.test(id)) { kind='switch'; color='#ffc175'; badge=id; }
    if (/^[a-e]$/.test(id)) { kind='door'; color='#ffc175'; badge=String(id.charCodeAt(0)-96); }
    if (/^[A-E]$/.test(id)) { kind='bridge'; color='#ffc175'; badge=String(id.charCodeAt(0)-64); }
  }
  g.save(); g.translate(x,y); g.scale(size/32,size/32);
  g.fillStyle='#17283d'; g.fillRect(0,0,31,31); g.strokeStyle=color; g.fillStyle=color; g.lineWidth=2; g.lineJoin='round'; g.lineCap='round';
  const line=(points:number[])=>{g.beginPath();g.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)g.lineTo(points[i],points[i+1]);g.stroke();};
  const circle=(cx:number,cy:number,r:number,fill=false)=>{g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);fill?g.fill():g.stroke();};
  const text=(s:string,px=16,py=16,font=16)=>{g.font=`bold ${font}px system-ui`;g.textAlign='center';g.textBaseline='middle';g.fillText(s,px,py,27);};
  if(kind==='rock'){g.fillRect(1,1,30,30);g.strokeStyle='#395545';line([1,11,31,11]);line([1,23,31,23]);line([10,1,10,11]);line([22,11,22,23]);line([12,23,12,31]);}
  else if(kind==='metal'){g.fillRect(2,2,28,28);g.strokeStyle='#41566d';g.strokeRect(5,5,22,22);line([7,24,24,7]);g.fillStyle='#253b50';for(const a of [6,26])for(const b of [6,26])circle(a,b,1.5,true);if(mark)text(mark);}
  else if(kind==='ice'){for(let i=0;i<3;i++){g.save();g.translate(16,16);g.rotate(i*Math.PI/3);line([-11,0,11,0]);line([6,-4,9,0,6,4]);line([-6,-4,-9,0,-6,4]);g.restore();}if(mark)text(mark);}
  else if(kind==='spike'){g.beginPath();g.moveTo(2,27);for(let i=0;i<3;i++){g.lineTo(6+i*10,5);g.lineTo(11+i*10,27);}g.closePath();g.fill();}
  else if(kind==='ball'){circle(16,16,12,true);g.fillStyle='#ffe0df';circle(12,11,3,true);}
  else if(kind==='spring'){line([5,27,27,27]);line([9,24,23,20,9,16,23,12]);line([16,16,16,3]);line([11,8,16,3,21,8]);}
  else if(kind==='portal'){circle(16,16,12);circle(16,16,9);text(mark);}
  else if(kind==='speed'){g.save();g.translate(16,16);g.rotate(angle*Math.PI/180);line([-10,-8,-2,0,-10,8]);line([1,-8,9,0,1,8]);g.restore();}
  else if(kind==='door'){g.strokeRect(5,3,22,26);line([12,4,12,28]);line([20,4,20,28]);}
  else if(kind==='switch'){g.strokeRect(3,22,26,6);g.fillRect(8,16,16,6);if(mark==='◷'){circle(12,8,6);line([12,4,12,8,16,10]);}else if(mark)text(mark,16,9,13);}
  else if(kind==='bridge'){line([2,21,30,21]);for(let a=5;a<30;a+=7)line([a,15,a,26]);}
  else if(kind==='flag'){line([7,28,7,3]);for(let a=0;a<4;a++)for(let b=0;b<3;b++){g.fillStyle=(a+b)%2?'#16191f':'#fff';g.fillRect(8+a*5,4+b*5,5,5);}}
  else if(kind==='spawn'){circle(16,10,5);line([7,27,7,23,12,18,20,18,25,23,25,27]);}
  else if(kind==='ghost'){g.beginPath();g.arc(16,13,10,Math.PI,0);g.lineTo(26,28);g.lineTo(20,24);g.lineTo(16,28);g.lineTo(11,24);g.lineTo(6,28);g.closePath();g.fill();g.fillStyle='#253047';circle(12,13,2,true);circle(20,13,2,true);}
  else if(kind==='bike'){circle(8,23,6);circle(25,23,5);line([8,23,13,12,20,23,8,23,19,14,25,23]);line([10,11,16,11]);line([19,14,19,8,24,8]);}
  else if(kind==='bun'){g.beginPath();g.ellipse(16,19,13,10,0,Math.PI,Math.PI*3);g.fill();g.strokeStyle='#bc8e5a';line([9,15,16,9,23,15]);line([16,9,16,16]);}
  else if(kind==='erase'){g.setLineDash([3,3]);g.strokeRect(4,4,24,24);g.setLineDash([]);line([10,10,22,22]);line([22,10,10,22]);}
  else {if(kind==='stop')g.strokeRect(3,3,26,26);if(kind==='device')circle(16,16,12);text(mark||id);}
  if(state){g.fillStyle='#102035';g.fillRect(19,0,13,12);g.fillStyle=color;text(state,25,6,11);}
  if(badge){g.fillStyle='#102035';g.fillRect(15,20,17,12);g.fillStyle='#fff';text(badge,23,26,10);}
  g.restore();
}
