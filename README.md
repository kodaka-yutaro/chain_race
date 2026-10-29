# ChainRace

PCブラウザで遊ぶ協力パルクール。ホストが公開・招待限定の部屋を作り、参加者と同じコースで遊びます。固定の大部屋は使いません。

夕暮れの自然と紺色のプレートを背景に、ハンマー＋フックを基本装備として、自転車・中華まん・幽霊に持ち替えます。コースエディタは3列のパーツ選択、説明一覧、DD系ギミック、JSON入出力、即時テストに対応。顔エディタで描いた絵には目が付きます。

操作・部屋・公開手順は[ROOMS.md](ROOMS.md)、参照元ライセンスは[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照。

## 開発

```
npm ci
npm run dev
npm run typecheck
npm test
npm run build
```

`VITE_LOCAL_ONLY=1`でFirebaseを使わないローカルテストに切り替わります。本番公開の前に同梱のFirestoreルールとインデックスを適用してください。

## 収録マップ

Sunny Side Up（Ravie）とKobra（Zerodin）はDDNetの公式配置を変換したプレリリースです。原本はclient/public/ddnet、変換後データはshared/dd-sunny.jsonとshared/dd-kobra.json。作者表示と元のCC-BY-SA条件を保持します。美術・音楽は独自のものです。通しクリアと本家の物理互換は保証していません。

DD系の凍結、テレポート、ストッパー、スイッチ、武器、レーザーなどを独自エンジンへ移植しています。全仕様の完全移植ではなく、チーム別スイッチ、チューニングゾーン、テレガン、ネイティブ.mapの入出力は未対応です。砲台・ドラッガーは簡略版です。
