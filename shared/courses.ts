import {musicId} from './music';
import {backgroundId} from './backgrounds';
import {blankDD} from './dd-parts';
import type { MapDef } from './physics';

export const COURSE_MAX_WIDTH=900, COURSE_MAX_HEIGHT=897;
export const COURSE_FILE_MAX_BYTES=32*1024*1024;

export interface Course {
  id: string;
  author: string;
  authorName: string;
  createdAt: number;
  status: 'prerelease' | 'released';
  map: MapDef;
  firstClear?: { uid?:string; names: string[]; time: number; at: number };
}
export const TILE_TOOLS = [
  ['.', '消す'], ['#', '岩壁'], ['X', '金属'], ['~', '凍結'], ['^', 'トゲ'],
  ['G','基本装備'],['P','幽霊'],['V','自転車'],['N','中華まん'],['o','赤いボール'],
  ['U','解凍'],['O','フック透過壁'],['J', 'バネ'], ['S', '出現'], ['>', 'スタート'], ['F', 'ゴール'],
  ...Array.from({ length: 5 }, (_, i) => [String(i + 1), `スイッチ${i + 1}`]),
  ...Array.from({ length: 5 }, (_, i) => [String.fromCharCode(97 + i), `扉${i + 1}`]),
  ...Array.from({ length: 5 }, (_, i) => [String.fromCharCode(65 + i), `橋${i + 1}`]),
];
export function validateCourseMap(value: unknown, playable = true): MapDef {
  const m = value as MapDef;
  if (!m || !Number.isInteger(m.width) || !Number.isInteger(m.height)
    || m.width < 20 || m.width > COURSE_MAX_WIDTH || m.height < 16 || m.height > COURSE_MAX_HEIGHT
    || !Array.isArray(m.tiles) || m.tiles.length !== m.height
    || m.tiles.some(r => typeof r !== 'string' || r.length !== m.width || /[^.#X~^JS>F1-5a-eA-EGHMVNoPUO]/.test(r))) throw new Error('コースのサイズかタイルが正しくありません');
  if (typeof m.name !== 'string' || (playable && !m.name.trim()) || m.name.length > 40) throw new Error('コース名を1〜40文字で入力してください');
  if (typeof m.description !== 'string' || m.description.length > 280) throw new Error('説明は280文字までです');
  const all = m.tiles.join('');
  if (playable && ([...all].filter(c => c === 'S').length !== 1 || !all.includes('>') || !all.includes('F'))) throw new Error('出現地点を1つ、スタートとゴールをそれぞれ置いてください');
  if (m.lifts?.length || m.saws?.length || m.zones?.length) throw new Error('このエディタで扱えない仕掛けが含まれています');
  const channels = Array.from({ length: 5 }, (_, i) => {
    const c = m.channels?.[i] ?? {};
    return { need: c.need === 2 ? 2 : 1, hold: Math.max(0, Math.min(500, Math.floor(Number(c.hold) || 0))) };
  });
  const dd=blankDD();
  if(m.dd){for(const key of ['game','front','tele','speed','switches','entities','doors'] as const){
    const rows=m.dd[key]??[];if(!Array.isArray(rows)||rows.length>m.width*m.height*2)throw Error('DDパーツが多すぎます');
    dd[key]=rows.map(row=>{if(!Array.isArray(row)||row.length!==({game:3,front:3,tele:3,speed:4,switches:5,entities:5,doors:6}[key])||row.some(n=>!Number.isFinite(n)||Math.abs(n)>Math.max(100000,m.width*m.height)))throw Error('DDパーツの設定が正しくありません');
      if(key!=='doors'&&(!Number.isInteger(row[0])||row[0]<0||row[0]>=m.width*m.height))throw Error('DDパーツがコース外にあります');if(key==='doors'&&(row[0]<0||row[0]>=m.width*32||row[1]<0||row[1]>=m.height*32||Math.hypot(row[2],row[3])<.001||row[4]<0||row[4]>Math.max(m.width,m.height)*32))throw Error('扉の設定が正しくありません');return [...row];});
  }}
  const hints=Array.isArray(m.hints)?m.hints.slice(0,64).map(h=>{
    if(!h||!Number.isFinite(h.x)||!Number.isFinite(h.y)||h.x<0||h.x>=m.width||h.y<0||h.y>=m.height||typeof h.text!=='string'||h.text.length>600)throw Error('看板の位置か文章が正しくありません');
    return {x:h.x,y:h.y,text:h.text};
  }):[];
  return { music:musicId(m.music),background:backgroundId(m.background),dd,id: '', name: m.name.trim(), description: m.description, minPlayers: Number.isInteger(m.minPlayers)&&m.minPlayers>=1&&m.minPlayers<=8?m.minPlayers:2,
    abilityMode:true,wordBlocks:true,
    width: m.width, height: m.height, tiles: [...m.tiles], hints, channels,
    ...(m.wordBlocks===true?{wordBlocks:true}:{}) };
}
export function validateCoursePreview(value:unknown):MapDef {
  const map=validateCourseMap(value,false);
  if([...map.tiles.join('')].filter(c=>c==='S').length!==1)throw Error('テストするには「出現」を1つ置いてください。スタート・ゴールは未配置でも試せます。');
  return {...map,name:map.name||'制作中のコース',minPlayers:1};
}
export function newCourseMap(width = 80, height = 30): MapDef {
  const rows: string[][] = Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) =>
    y === 0 || x === 0 || x === width - 1 ? 'X' : y >= height - 3 ? '#' : '.'));
  rows[height - 4][3] = 'S'; rows[height - 4][7] = '>'; rows[height - 4][width - 5] = 'F';
  return {music:'none',background:'dusk',dd:blankDD(), id: '', name: 'わたしのコース', description: '', minPlayers: 1, abilityMode:true,wordBlocks:true, width, height, tiles: rows.map(r => r.join('')), hints: [] };
}
export function canRelease(results: { id: number; name: string; time: number }[]): boolean {
  return results.length >= 2 && results.length <= 8 && new Set(results.map(r => r.id)).size === results.length
    && results.every(r => Number.isInteger(r.id) && typeof r.name === 'string' && r.name.length > 0 && Number.isFinite(r.time) && r.time >= 0);
}
