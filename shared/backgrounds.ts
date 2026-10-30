export const BACKGROUNDS = [
 ['dusk','夕暮れ（いまの背景）'],['morning','朝'],['marsh','湿地'],['rome','古代ローマ'],['nursery','子供部屋'],
 ['chinatown','中華街'],['spirals','手描きの渦巻き'],['dots','みずたま'],['space','宇宙'],['notebook','ノート'],
] as const;
export type BackgroundId=typeof BACKGROUNDS[number][0];
export function backgroundId(value:unknown):BackgroundId{return BACKGROUNDS.some(([id])=>id===value)?value as BackgroundId:'dusk';}
