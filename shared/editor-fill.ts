import type {MapDef} from './physics';

/** Return enclosed empty cells without changing the map. Reaching any edge cancels the fill. */
export function enclosedCells(map:MapDef,x:number,y:number):number[]{
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=map.width||y>=map.height)return [];
 const occupied=new Uint8Array(map.width*map.height);
 for(let cy=0;cy<map.height;cy++)for(let cx=0;cx<map.width;cx++)if(map.tiles[cy][cx]!=='.')occupied[cy*map.width+cx]=1;
 for(const key of ['game','front','tele','speed','switches','entities'] as const)for(const row of map.dd?.[key]??[])occupied[row[0]]=1;
 for(const row of map.dd?.doors??[])occupied[Math.floor(row[1]/32)*map.width+Math.floor(row[0]/32)]=1;
 const start=y*map.width+x;if(occupied[start])return [];
 const cells=[start];occupied[start]=1;
 for(let i=0;i<cells.length;i++){
  const cell=cells[i],cx=cell%map.width,cy=Math.floor(cell/map.width);
  if(cx===0||cy===0||cx===map.width-1||cy===map.height-1)return [];
  for(const next of [cell-1,cell+1,cell-map.width,cell+map.width])if(!occupied[next]){occupied[next]=1;cells.push(next);}
 }
 return cells;
}
