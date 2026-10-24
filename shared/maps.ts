import sunny from './dd-sunny.json';
import kobra from './dd-kobra.json';
import type { Channel, Lift, MapDef, Saw, Zone } from './physics';

// オリジナルのステージと、出典を記載したDDNet移植版。
class Builder {
  grid: string[][];
  hints: MapDef['hints'] = [];
  zones: Zone[] = [];
  lifts: Lift[] = [];
  saws: Saw[] = [];
  channels: Channel[] = [];
  constructor(public width: number, public height: number) {
    this.grid = Array.from({ length: height }, () => Array(width).fill('.'));
  }
  rect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) {
      if (i >= 0 && j >= 0 && i < this.width && j < this.height) this.grid[j][i] = c;
    }
    return this;
  }
  border() {
    this.rect(0, 0, this.width, 1, 'X');
    this.rect(0, 0, 1, this.height, 'X');
    this.rect(this.width - 1, 0, 1, this.height, 'X');
    return this;
  }
  hint(x: number, y: number, text: string) {
    this.hints.push({ x, y, text });
    return this;
  }
  zone(z: Zone) {
    this.zones.push(z);
    return this;
  }
  lift(l: Lift) {
    this.lifts.push(l);
    return this;
  }
  saw(s: Saw) {
    this.saws.push(s);
    return this;
  }
  /** スイッチ n（1〜5）の設定 */
  channel(n: number, c: Channel) {
    this.channels[n - 1] = c;
    return this;
  }
  build(meta: Omit<MapDef, 'width' | 'height' | 'tiles' | 'hints' | 'zones' | 'lifts' | 'saws' | 'channels'>): MapDef {
    this.border();
    return {
      ...meta, width: this.width, height: this.height, tiles: this.grid.map((r) => r.join('')), hints: this.hints,
      zones: this.zones.length ? this.zones : undefined,
      lifts: this.lifts.length ? this.lifts : undefined,
      saws: this.saws.length ? this.saws : undefined,
      channels: this.channels.length ? Array.from(this.channels, (c) => c ?? {}) : undefined,
    };
  }
}

function stage1(): MapDef {
  const b = new Builder(140, 30);
  b.rect(0, 26, 140, 4, '#');
  b.rect(3, 25, 1, 1, 'S');
  b.rect(7, 1, 1, 25, '>');
  b.rect(12, 23, 10, 3, '#');
  b.rect(28, 20, 6, 6, '#');
  b.rect(40, 26, 10, 2, '~');
  b.rect(56, 26, 40, 2, '~');
  b.rect(54, 14, 44, 2, '#');
  b.rect(100, 25, 2, 1, 'J');
  b.rect(104, 14, 4, 12, '#');
  b.rect(96, 6, 20, 2, '#');
  b.rect(128, 1, 1, 25, 'F');
  b.hint(3, 21, 'A/D 移動  Space ジャンプ')
    .hint(13, 19, '空中でもう一度 Space: 二段ジャンプ')
    .hint(27, 17, '高い段は二段ジャンプで登ろう')
    .hint(40, 22, 'しびれ床に注意  K: スタートからやり直し')
    .hint(60, 19, '右クリック長押し: フック。岩に掛けると引き寄せられる')
    .hint(96, 21, 'バネ床か、上の岩にフックを掛けて越えよう')
    .hint(124, 21, 'ゴール！');
  return b.build({
    id: 'hill', name: 'はじまりの丘', minPlayers: 1,
    description: '操作の練習ステージ。1人でもクリアできます。',
  });
}

function stage2(): MapDef {
  const b = new Builder(150, 30);
  b.rect(0, 0, 150, 12, 'X');
  b.rect(0, 26, 150, 4, 'X');
  b.rect(3, 25, 1, 1, 'S');
  b.rect(7, 12, 1, 14, '>');
  b.rect(14, 25, 6, 1, '~');
  // フックの回廊：天井は金属、ところどころ岩の支点
  b.rect(26, 24, 34, 2, '~');
  b.rect(26, 11, 36, 1, '.');
  for (const x of [29, 36, 43, 50, 57]) b.rect(x, 11, 3, 2, '#');
  // 低いトンネル
  b.rect(64, 12, 48, 8, 'X');
  b.rect(66, 20, 6, 2, '~');
  b.rect(80, 25, 4, 1, '~');
  b.rect(96, 20, 6, 2, '~');
  // 煙突（岩壁にはさまれた縦穴）
  b.rect(112, 2, 2, 18, '#');
  b.rect(114, 2, 4, 10, '.');
  b.rect(118, 8, 2, 18, '#');
  b.rect(118, 2, 31, 6, '.');
  b.rect(120, 8, 29, 18, 'X');
  b.rect(140, 2, 1, 6, 'F');
  b.hint(3, 21, '金属の壁と天井にはフックが掛からない')
    .hint(26, 21, '岩の支点にフックを掛けかえて渡ろう。仲間にフックを掛けて助けることもできる')
    .hint(66, 23, 'しびれのつららに注意')
    .hint(106, 23, '煙突は左右の岩壁にフックを掛けて登る');
  return b.build({
    id: 'cave', name: 'しびれ洞窟', minPlayers: 1,
    description: 'フックで渡る洞窟。仲間がいると落ちても助け合えます。',
  });
}

function stage3(): MapDef {
  const b = new Builder(176, 30);
  b.rect(0, 26, 176, 4, '#');
  b.rect(3, 25, 1, 1, 'S');
  b.rect(7, 1, 1, 25, '>');
  // 扉 A：どちら側のスイッチでも開く
  b.rect(24, 1, 2, 13, 'X');
  b.rect(24, 14, 2, 12, 'a');
  b.rect(17, 25, 3, 1, '1');
  b.rect(29, 25, 3, 1, '1');
  // 金属の塔：ハンマーで仲間を打ち上げ、上からフックで引き上げる
  b.rect(44, 14, 4, 12, 'X');
  // 扉 B：スイッチの1つは高い足場の上
  b.rect(60, 15, 6, 1, '#');
  b.rect(61, 14, 3, 1, '2');
  b.rect(72, 1, 2, 13, 'X');
  b.rect(72, 14, 2, 12, 'b');
  b.rect(77, 25, 3, 1, '2');
  // 光の橋：トゲの穴の上に、スイッチを踏んでいる間だけ橋が出る。低い金属の天井でジャンプでは越えられない
  b.rect(86, 13, 24, 11, 'X');
  b.rect(87, 26, 22, 1, 'C');
  b.rect(87, 27, 22, 1, '^');
  b.rect(82, 25, 3, 1, '3');
  b.rect(112, 25, 3, 1, '3');
  // 昇降リフト：スイッチを踏んでいる間だけ上がり、仲間を高い金属の壁の上へ運ぶ
  b.rect(117, 25, 3, 1, '4');
  b.rect(122, 26, 4, 1, '.');
  b.rect(126, 8, 2, 18, 'X');
  b.rect(131, 25, 3, 1, '4');
  b.lift({ x: 122, w: 4, top: 8, bottom: 26, ch: 4 });
  // 二人スイッチ：2人で踏むと扉が開き、離しても少しの間は開いている
  b.rect(144, 25, 3, 1, '5');
  b.rect(152, 1, 2, 13, 'X');
  b.rect(152, 14, 2, 12, 'e');
  b.channel(5, { need: 2, hold: 3 * 50 });
  b.rect(166, 1, 1, 25, 'F');
  b.hint(3, 21, '2人以上で協力するステージ')
    .hint(15, 21, 'スイッチを踏んでいる間だけ扉が開く')
    .hint(36, 19, '仲間を頭に乗せてジャンプし、左クリックのハンマーで打ち上げよう')
    .hint(36, 21, '上に着いたら、ジャンプした仲間にフックを掛けて引き上げる')
    .hint(56, 19, '足場の裏にフックを掛けて登ろう')
    .hint(88, 20, '光の橋: 青いスイッチを踏んでいる間だけ橋が現れる')
    .hint(88, 22, '渡った人は向こうのスイッチで、残った仲間に橋を架けよう')
    .hint(110, 19, '紫のスイッチを踏んでいる間、リフトが上がる')
    .hint(129, 21, '下りたら、こっちのスイッチで仲間を運ぼう')
    .hint(142, 17, '二人スイッチ: 2人で同時に踏むと扉が開く')
    .hint(142, 19, '離しても3秒は開いているので、急いでくぐろう')
    .hint(162, 21, 'ゴール！');
  return b.build({
    id: 'tower', name: 'ツナグの塔', minPlayers: 2,
    description: '2人以上が必要な協力ステージ。スイッチの扉、打ち上げと引き上げ、光の橋、昇降リフト、二人スイッチ。',
  });
}

function stage4(): MapDef {
  const b = new Builder(164, 30);
  b.rect(0, 26, 164, 4, '#');
  b.rect(3, 25, 1, 1, 'S');
  b.rect(7, 1, 1, 25, '>');
  // シーソーで仲間を高い棚へ飛ばす。棚と通路は金属なのでフックでは登れない
  b.saw({ x: 20, half: 4, top: 24 });
  b.rect(19, 25, 2, 1, 'X');
  b.rect(26, 9, 19, 2, 'X');
  b.rect(40, 8, 3, 1, '1');
  // 棚の上のスイッチで、下に残った仲間をリフトで運ぶ
  b.rect(45, 26, 4, 1, '.');
  b.lift({ x: 45, w: 4, top: 9, bottom: 26, ch: 1 });
  b.rect(49, 9, 11, 2, 'X');
  b.rect(60, 9, 3, 17, 'X');
  // 飛び石の橋：島のスイッチを交互に踏んで、1人ずつ前へ進む。トゲの付いた低い天井でジャンプでは越えられない
  b.rect(67, 22, 67, 2, 'X');
  b.rect(69, 21, 65, 1, '^');
  b.rect(68, 25, 2, 1, '2');
  const pits: [number, string][] = [[71, 'B'], [93, 'C'], [115, 'D']];
  for (const [x, c] of pits) {
    b.rect(x, 26, 16, 1, c);
    b.rect(x, 27, 16, 1, '^');
  }
  b.rect(87, 25, 2, 1, '2');
  b.rect(91, 25, 2, 1, '3');
  b.rect(109, 25, 2, 1, '3');
  b.rect(113, 25, 2, 1, '4');
  b.rect(131, 25, 2, 1, '4');
  // 最後は二人スイッチの扉
  b.rect(138, 25, 3, 1, '5');
  b.rect(146, 1, 2, 13, 'X');
  b.rect(146, 14, 2, 12, 'e');
  b.channel(5, { need: 2, hold: 2 * 50 });
  b.rect(156, 1, 1, 25, 'F');
  b.hint(3, 21, '2人以上で協力するステージ')
    .hint(10, 17, 'シーソー: 仲間が片側に乗ったら、反対側に跳んで着地しよう')
    .hint(10, 19, '高く跳んで着地するほど高く飛ぶ。飛んだ人は空中で二段ジャンプ')
    .hint(29, 7, '上に着いたら、オレンジのスイッチでリフトを上げる')
    .hint(66, 17, '飛び石の橋: 島のスイッチで、後ろの仲間に橋を架けよう')
    .hint(66, 19, '交互に踏んで1人ずつ進む。天井のトゲに注意')
    .hint(134, 19, '二人スイッチ: 2人で踏むと扉が開く（2秒）')
    .hint(152, 21, 'ゴール！');
  return b.build({
    id: 'factory', name: 'からくり工場', minPlayers: 2,
    description: '2人以上が必要な協力ステージ。シーソーで飛ばし、リフトで運び、飛び石の橋を交互に進む。',
  });
}

function wordPractice():MapDef {
  const b=new Builder(86,30);
  b.rect(0,26,26,4,'#').rect(49,22,37,8,'#').rect(26,29,23,1,'^');
  b.rect(5,25,1,1,'S').rect(10,1,1,25,'>').rect(80,1,1,21,'F');
  b.hint(3,17,'中華吐息の稽古場 · R /「中華を吐く」')
    .hint(3,19,'狙った方向へ吐く → 文字の上に乗る・フックを掛ける')
    .hint(18,12,'岸の手前で右へ吐こう。動く文字に乗って谷を渡ろう')
    .hint(51,17,'18秒で消える足場。後で二人の仕掛けにも使えます');
  return b.build({id:'word-practice',name:'中華吐息の稽古場',description:'「中華」を吐いて動く足場にする練習コース。文字の線には乗れて、フックも掛かる。',minPlayers:1,wordBlocks:true});
}
export const MAPS: MapDef[] = [wordPractice(),stage1(), stage2(), stage3(), stage4(), sunny, kobra];

// 大部屋の広場：左にフリー入口、右に協力の台
function lobby(): MapDef {
  // ステージが増えると左右の入口が増え、広場も広がる（3ステージで幅84）
  const off = (MAPS.length - 3) * 9;
  const W = 84 + off * 2, c = 42 + off;
  const b = new Builder(W, 22);
  b.rect(0, 18, W, 4, '#');
  b.rect(c, 17, 1, 1, 'S');
  // 中央の遊び場（フックの練習用の天井とバネ）
  b.rect(c - 10, 4, 20, 2, '#');
  b.rect(c - 6, 12, 12, 1, '#');
  b.rect(c - 8, 17, 1, 1, 'J');
  b.rect(c + 8, 17, 1, 1, 'J');
  // 左右を区切る低い仕切り
  b.rect(c - 11, 16, 1, 2, 'X');
  b.rect(c + 11, 16, 1, 2, 'X');
  // 端のゾーンは壁際まで広げて、歩いて行くだけで入れるようにする
  MAPS.forEach((m, i) => {
    const free = i === 0 ? { x: 1, w: 9 } : { x: 3 + i * 9, w: 7 };
    const last = i === MAPS.length - 1;
    const party = { x: c + 14 + i * 9, w: last ? 9 : 7 };
    b.zone({ id: `free-${m.id}`, kind: 'free', stageId: m.id, ...free, y: 13, h: 5 });
    b.zone({ id: `party-${m.id}`, kind: 'party', stageId: m.id, ...party, y: 13, h: 5 });
  });
  b.hint(2, 9, 'フリー入口: 入口で F を押すと、誰でもいるステージに入る')
    .hint(c + 14, 9, '協力の台: 乗って F でカウント開始、台の上の全員で出発')
    .hint(c - 7, 9, 'Enter でチャット');
  return b.build({ id: 'lobby', name: '大部屋', minPlayers: 1, description: '' });
}
export const LOBBY_MAP = lobby();

/** 遊べるステージだけを探す */
const custom = new Map<string, MapDef>();
export function registerCourse(map: MapDef) { if (map.id.startsWith('user-')) custom.set(map.id, structuredClone(map)); }
export const stageById = (id: string) => MAPS.find((m) => m.id === id) ?? custom.get(id);
/** 大部屋を含むすべてのマップから探す */
export const mapById = (id: string) => (id === LOBBY_MAP.id ? LOBBY_MAP : stageById(id));
