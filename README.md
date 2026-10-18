# ツナグラン

フックでつながる、ブラウザで遊べるオンライン協力2Dアクション。

## 遊び方

| 操作 | キー |
| --- | --- |
| 移動 | A / D |
| ジャンプ | Space（空中でもう一度押すと二段ジャンプ） |
| フック | 右クリック長押し または E（岩壁に掛けると引き寄せられる。仲間にも掛かる。金属には掛からない） |
| ハンマー | 左クリック または Q（近くの仲間を叩いて飛ばし、しびれを解く） |
| やり直し | K |
| 大部屋へ戻る | Esc |

操作と動きの数値は DDNet（DDRace）に合わせている。スマホは縦画面で、左下のスティックで移動、右下のボタンでジャンプとハンマー、画面をタップした方向にフックを伸ばす。

- 名前だけ入れてゲストで遊ぶか、アカウントを作ってクリアタイムをランキングに残せる。
- 入るとまず「大部屋」（最大16人）を選ぶか作る。大部屋はキャラで歩き回れる広場で、チャットは頭上に吹き出しでも出る（Enter で入力）。
  - 左の **フリー入口** で F: そのステージの、誰でも途中参加できるセッションに入る。
  - 右の **協力の台** で F: 3秒のカウントのあと、台に乗っている全員（最大8人）がパーティとして出発する。抜けるなら台から降りる。
  - ステージで Esc を押すと広場に戻る。

### ステージ

1. **はじまりの丘**: 操作の練習。1人でクリアできる。
2. **しびれ洞窟**: フックで支点をたどる回廊と、フックで登る煙突。
3. **ツナグの塔**: 2人以上が必要。スイッチ扉、ハンマーでの打ち上げ、フックでの引き上げ。

### タイル

`#` 岩壁（フックが掛かる） / `X` 金属壁（掛からない） / `~` しびれ床 / `^` トゲ / `J` バネ /
`S` スポーン / `>` スタート線 / `F` ゴール線 / `1`〜`4` スイッチ / `a`〜`d` 扉（`1` で `a` が開く）

## 開発

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # 物理・ステージ・大部屋の進行のテスト
npm run typecheck
```

`client/net/firebase-config.ts` が `null` のままだと、Firebase を使わず **同じブラウザのタブ同士だけ** でつながる動作になる（開発・確認用）。タブを2つ開けば2人で試せる。

## 構成

サーバーを持たない。GitHub Pages に置いた静的なページだけで動く。

- **ゲームの進行**: 大部屋を作った人（主）のブラウザが、その大部屋の全員の物理を計算して配る（`client/host/`）。参加者とは WebRTC で直接つながる（`client/net/rtc.ts`）。主のタブが裏に回っても止まらないよう、Worker のタイマーで進める。
- **Firebase（無料の Spark プラン）**: アカウント（Authentication）、大部屋の一覧と接続の仲介、自己ベストとランキング（Cloud Firestore）。ルールは `firestore.rules`。
- `shared/physics.ts` 決定的な物理（50 tick/秒）。主と参加者で同じコードを使い、自分のキャラは予測して主の状態で補正する。
- `shared/maps.ts` ステージ定義（四角形を重ねて組み立てる）。

制約:
- 主が大部屋を出ると、その大部屋は閉じて全員が一覧に戻る。
- 主の回線で全員分を送るので、大部屋は16人まで。
- 記録は各プレイヤーのブラウザが保存するので、改造すればズルはできる（協力ゲームなので許容）。
- 会社や学校のネットワークなど一部の環境では直接つながらない。困ったら TURN サーバーを用意して `VITE_TURN_*` を設定する。

## 公開（https://chainrace.kdking-tools.com）

### 1. Firebase を用意する（初回だけ）

1. https://console.firebase.google.com で「プロジェクトを作成」（名前は `chainrace` など。Google アナリティクスはオフでよい）。
2. 「構築 → Authentication → 始める」で、ログイン方法の **メール / パスワード** と **匿名** を有効にする。
3. 「構築 → Firestore Database → データベースを作成」。場所は `asia-northeast1`（東京）、「本番環境モード」で作る。
4. Firestore の「ルール」タブに `firestore.rules` の中身を貼って「公開」。
5. 「Authentication → 設定 → 承認済みドメイン」に `chainrace.kdking-tools.com` を追加。
6. 「プロジェクトの設定（歯車）→ マイアプリ → ウェブ（`</>`）」でアプリを登録し、表示される `firebaseConfig` を `client/net/firebase-config.ts` に貼る。

### 2. GitHub Pages

1. リポジトリの Settings → Pages → Build and deployment の Source を **GitHub Actions** にする。
2. main に入るたびに `.github/workflows/pages.yml` がテスト・ビルドして公開する。
3. Settings → Pages → Custom domain に `chainrace.kdking-tools.com` を入れ、Enforce HTTPS をオンにする（`client/public/CNAME` にも書いてある）。

### 3. DNS（Cloudflare）

| 種類 | 名前 | ターゲット | プロキシ |
| --- | --- | --- | --- |
| CNAME | `chainrace` | `kodaka-yutaro.github.io` | DNS のみ（灰色の雲） |

## 広告と検索（kdking サイト共通の方針）

- 運営者名は「kdking」。実名はサイトに出さない。
- AdSense はルートの `kdking-tools.com` で一括申請している。`ads.txt` はルートのサイトに置くので、このリポジトリには不要。
- 審査が通ったら、ビルド時の環境変数（`.env.example` 参照）に広告ユニットの ID を入れる。GitHub の Settings → Secrets and variables → Actions → Variables に `VITE_ADSENSE_CLIENT` などを入れる。広告はプレイ中には出さず、タイトル・大部屋の横の欄・リザルトにだけ出す。
- Search Console は `kdking-tools.com` のドメインプロパティで登録済み。公開後に `https://chainrace.kdking-tools.com/sitemap.xml` をそこから送信する。
