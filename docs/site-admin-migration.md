# Site Admin と統合Worker

`@liria24/site-admin` はnpm公開版 `0.0.1` に固定する。公開ページ、`/admin`、content API、管理API、Better Authをrootの1 Nuxt app / 1 Workerへ統合する。Cloudflare操作とPreviewは [cloudflare-previews.md](./cloudflare-previews.md) を参照。

- `site-admin.config.ts` が7 Modelを定義する。認証とcontentは同じD1、生成schemaは `packages/database/src/schema.ts`。
- 公開画面は公開投影型とassetの `url` を使用する。管理画像はlibraryの `managementAssetUrl` を使用する。
- 管理一覧は100件ずつ全ページを取得してから並べ替える。フォームは `useSiteAdminForm` のAssetInput検証を使用する。
- 下書きBlob分離は明示的に無効。R2の公開URLを知っている場合、非公開の原本も取得できる。この構成では公開参照の認可だけではBlobを非公開にできない。
- 公開・予約・current revisionを別々に保持する。productionの毎分Cronが `publishDue()` を呼ぶ。PreviewにCronは設定しない。
- Better Auth関連は `1.7.7`。`patches/` の最小patchで、counterを登録route template単位、未知pathを共通bucketにする。実際のrouter matcherを再利用し、追加routerを持たない。
- productionとPreviewは独立した認証secretとOAuth Appを使用する。OAuth callbackは各originの `/api/auth/callback/<provider>`。OAuth中継は使用しない。

## Baselineとローカル開発

現行schemaのbaselineは `drizzle/20261001123048_baseline`。旧SQL履歴や一時変換ツールは保持しない。既存DBにbaselineのCREATEを再実行せず、バックアップと列・index・外部キーの照合後に適用台帳を揃える。

```sh
bun install --frozen-lockfile
bun run content:migrate
bun run dev
bun run build
bun run preview
```

persistの指定は `.data/unified`。Wranglerが追加する `v3` 以下が実データであり、指定自体に `v3` を追加しない。Nuxt開発時のassetは `.data/files/content`、Worker検証時はローカルR2を使用する。migrationは明示コマンドで実行し、HTTP requestでDDLを実行しない。

## 移行の照合

2026-10-01の本番exportを、remote bindingsを無効にした隔離ローカルD1/R2へ復元した。28 Entry（works 4、arts 9、careers 1、ranks 1、skills 3、socials 8、posts 2）、44画像（152,737,932 bytes）、1 user、2 OAuth accountを照合済み。本文、slug、順序、公開状態、日時、画像SHA-256、外部キーを検証した。実データに予約・下書きはなく、published=A / scheduled=B / current=Cは独立fixtureで検証した。

認証のuserとOAuth accountは保持する。旧Passkey登録、session、一時認証情報は引き継がず、統合originでログインしてPasskeyを再登録する。

本番切替は旧書込み停止後に最終exportを取得し、同じ照合を再実行する。失敗時は旧DBと旧deploymentへ復旧する。export・旧migration・移行証跡はリポジトリ外に30日保管する。
