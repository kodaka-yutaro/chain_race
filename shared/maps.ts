import type { MapDef, Zone } from './physics';

// ステージはすべてこのプロジェクトのオリジナル。四角形を重ねて組み立てる。
class Builder {
  grid: string[][];
  hints: MapDef['hints'] = [];
  zones: Zone[] = [];
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
  build(meta: Omit<MapDef, 'width' | 'height' | 'tiles' | 'hints' | 'zones'>): MapDef {
    this.border();
    return {
      ...meta, width: this.width, height: this.height, tiles: this.grid.map((r) => r.join('')), hints: this.hints,
      zones: this.zones.length ? this.zones : undefined,
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
  const b = new Builder(120, 30);
  b.rect(0, 26, 120, 4, '#');
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
  b.rect(100, 1, 1, 25, 'F');
  b.hint(3, 21, '2人以上で協力するステージ')
    .hint(15, 21, 'スイッチを踏んでいる間だけ扉が開く')
    .hint(36, 19, '仲間を頭に乗せてジャンプし、左クリックのハンマーで打ち上げよう')
    .hint(36, 21, '上に着いたら、ジャンプした仲間にフックを掛けて引き上げる')
    .hint(56, 19, '足場の裏にフックを掛けて登ろう')
    .hint(96, 21, 'ゴール！');
  return b.build({
    id: 'tower', name: 'ツナグの塔', minPlayers: 2,
    description: '2人以上が必要な協力ステージ。スイッチ、ハンマーでの打ち上げ、フックでの引き上げ。',
  });
}

export const MAPS: MapDef[] = [stage1(), stage2(), stage3()];

// 大部屋の広場：左にフリー入口、右に協力の台
function lobby(): MapDef {
  const b = new Builder(84, 22);
  b.rect(0, 18, 84, 4, '#');
  b.rect(42, 17, 1, 1, 'S');
  // 中央の遊び場（フックの練習用の天井とバネ）
  b.rect(32, 4, 20, 2, '#');
  b.rect(36, 12, 12, 1, '#');
  b.rect(34, 17, 1, 1, 'J');
  b.rect(50, 17, 1, 1, 'J');
  // 左右を区切る低い仕切り
  b.rect(31, 16, 1, 2, 'X');
  b.rect(53, 16, 1, 2, 'X');
  // 端のゾーンは壁際まで広げて、歩いて行くだけで入れるようにする
  const free = [{ x: 1, w: 9 }, { x: 12, w: 7 }, { x: 21, w: 7 }];
  const party = [{ x: 56, w: 7 }, { x: 65, w: 7 }, { x: 74, w: 9 }];
  MAPS.forEach((m, i) => {
    b.zone({ id: `free-${m.id}`, kind: 'free', stageId: m.id, ...free[i], y: 13, h: 5 });
    b.zone({ id: `party-${m.id}`, kind: 'party', stageId: m.id, ...party[i], y: 13, h: 5 });
  });
  b.hint(2, 9, 'フリー入口: 入口で F を押すと、誰でもいるステージに入る')
    .hint(56, 9, '協力の台: 乗って F でカウント開始、台の上の全員で出発')
    .hint(35, 9, 'Enter でチャット');
  return b.build({ id: 'lobby', name: '大部屋', minPlayers: 1, description: '' });
}
export const LOBBY_MAP = lobby();

/** 遊べるステージだけを探す */
export const stageById = (id: string) => MAPS.find((m) => m.id === id);
/** 大部屋を含むすべてのマップから探す */
export const mapById = (id: string) => (id === LOBBY_MAP.id ? LOBBY_MAP : stageById(id));
