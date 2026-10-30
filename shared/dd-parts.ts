// ChainRace modified TypeScript adaptation of DDNet/DDRace/Teeworlds.
// Original authors and zlib terms: THIRD_PARTY_NOTICES.md and client/public/licenses/DDNet-zlib.txt.
import type {DDMapData} from './ddrace';
export interface DDPart {id:string;name:string;description:string;layer:keyof DDMapData;type:number;flags?:number}
export const DD_PARTS:DDPart[]=[];
function add(type:number,name:string,description:string,layer:keyof DDMapData='game',flags=0){DD_PARTS.push({id:`dd:${layer}:${type}:${flags}`,type,name,description,layer,flags});}
add(9,'凍結','一定時間操作できなくなる');add(11,'解凍','凍結を解除する');add(12,'永久凍結','解除タイルまで凍結が続く');add(13,'永久凍結解除','永久凍結を解除する');add(144,'入力凍結','移動入力が無効になる');add(145,'入力凍結解除','入力凍結を解除する');
add(16,'壁ジャンプ','壁際で空中ジャンプを回復');add(32,'ジャンプ回復','空中ジャンプを回復');add(105,'無限ジャンプON','空中で繰り返しジャンプ');add(89,'無限ジャンプOFF','通常のジャンプに戻す');add(17,'無限フックON','プレイヤーへのフック時間を無制限にする');add(18,'無限フックOFF','通常のフック時間に戻す');
add(21,'ソロON','他のプレイヤーとの衝突・フック・攻撃を無効化');add(22,'ソロOFF','協力状態に戻す');add(104,'衝突OFF','プレイヤー同士の衝突を無効化');add(88,'衝突ON','衝突を戻す');add(107,'対人フックOFF','他プレイヤーへのフックを無効化');add(91,'対人フックON','対人フックを戻す');add(20,'攻撃OFF','他プレイヤーへのハンマーを無効化');add(19,'攻撃ON','攻撃を戻す');
for(const [flags,name] of [[0,'下'],[8,'左'],[3,'上'],[11,'右']] as const)add(60,`${name}ストッパー`,`${name}方向の移動だけ止める`,'game',flags);
for(const [flags,name] of [[0,'下'],[8,'左'],[3,'上'],[11,'右']] as const)add(240,`${name}・ボール人ストッパー`,`${name}方向へのプレイヤーと赤ボールの移動を止める。逆方向は通過できる`,'game',flags);
add(61,'縦ストッパー','上下方向の移動を止める');add(61,'横ストッパー','左右方向の移動を止める','game',8);add(62,'全方向ストッパー','すべての移動を止める');
add(6,'フック透過補助','隣接する壁をフックが通過','front');add(66,'フック透過','フックが通り抜ける','front');add(4,'レーザー遮断','レーザーだけを遮る');
for(const [type,name,desc] of [[241,'ボール・人の転送入口','赤ボールとプレイヤーを同番号の出口へ転送'],[26,'テレポート入口','速度を維持して同番号の出口へ'],[10,'リセット入口','速度・フックを解除して出口へ'],[27,'テレポート出口','同番号の入口の行き先'],[15,'フック入口','フックだけ出口へ転送'],[14,'弾の入口','弾だけ出口へ転送'],[29,'テレチェック','復帰先の番号を記録'],[30,'チェック出口','記録された番号の復帰先'],[31,'チェック入口','記録された復帰先へ'],[63,'リセットチェック入口','速度をリセットして記録先へ']] as const)add(type,name,desc,'tele');
add(29,'加速板','角度・強さ・最高速度を指定して加速','speed');
for(const [type,name,desc] of [[24,'スイッチON','同番号のドアを有効にする'],[25,'スイッチOFF','同番号のドアを無効にする'],[22,'時限ON','指定秒数だけ有効'],[23,'時限OFF','指定秒数だけ無効'],[7,'ジャンプ回数','回数を設定（0でジャンプ不可）'],[9,'スイッチ凍結','有効な番号でのみ凍結']] as const)add(type,name,desc,'switches');
add(49,'スイッチドア','同番号のスイッチで開閉する壁','doors');
for(const [type,name] of [[199,'ショットガン'],[200,'グレネード'],[202,'レーザー'],[201,'忍者']] as const)add(type,name,'武器を取得。数字キーで選択');add(197,'追加武器解除','基本武器だけに戻す');add(106,'ジェットパックON','ピストルの反動で飛行');add(90,'ジェットパックOFF','ジェットパック解除');add(35,'タイムチェック','通過地点を記録');
add(1,'回転凍結レーザー','回転する線に触れると凍結。強さで回転速度','entities');add(2,'凍結砲台','範囲内のプレイヤーを周期的に凍結','entities');add(3,'引き寄せ装置','範囲内のプレイヤーを引く','entities');add(4,'反発砲台','周期的な爆風で押し出す','entities');add(5,'固定凍結レーザー','指定角度の線に触れると凍結','entities');
export function blankDD():DDMapData{return {game:[],front:[],tele:[],speed:[],switches:[],doors:[],entities:[]};}
