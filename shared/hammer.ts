/** Shared knockback for players and loose mini blocks. */
export function hammerImpulse(dx:number,dy:number){
  const distance=Math.hypot(dx,dy);
  if(distance>0){dx/=distance;dy/=distance;}else{dx=0;dy=-1;}
  dy-=1.1;
  const length=Math.hypot(dx,dy);
  return {vx:dx/length*10,vy:dy/length*10-1};
}
