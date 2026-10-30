import type {MapDef} from './physics';
export function waitingMap():MapDef {
  const width=80,height=30,rows:string[][]=Array.from({length:height},(_,y)=>Array.from({length:width},(_,x)=>x===0||x===width-1||y===0||y>=height-2?'#':'.'));
  rows[26][12]='S';for(const [x,tile] of [[22,'V'],[30,'N'],[38,'P'],[46,'G']] as const)rows[27][x]=tile;
  for(const x of [52,58,64])rows[26][x]='o';
  return {id:'waiting-room',name:'待機広場',description:'準備ができるまで自由に遊ぼう',minPlayers:1,width,height,tiles:rows.map(r=>r.join('')),hints:[],abilityMode:true,wordBlocks:true,music:'warmbass'};
}
