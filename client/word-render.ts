import { WORD_FORM, WORD_RECTS, WORD_WIDTH, WORD_HEIGHT } from '../shared/word-blocks';
import type { World } from '../shared/physics';

export function drawWords(g:CanvasRenderingContext2D,w:World) {
  for(const b of w.words){
    const age=w.tick-b.born,form=b.solid?1:Math.min(1,age/WORD_FORM),left=b.expires-w.tick;
    g.save();
    const cx=b.x+WORD_WIDTH/2,cy=b.y+WORD_HEIGHT/2;
    if(form<1){
      const p=1-Math.pow(1-form,3);
      g.translate(b.mouthX+(cx-b.mouthX)*p,b.mouthY+(cy-b.mouthY)*p);
      g.scale(.08+.92*p,.08+.92*p);g.translate(-cx,-cy);
    }
    g.globalAlpha=b.solid?(left<150?.55+.45*Math.abs(Math.sin(left*.13)):1):.45+.35*form;
    for(const r of WORD_RECTS){
      const x=b.x+r.x,y=b.y+r.y;
      g.fillStyle=r.character===0?'#75232d':'#8e4c21';g.fillRect(x+2,y+3,r.w,r.h);
      g.fillStyle=r.character===0?'#ef6345':'#f1bb55';g.fillRect(x,y,r.w,r.h);
      g.fillStyle=r.character===0?'#ffb47b':'#fff0ac';g.fillRect(x,y,r.w,2);
      g.fillStyle='#fff3b344';g.fillRect(x,y,2,r.h);
    }
    if(!b.solid){g.strokeStyle='#fff4b3';g.lineWidth=1;g.setLineDash([3,5]);for(const r of WORD_RECTS)g.strokeRect(b.x+r.x,b.y+r.y,r.w,r.h);g.setLineDash([]);}
    g.font='bold 11px system-ui';g.textAlign='center';g.fillStyle='#fff0b5';
    g.fillText(b.solid?`消えるまで ${Math.ceil(left/50)}秒`:'実体化中…',cx,b.y-10);
    g.restore();
    if(age<16){
      g.save();g.fillStyle='#ffe59c';g.globalAlpha=(1-age/16)*.8;
      for(let i=0;i<8;i++){
        const p=Math.min(1,(age+i*.7)/14),ox=Math.sin(i*2.4)*13,oy=Math.cos(i*1.7)*13;
        g.fillRect(b.mouthX+(cx-b.mouthX)*p+ox,b.mouthY+(cy-b.mouthY)*p+oy,3,3);
      }
      g.restore();
    }
  }
}
