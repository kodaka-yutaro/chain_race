export const FACE_SIZE=24;
export const FACE_COLORS=['transparent','#f5c9a5','#191923','#d9304f','#f4c75b','#ffffff','#7b4b35','#449c99','#b791df','#86bc6c','#eb87a4','#5069ac','#222222','#a3d4ef','#f4eee0','#95543e'];
export function validFace(value:unknown):value is string {return typeof value==='string'&&value.length===FACE_SIZE*FACE_SIZE&&/^[0-9a-f]+$/.test(value);}
export function defaultFace():string {
  let out='';
  for(let y=0;y<FACE_SIZE;y++)for(let x=0;x<FACE_SIZE;x++){
    const dx=x-11.5,dy=y-12;let color='0';
    if(dx*dx+dy*dy<100)color='d';
    out+=color;
  }return out;
}
