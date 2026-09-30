# Cloudflare CLI と Branch Previews

`cf` (`1.0.0-beta.7`) をCloudflare操作の入口にする。設定は `cloudflare.config.ts`、bundler設定は `wrangler.config.ts`。Nitro 2がcf Build Outputを出力しないため、Nuxtのcompiled hookから既存Wrangler bundlerを呼ぶ。

```sh
bun install --frozen-lockfile
bun run dev
bun run build
bun run preview
```

ローカルD1は `.data/unified/v3` を継続使用する。ローカルWorker用secretはルートのignored `.dev.vars` に置く。`cf dev` はNuxtへ委譲されるため、ビルド済みWorkerの検証だけは `bun run preview` (Wrangler) を使う。`getPlatformProxy`、Preview secretsと削除もcf betaに相当操作がないためWranglerを残す。

## ブランチごとの作成と更新

`.github/workflows/preview.yml` がmain以外へのpushを受け、検査後に **Workers Previews** の `cf previews deploy` を実行する。独立Workerや旧versions uploadではない。GitHub Actionsを使うのは、デプロイ前のD1/R2作成と削除を同じ処理で管理するため。

- 名前はブランチ名の短縮slugとSHA-256先頭12桁から決定。同一ブランチへの再pushでは同じURL、D1、R2を使う。
- 新規ブランチは専用D1へschemaのみ適用し、専用R2は空で開始。本番、ローカル、他ブランチのデータや認証行はコピーしない。
- PreviewのCronとcustom domainは無効。画像は同じPreview originのfiles APIから配信。HTMLとレスポンスはnoindex。
- `main` のproduction deploymentやmigrationはこのworkflowでは実行しない。
- `dev` に特別な役割はない。現在のURL: <https://p-dev-ef260e9aa3c6-liry24-com.liry.workers.dev>

手動実行時はGitHub上に存在するブランチ名を渡す。

```sh
node --env-file=.env scripts/preview.mjs deploy dev
```

## ログインとSecrets

Preview専用GitHub OAuth App `Liry24 Branch Previews` を使用。callbackは `https://liry.workers.dev/api/auth/callback/github`、GitHubのcallback wildcardを有効化。同じCloudflare accountのPreviewへ直接戻るため、devや本番をOAuth中継にしない。別のworkers.dev accountのcallbackが拒否されることを確認済み。

ログイン前にGitHubの本人IDと `Liry24/liry24.com` の `admin` 権限を照合する。write/maintain/readは拒否。APIエラーも拒否し、管理APIで権限を再確認する。Previewの登録はこの条件を満たすGitHubユーザーのみ。通常サイトの公開ページは匿名で閲覧できる。

GitHub Environment `Preview` のSecrets:

| Secret                         | 用途                                               |
| ------------------------------ | -------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`        | Cloudflare account                                 |
| `CLOUDFLARE_API_TOKEN`         | Workers Scripts/D1/R2 Write、Account Settings Read |
| `PREVIEW_BETTER_AUTH_SECRET`   | Preview認証用共通secret                            |
| `PREVIEW_GITHUB_CLIENT_ID`     | Preview専用OAuth App                               |
| `PREVIEW_GITHUB_CLIENT_SECRET` | Preview専用OAuth App                               |
| `PREVIEW_GITHUB_TOKEN`         | 対象repositoryのみ、fine-grained PAT Metadata Read |

Cloudflare tokenと権限照会PATは **2026-12-30失効**。期限前に更新し、Environment Secretsを置換する。Cloudflare tokenは同accountの他のWorkers/D1/R2も編集可能な範囲を持つ。信頼できるブランチのコードだけをこのrepositoryへpushすること。Secretはgitへ保存しない。手元の `.env` ではCloudflare tokenを `PREVIEW_CLOUDFLARE_API_TOKEN` として読み込める。

## ブランチ削除

branch deleteイベントでPreview、R2内object、R2 bucket、D1の順に削除する。GitHub上にブランチが残っている場合とmainは拒否する。workflowのdeleteイベントはdefault branch上の定義を使用するため、**mainへこのworkflowを取り込むまでは手動で削除する**。

```sh
node --env-file=.env scripts/preview.mjs delete codex/example
```

削除したブランチを再作成すると同じ名前・URLの空環境になる。残したいデータはブランチ削除前にexportする。

## 既存環境との境界

旧Cloudflare Buildsのmain以外用triggerは `liry24-com` と `liry24-com-admin` の2件を停止済み。main用triggerは従来設定を維持しており、root統合後の本番切替は別途必要。mainへマージする前に本番DB backup・移行・旧trigger更新を準備する。本番D1/R2へ今回のmigrationは適用していない。

親WorkerはPreview URLsのみ有効化済みで、productionのworkers.dev URLは無効のまま。`previewUrls: true` を本番設定にも維持し、将来の本番デプロイでPreview URLを無効化しない。
