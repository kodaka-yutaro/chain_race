/** Camera coordinates are independent from the player and simulation. */
export class ViewCamera {
  free=false;
  x=0;
  y=0;
  scale=1;
  toggle(x:number,y:number){this.free=!this.free;this.x=x;this.y=y;}
  follow(){this.free=false;}
  zoom(factor:number){this.scale=Math.max(.25,Math.min(3,this.scale*factor));}
  reset(){this.follow();this.scale=1;}
  pan(dx:number,dy:number){if(this.free){this.x+=dx;this.y+=dy;}}
  view(player:{x:number;y:number},width:number,height:number,viewWidth:number,viewHeight:number){
    const bound=(center:number,total:number,visible:number)=>visible>=total?(total-visible)/2:Math.max(0,Math.min(total-visible,center-visible/2));
    const x=bound(this.free?this.x:player.x,width,viewWidth),y=bound(this.free?this.y:player.y,height,viewHeight);
    if(this.free){this.x=x+viewWidth/2;this.y=y+viewHeight/2;}
    return {x,y};
  }
}

export function zoomKey(key:string,code:string){
  if(key==='+'||key==='＋'||code==='Equal'||code==='NumpadAdd')return 1.15;
  if(key==='-'||key==='－'||code==='Minus'||code==='NumpadSubtract')return 1/1.15;
  return 0;
}
