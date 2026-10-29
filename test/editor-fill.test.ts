import {test} from 'node:test';
import assert from 'node:assert/strict';
import {enclosedCells,extendCell} from '../shared/editor-fill';
import {newCourseMap} from '../shared/courses';
import {createWorld,newRunner,stepWorld,emptyInput,findSpawn,tileAt} from '../shared/physics';
import {ddTiles} from '../shared/ddrace';

test('塗りつぶしは閉じた空白だけを返し、開いた枠や既存パーツを変更しない',()=>{
 const m=newCourseMap(20,16);m.tiles=Array.from({length:16},()=>'.'.repeat(20));
 const rows=m.tiles.map(r=>[...r]);for(let x=2;x<=6;x++)rows[2][x]=rows[6][x]='#';for(let y=2;y<=6;y++)rows[y][2]=rows[y][6]='#';m.tiles=rows.map(r=>r.join(''));
 const before=JSON.stringify(m);assert.equal(enclosedCells(m,3,3).length,9);assert.equal(JSON.stringify(m),before);
 assert.deepEqual(enclosedCells(m,2,2),[]);assert.deepEqual(enclosedCells(m,0,0),[]);
 rows[2][4]='.';m.tiles=rows.map(r=>r.join(''));assert.deepEqual(enclosedCells(m,3,3),[]);
 m.dd!.game=[[2*20+4,1,0]];assert.equal(enclosedCells(m,3,3).length,9);
});
test('Kobraサイズの閉じた領域を再帰なしで調べられる',()=>{
 const m=newCourseMap(900,897);const cells=enclosedCells(m,1,1);assert.ok(cells.length>790000);
});
test('下端はトゲと同じ復帰処理で、左右と上端は壁のまま',()=>{
 for(const ability of ['basic','bicycle','ghost'] as const){
  const m=newCourseMap(20,16);m.tiles[15]='.'.repeat(20);const w=createWorld(m),r=newRunner(1,m);w.runners.push(r);r.ability=ability;r.x=300;r.y=16*32-10;r.vy=10;r.raceStart=1;
  if(ability==='ghost')r.ghostBody={x:200,y:300,vx:0,vy:0,stun:0};
  const ev=stepWorld(w,new Map([[1,emptyInput()]]));assert.deepEqual(ev.killed,[1]);assert.equal(r.x,findSpawn(m).x);assert.equal(r.raceStart,-1);assert.equal(r.ability,'basic');assert.equal(r.ghostBody,null);
  assert.equal(tileAt(m,2,16),'^');assert.equal(tileAt(m,-1,3),'X');assert.equal(tileAt(m,3,-1),'X');
 }
});
test('転送番号1と2の入口はそれぞれ同番号の出口へ移動する',()=>{
 const m=newCourseMap(30,20);m.dd!.tele=[[5*30+4,26,1],[5*30+8,26,2],[10*30+15,27,1],[12*30+22,27,2]];
 const w=createWorld(m),r=newRunner(1,m);w.runners.push(r);
 for(const [x,ex,ey] of [[4,15,10],[8,22,12]]){r.x=x*32+16;r.y=5*32+16;ddTiles(w,r);assert.equal(r.x,ex*32+16);assert.equal(r.y,ey*32+16);}
});

test('矢印延長は障害物の手前で止まり、番号付き転送パーツも複製する',()=>{
 const m=newCourseMap(20,16);m.tiles=Array.from({length:16},()=>'.'.repeat(20));
 m.tiles[4]='..#....X............';
 assert.equal(extendCell(m,2,4,1,0),4);assert.equal(m.tiles[4],'..#####X............');
 assert.equal(extendCell(m,2,4,-1,0),2);assert.equal(extendCell(m,2,4,1,0),0);
 m.dd!.tele=[[8*20+5,27,9]];m.dd!.game=[[8*20+8,1,0]];
 assert.equal(extendCell(m,5,8,1,0),2);assert.deepEqual(m.dd!.tele,[[165,27,9],[166,27,9],[167,27,9]]);
 assert.equal(extendCell(m,3,9,0,1),0);
 m.tiles[9]='...S................';assert.equal(extendCell(m,3,9,0,1),0);
});
