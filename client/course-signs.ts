import type {MapDef} from '../shared/physics';
export function drawCourseSigns(g:CanvasRenderingContext2D,map:MapDef){
 g.save();
 for(const [index,h] of map.hints.entries()){
  const lines=h.text.split('\n'),width=372,height=64+Math.max(1,lines.length-1)*26;
  const x=h.x*32+16-width/2,y=h.y*32-20;
  g.fillStyle='#142b38';g.strokeStyle='#a8d5ce';g.lineWidth=2;g.beginPath();g.roundRect(x,y,width,height,12);g.fill();g.stroke();
  g.fillStyle='#dfba74';g.beginPath();g.roundRect(x+14,y+13,32,28,6);g.fill();
  g.font='bold 15px system-ui';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#172d38';g.fillText(String(index+1).padStart(2,'0'),x+30,y+27);
  g.textAlign='left';g.fillStyle='#fff0cb';g.font='bold 19px system-ui';g.fillText(lines[0],x+58,y+28,width-72);
  g.font='16px system-ui';g.fillStyle='#e3f0ef';lines.slice(1).forEach((line,i)=>g.fillText(line,x+20,y+64+i*26,width-40));
  g.strokeStyle='#759e9e';g.lineWidth=3;g.beginPath();g.moveTo(x+width/2,y+height);g.lineTo(x+width/2,y+height+22);g.stroke();
 }
 g.restore();
}
