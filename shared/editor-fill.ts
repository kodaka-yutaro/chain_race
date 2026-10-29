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

/** Copy the selected cell through empty cells, stopping before any occupied layer or map edge. */
export function extendCell(map:MapDef,x:number,y:number,dx:number,dy:number):number{
 if(Math.abs(dx)+Math.abs(dy)!==1||x<0||y<0||x>=map.width||y>=map.height)return 0;
 const keys=['game','front','tele','speed','switches','entities'] as const;
 const idx=y*map.width+x,tile=map.tiles[y][x],parts=keys.flatMap(key=>(map.dd?.[key]??[]).filter(r=>r[0]===idx).map(row=>({key,row})));
 const doors=(map.dd?.doors??[]).filter(r=>Math.floor(r[0]/32)===x&&Math.floor(r[1]/32)===y);
 if(tile==='S'||tile==='.'&&!parts.length&&!doors.length)return 0;
 const occupied=new Set<number>();
 for(const key of keys)for(const row of map.dd?.[key]??[])occupied.add(row[0]);
 for(const row of map.dd?.doors??[])occupied.add(Math.floor(row[1]/32)*map.width+Math.floor(row[0]/32));
 let count=0;
 for(let cx=x+dx,cy=y+dy;cx>=0&&cy>=0&&cx<map.width&&cy<map.height;cx+=dx,cy+=dy){
  const to=cy*map.width+cx;if(map.tiles[cy][cx]!=='.'||occupied.has(to))break;
  map.tiles[cy]=map.tiles[cy].slice(0,cx)+tile+map.tiles[cy].slice(cx+1);
  for(const {key,row} of parts)(map.dd![key]??=[]).push([to,...row.slice(1)]);
  for(const row of doors)map.dd!.doors.push([row[0]+(cx-x)*32,row[1]+(cy-y)*32,...row.slice(2)]);
  count++;
 }
 return count;
}
