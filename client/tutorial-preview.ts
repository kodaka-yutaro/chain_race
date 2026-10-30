import raw from '../shared/tutorial-course.json';
import {validateCourseMap} from '../shared/courses';
import {registerCourse} from '../shared/maps';
import {ClientGame} from './game';
import {courseMusic} from './music';
const map=validateCourseMap(raw);map.id='tutorial-preview';registerCourse(map);
let game:ClientGame;
const nav=document.querySelector('nav')!,readout=document.querySelector('output')!;
function start(){game?.stop();game=new ClientGame(document.querySelector('canvas')!,map.id,1,{1:'プレビュー'},()=>{},()=>{});}
function select(index:number){nav.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));}
for(const [index,h] of map.hints.entries()){
 const button=document.createElement('button');button.textContent=`${index+1}. ${h.text.split('\n')[0]}`;button.onclick=()=>{select(index);game.focusCamera((h.x+.5)*32,(h.y+4)*32);game.zoomCamera(.9/game.cameraScale);readout.textContent='看板プレビュー · ドラッグ / WASDでカメラ移動 · ＋－で拡大縮小';};nav.append(button);
}
const goal=document.createElement('button');goal.textContent='ゴール';goal.onclick=()=>{const y=map.tiles.findIndex(r=>r.includes('F')),x=map.tiles[y].indexOf('F');select(7);game.focusCamera((x+.5)*32,(y+4)*32);game.zoomCamera(.9/game.cameraScale);readout.textContent='ゴール：黒白のチェック柄';};nav.append(goal);
const play=document.createElement('button');play.textContent='最初から遊ぶ';play.onclick=()=>{start();select(8);readout.textContent='A/D：移動 · SPACE：ジャンプ · 右クリック：フック · C：自由カメラ';};nav.append(play);
const link=document.querySelector<HTMLAnchorElement>('#download')!;link.href=URL.createObjectURL(new Blob([JSON.stringify(raw)],{type:'application/json'}));link.download='Basic-Operations-Room.json';
start();nav.querySelector('button')!.click();courseMusic.stop();
