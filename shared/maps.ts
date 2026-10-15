import type { MapDef } from './physics';

// ステージはすべてこのプロジェクトのオリジナル。四角形を重ねて組み立てる。
class Builder {
  grid: string[][];
  hints: MapDef['hints'] = [];
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
  build(meta: Omit<MapDef, 'width' | 'height' | 'tiles' | 'hints'>): MapDef {
    this.border();
    return { ...meta, width: this.width, height: this.height, tiles: this.grid.map((r) => r.join('')), hints: this.hints };
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
    .hint(13, 19, '空中で Space: マウスの方向へダッシュ')
    .hint(27, 17, '岩壁に触れて Space: 壁キック')
    .hint(40, 22, 'しびれ床に注意  K: スタートからやり直し')
    .hint(60, 19, '右クリック長押し: ワイヤー  W/S: 巻き取り・繰り出し')
    .hint(96, 21, 'バネ床 + ダッシュ、またはワイヤーで越えよう')
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
  // ワイヤーの回廊：天井は金属、ところどころ岩の支点
  b.rect(26, 24, 34, 2, '~');
  for (const x of [30, 38, 46, 54]) b.rect(x, 11, 2, 1, '#');
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
  b.hint(3, 21, '金属の壁と天井にはワイヤーが刺さらない')
    .hint(26, 21, '岩の支点をつないで渡ろう。落ちたら仲間に引き上げてもらおう')
    .hint(66, 23, 'しびれのつららに注意')
    .hint(106, 23, '煙突は壁キックで登れる');
  return b.build({
    id: 'cave', name: 'しびれ洞窟', minPlayers: 1,
    description: 'ワイヤーと壁キックの洞窟。仲間がいると落ちても助け合えます。',
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
  // 金属の塔：エアキャノンで仲間を打ち上げ、上からワイヤーで引き上げる
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
    .hint(36, 19, '左クリック: エアキャノン。ジャンプした仲間を打ち上げよう')
    .hint(36, 21, '上に着いたら仲間にワイヤーを刺し、W で巻き取って後ろへ下がる')
    .hint(56, 19, '足場の裏にワイヤーを刺して登ろう')
    .hint(96, 21, 'ゴール！');
  return b.build({
    id: 'tower', name: 'ツナグの塔', minPlayers: 2,
    description: '2人以上が必要な協力ステージ。スイッチ、打ち上げ、引き上げ。',
  });
}

export const MAPS: MapDef[] = [stage1(), stage2(), stage3()];
export const mapById = (id: string) => MAPS.find((m) => m.id === id);
