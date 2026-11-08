# Kasanaru / かさなる

考えを同じにせず、一緒に受け入れられる条件を探す、ハッカソン用Webプロトタイプ。

Live demo: https://kasanaru.haruharuoharu.workers.dev/

Repository: https://github.com/haruharuoharu/kasanaru

Kasanaru helps participants compare their initial views with responses to a follow-up question containing specific conditions. It is a small hackathon prototype inspired by Polis, not an automated consensus engine.

## v0.2の変更
- 日本語／Englishの切り替え、イラスト付きの参加案内、回答進捗を追加。
- 参加前に回答を押した場合は参加ボタンへ案内。
- 許諾・発注機会への支持を両群で比較する表を追加。
- 記録の署名後・送信前にTx情報を保持し、通信失敗から復旧できるようにした。
- 古い画面からの不正な進行や別Txによる上書きを拒否。
- 参加・回答・サンプル切替・認証のDOMテストと、Memo取引の署名テストを追加。
- 新しいテストはブラウザの目視確認や実Devnet送信の代わりではない。

## 実装済み
- 固定テーマ・初期3問・条件を加えた1問、三択回答、回答変更。
- ブラウザセッション別の永続化、二重集計防止、締切後の回答拒否。
- 初回1問目の回答区分を固定し、追加問いへの支持を比較。
- 仮閾値による「共通条件候補」「回答不足」「まだ見つからない」。
- 主催者認証とラウンド操作。開始前ルールと最終結果の固定JSON。
- ブラウザ拡張ウォレットでSolana Devnet Memoを送るコードと、サーバー側の署名者・内容・成功確認。
- JSONファイルのハッシュ比較、チェーンとの照合、Explorerリンク。
- 架空12人のサンプル（実投票と分離）。
- Workersの毎日cronで30日経過した参加者・個人別回答を削除。確定集計は保持。

## 確認状況（2026-11-08）
- `npm test`：15件成功。集計境界、複数セッション、締切、認証、Memo署名、RPC応答、参加前の誘導、日英切り替えを確認。
- `npm run build` と `npm run check`：成功。
- 利用者のPCからCloudflare Workers / D1へ公開済み。
- Solflareで開始前ルールのDevnet記録に成功し、アプリの確認表示を利用者の共有画面で確認。
- 投票→追加の問い→最終結果のDevnet記録までの実環境通し検証は未完了。結果Txと動画URLは未掲載。
- 最新UIの公開反映と、スマートフォン・デスクトップでの目視確認は別途必要。自動テストはこれらの代わりではない。

## ローカル起動（Node.js 24）
```bash
npm ci
npm run build
cp .env.example .env
# .env の ADMIN_TOKEN を24文字以上のランダム文字列に置き換える
npm run dev
```
http://127.0.0.1:8787 を開く。主催者メニューで `.env` のトークンを入力する。
`.env.example` の `ALLOW_LOCAL_UNANCHORED=1` はローカル限定。画面に未記録モードを明示する。
本番では未記録の投票開始はできない。主催者はSolflareまたはPhantomの拡張ウォレット、Devnet SOLが必要。Seed Vault/Mobile Wallet Adapterは未対応。
ローカルDBは `.data/kasanaru.sqlite`。実験をやり直す場合、サーバー停止後にこのローカルDBを別名へ移動してから再起動する。確定済み本番ルームのリセット機能は設けない。

## Cloudflare公開手順
```bash
npm ci
npm run build
npx wrangler login
npx wrangler d1 create kasanaru
# 出力されたdatabase_idをwrangler.jsoncへ設定
npx wrangler d1 execute kasanaru --remote --file schema.sql
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put SOLANA_RPC_URL
# SOLANA_RPC_URLにはhttps://で始まるDevnet RPC URL全体を入力（APIキーだけではない）
npm run deploy
```
主催者用のランダムトークンをsecretとして設定。トークン・秘密鍵をGitや録画へ含めない。
本番の `LOCAL_MODE` と `ALLOW_LOCAL_UNANCHORED` は設定しない。
公開前に参加案内へ、主催者の問い合わせ・削除依頼窓口を付記する。

## 本番デモの順序
1. 主催者メニューで認証。Devnetルール記録→確認成功。
2. 初回回答を開始。複数端末が匿名参加し、3問へ回答。
3. 初回を締め切り、群別ではなく全体の初回結果を確認する。
4. 事前に用意した条件の問いを主催者が公開する。
5. 同じ参加者が追加問いへ回答し、両群の支持を比較する。
6. 最終結果を確定し、ルール記録と同じウォレットでDevnetに結果記録。
7. JSONを保存、チェーンと照合。1文字変更したファイルは不一致になる。

ブラウザ拡張ウォレットが使えないモバイル端末は参加者として使い、主催者操作はデスクトップで行う。
RPCの確認待ちでは同じタブ内にTxを保持し、再クリックで登録を再試行する。署名後は送信前にTxと署名済みバイト列をタブ内へ保存する。確認待ちは同じTxを再送・照合できる。有効期間切れはExplorerで状態を確認し「新しく署名」を使う。タブを閉じる前に記録確認を完了すること。秘密鍵はアプリへ渡さない。

## 制約
一議題、一ルーム、手動ラウンド操作。返信、自由投稿、動的な問い作成、生成AI、自動クラスタリング、NFT/トークンはない。追加の問いは固定例であり、自動で合意条件を発見する製品ではない。

支持率は賛成/(賛成+反対+保留)、未回答は別掲。両群回答3人以上、回答率60%以上、支持率70%以上が仮ルール。これはPolisの分析方式の再現でも、統計的な保証でもない。

一ブラウザ一参加枠で、本人確認はない。100枠上限はレート制限やボット対策の代用ではないため、一般公開の大規模SNSとして運用しない。

ルールや結果のハッシュは変更検知の証拠であり、集計の正しさや一人一票の証明ではない。実データで候補が見つからなくても隠さない。サンプルは常時架空データと表示する。

開発は新規作成。OSS依存とAIコーディング支援を使用。提出条件の最終確認はMuse担当。MITライセンス（ソース）、依存ライブラリは各ライセンスに従う。

主催者メニューでSolflare／Phantomを明示選択。選んだ拡張のみを使用し、自動で他方へ切り替えない。言語選択は表示にのみ適用し、固定ルール・回答値・記録ハッシュを変更しない。

## GitHubでの開発
`main`を共有するソースとし、以後の変更は作業ブランチとPRで管理する。GitHubへのpushだけではCloudflareは更新されない。公開はCloudflare認証済みPCから`npm run deploy`で行う。

`public/wallet.js`と`public/record.js`は`npm run build`の生成物で、Gitには含めない。
APIキー、主催者トークン、ウォレット秘密鍵、個人回答、ローカルDBは登録しない。`wrangler.jsonc`はD1 IDのプレースホルダーを保持する。既存公開アプリを更新する場合は、PC上の設定済みファイルをそのまま利用し、新しいD1を作成し直さない。
