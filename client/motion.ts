export type Point={x:number;y:number};
/** Render between completed physics steps; never change collision coordinates. */
export function renderPosition(previous:Point,current:Point,alpha:number):Point{
 if(Math.hypot(current.x-previous.x,current.y-previous.y)>128)return {...current};
 const t=Math.max(0,Math.min(1,alpha));
 return {x:previous.x+(current.x-previous.x)*t,y:previous.y+(current.y-previous.y)*t};
}
/** Same correction duration on 60 Hz, 144 Hz and irregular displays. */
export function correctionDecay(elapsedMs:number){return Math.pow(.85,Math.max(0,elapsedMs)/(1000/60));}
