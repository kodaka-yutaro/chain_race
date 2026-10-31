import type {Ability} from '../shared/abilities';
export const GUIDE_KEY='chainrace-ability-guide';
export function guideEnabled(){try{return localStorage.getItem(GUIDE_KEY)!=='off';}catch{return true;}}
export function saveGuide(enabled:boolean){try{localStorage.setItem(GUIDE_KEY,enabled?'on':'off');}catch{}}
export function abilityGuide(ability:Ability,flying=false){
 const guides:Record<Ability,string>={
  basic:'フック・ハンマー\n右長押し：フック　左：ハンマー\nA / D：移動　Space：2段ジャンプ',
  bicycle:'自転車\n右：円内の赤ボールを爆破・回収\n左：発射（マウスの向き・距離で調整）\nA / D：走行　Space：ジャンプ\n同じ方向に走り続けると加速',
  bun:'中華まん\n左長押し：大中華を出す（１人１個）\n左短押し：大中華の向きを変える\n右：小中華（１人５個）　X：大を消す\nA / D：移動　Space：2段ジャンプ',
  ghost:flying?'幽霊（離脱中）\nWASD：飛行　右長押し：フック\n左長押し：本体へ帰還\n霊体もテレポートに反応':'幽霊\n左長押し：本体を残して離脱\n左短押し：ハンマー　右長押し：フック\nA / D：移動　Space：2段ジャンプ',
  hand:'マジックハンド\n左：近くの物を持つ・離す\nA / D：移動　Space：ジャンプ',
  hook:'フック\n左長押し：フック　右：長さを固定\nA / D：移動　Space：ジャンプ',
  hammer:'ハンマー\n左：ハンマー　右：下向きに構える\nA / D：移動　Space：ジャンプ'
 };return guides[ability];
}
