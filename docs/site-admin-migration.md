# Site Admin ローカル移行レポート

検証日: 2026-09-16。ローカルでの切替実装と検証を完了。本番切替は未実施。
push、deploy、npm publish、本番D1/R2への書込みは行っていない。

2026-09-27追記: Asset storageをnuxt-files-sdk v0.1.1へ更新し、開発環境のfs切替を `$development.storage.content` に移行した。

2026-09-30追記: Site Admin v0.0.0のnpm公開と公開版への切替検証については末尾を参照。

## 最終構成

リポジトリrootの1 Nuxt app / 1 Nitro Workerへ統合した。旧 `apps/admin` を削除し、`apps/home` と `layers/base` もrootへ統合済み。
公開ページ、`/admin/**`、`/api/content/**`、`/api/site-admin/**`、`/api/auth/**` を同じアプリで提供する。

- `@liria24/site-admin` はnpm公開版 `0.0.0` に完全固定（2026-09-30更新）。ローカルリンクは解除済み。
- content schema は `site-admin.config.ts`。works / arts / careers / ranks / skills / socials / posts の7 Model。
- CRUD・revision・公開・予約公開・並べ替え・AssetはSite Admin。UIはアプリ側のNuxt UIとFormKit DnD。
- Create/Editは `useOverlay()`、保存は `useSiteAdminForm()`。Save Draftと公開操作は分離。競合時はReload latestを提供。
- public/adminコンポーネントを別ディレクトリに分離。Admin Formは遅延ロード。
- DBは認証・アプリ・Site Adminで共有する1つだけ。Better AuthとSite Adminは同じアプリ所有Drizzle instanceを使用する。Site Admin専用connector/devDatabase設定とCONTENT_DB bindingは撤去。
- Asset storageはnuxt-files-sdk v0.1.1。productionはR2、Nuxt開発時は `$development.storage.content` のfs（`.data/files/content`）を使用する。ライブラリにR2 bindingを追加していない。
- Site Adminが既定で導入する `@nuxtjs/better-auth` を使用。アプリはnativeなserver/client auth configだけを所有し、Site Adminがadmin role plugin・SSR session・管理API認可を同じ定義から提供する。匿名の管理画面は404、管理APIは401。
- Cloudflare Cronはアプリが明示設定し、Site Adminの `publishDue()` を呼ぶ。ライブラリはCronを自動登録しない。
- 公開ページは必要なModelをruntime取得。SWR 300秒とSite Adminのpublic generationは別のcache層。
- `/llms.txt` と `/llms-full.txt` は `nuxt-llms` が提供し、domain/title/full等はトップレベルの `llms` optionで管理する。Site Adminは公開Entryをruntime hookへ追加するだけで独自handlerを持たない。
- Snapshot、content更新によるrebuild、site-build、旧resource API/composable、旧upload、MCP/CIMD、post-publisherを撤去。
- `@repo/database` がauth/contentを含む単一の生成schema.tsを所有し、単一のdrizzle.config.tsから共通migration履歴を管理する。既存の適用済みSQL履歴は改変していない。

## データ移行

本番D1から取得済みの読み取り専用exportをローカルへ移行し、今回はそのローカルSQLiteを移行元として単一のローカルD1/R2へ統合した。認証はschemaのみ取得し、本番user/sessionは取り込んでいない。統合前のローカル認証DBはuser/accountとも0件だった。

統合後、移行元13テーブル・183行（public generationを除く）が一致し、Entry/Revision/Asset ID・公開/予約/current参照・順序を保持することを確認。保存先は開発・Worker検証とも `.data/unified/v3`。

| Model   | 件数 |
| ------- | ---: |
| works   |    4 |
| arts    |    9 |
| careers |    1 |
| ranks   |    1 |
| skills  |    3 |
| socials |    8 |
| posts   |    2 |
| 合計    |   28 |

44個の一意なAsset、10 routes。slug、順序、公開状態、Markdown、tags、画像参照を移行。元のart image行は39件。
取得時のpostsは2件とも公開済みで、予約・draft・review・person relationの実データはなかった。
published=A / scheduled=B / current=Cは、別のローカルテストデータで実SQL/API検証した。

`scripts/migrate-to-site-admin.ts` はdry-runが既定。`--apply`もローカル保存先限定。
元データhashと移行済みversionをledgerに保存し、再実行で重複作成しないことを確認した。
移行先を手動編集した場合や未対応person relationがある場合は停止する。
本番R2の47 object（154,033,825 bytes）を読み取り専用で `.data/files/content` へdownloadした。うち44個を `legacyUrl` から移行済みSite Admin keyへ対応付け、ローカルD1のsizeとSHA-256 checksumに全件一致することを確認した。本番R2へのcopy・更新・削除はしていない。Asset GCは自動実行していない。

## バンドルサイズの遷移

旧版は `81df59ae336876fe591c42f9858dc3f308c1c73f` を `.data/baseline` に展開してhome/adminをそれぞれbuild。
新構成は現在のworking treeをCloudflare向けにbuildした。
以下はbytes。sourcemap、事前圧縮ファイル、Wrangler一時bundleを除外。
gzipはファイルごとの圧縮サイズの合計であり、実通信量やCloudflare uploadサイズではない。

| 対象                     |    旧home |   旧admin |     旧合計 |  新単一app | 合計比 |
| ------------------------ | --------: | --------: | ---------: | ---------: | -----: |
| Client JS全chunk         | 1,198,569 | 1,711,489 |  2,910,058 |  1,676,125 | -42.4% |
| Client JS gzip           |   434,626 |   541,721 |    976,347 |    563,065 | -42.3% |
| CSS                      |   199,359 |   209,824 |    409,183 |    218,308 | -46.6% |
| Server成果物（Wasm含む） | 5,834,919 | 5,176,580 | 11,011,499 | 10,179,678 |  -7.6% |
| Server成果物 gzip        | 2,200,904 | 1,334,494 |  3,535,398 |  3,385,170 |  -4.2% |

一方、公開ページの初期JSは増加している。2アプリ合計の削減を、公開visitorへの転送量削減と読み替えてはいけない。
HTMLのmodule script/modulepreloadから静的importを辿ったgzip合計（prefetch除外）:

| Page     |  旧home | 新単一app |     差分 |
| -------- | ------: | --------: | -------: |
| `/`      | 260,541 |   381,067 | +120,526 |
| `/arts`  | 272,962 |   393,351 | +120,389 |
| `/works` | 262,851 |   383,264 | +120,413 |
| `/posts` | 258,000 |   378,264 | +120,264 |

参考: 前段の単一apps/home構成はClient JS 1,663,275 bytes / gzip 556,780、Server 9,791,309 bytes / gzip 3,244,890だった。上表はroot移動・Drizzle adapter化・単一DB統合・依存更新後の最終計測。

直前の独自認証構成からnative `@nuxtjs/better-auth` と `nuxt-llms` へ切り替えた最終成果物では、Client JSが15,229 bytes（gzip 4,639 bytes）、Serverが277,847 bytes（gzip 59,493 bytes）増えた。旧2 app合計との比較では上表の削減を維持している。

4ページともAdmin editor chunkは初期import graphに含まれなかった。
新旧でruntime機能・依存バージョンも異なるため、増分すべてをSite Admin単体のコストとは断定できない。
旧Vueは3.5.41/Vite8.2.1、新Vueは3.6.0-rc.8/Vite8.3.0。Nuxt4.5.2/Nitro2.13.4は共通。
公開初期JSの削減は今後の最適化候補で、今回達成した項目には含めない。

再計測: `node scripts/measure-migration.mjs http://localhost:8787`。
旧baseline buildと新Workerのローカル起動が必要。

## ソースコードの増減

`.ts/.vue/.js/.mjs/.sql` を対象に、各repoのHEADと現在のworking treeを比較。test/script/SQL履歴と追跡対象の生成Drizzle schema/SQLを含み、build生成物・依存・ignored backupは除外。

| Repository | 旧files | 新files | 旧lines | 新lines |             差分 |
| ---------- | ------: | ------: | ------: | ------: | ---------------: |
| liry24.com |     179 |      68 |  14,769 |   5,363 | -9,406（-63.7%） |
| site-admin |      32 |      61 |   4,515 |   8,263 |           +3,748 |
| 合計       |     211 |     129 |  19,284 |  13,626 | -5,658（-29.3%） |

今回のDB統合前（9月15日）との比較では、アプリ+244行、ライブラリ+168行、合計+412行。生成schemaを通常ソースとして保持し、adapterと共有DBの検証を追加した分を含む。

開始前から未commit変更があったため、この表には先行する設計差分実装・依存更新も含む。
特にsite-adminの+3,748行を、今回のdogfoodingだけの増分とはしていない。

## dogfoodingで修正したSite Adminの不具合・不足

1. **native Better Auth統合**: 一時的な `auth: 'custom'` とconsumer独自handlerを廃止。`siteAdmin.auth` は既定trueのbooleanとし、`@nuxtjs/better-auth` のroute・SSR session・client composableを提供する。AccessControlからserver `admin()` / client `adminClient()` を同時生成し、request単位の共有DB adapterをnative database providerへ渡す。`site-admin:authorize` は認証済みactorの補正専用で、匿名を差し替える互換経路を残していない。
2. **ローカルlinkのmodule解決**: consumer側のNuxt moduleを優先解決し、ライブラリ側へfallback。module path情報を保持する。
3. **Nitro runtime template**: generated moduleをinline対象に追加し、開発時の仮想storage解決エラーを修正。
4. **公開clientの型**: generated clientを型付きTS化し、client/route stateのconsumer型検査を修正。
5. **SSR内部fetch**: 同一アプリの公開APIにはrequest eventのfetchを使う。SWR内のHTTP loopback/port依存を解消。remote origin指定時は通常のfetch。
6. **公開API envelope**: Comark形式をSDKでEntryへ正規化。routeなしModelでもslug/id取得を正しく解決。
7. **fetch注入の型**: Bun固有の `preconnect` を要求しないWeb API callable型へ修正。
8. **Nitro plugin初期化**: pluginを同期登録し、DB初期化は既存のlazy initializeへ統一。Nitroがasync pluginをawaitしないことと、request前にはbindingが使えない問題を解消。Cloudflare専用分岐は追加していない。
9. **DELETEの楽観ロック**: bodyを落とすHTTP adapterでもversionを渡せるよう `If-Match: "version"` を追加。無効値400、競合409、成功204を回帰テスト。
10. **Vue descriptorのdefault**: reactive配列defaultをraw化してからcloneし、モーダル起動時のDataCloneErrorを修正。defaultを共有しないテストを追加。

11. **Model APIの簡素化**: model()を廃止し、models.posts.fieldsへ直接定義。publicは既定true、presentationはdisplayFieldsへ変更。Model/RevisionのschemaVersionを削除。
12. **Drizzleによる明示的schema管理**: Revisionの値をModel別の型付きtableへ分離。site-admin generateはアプリ所有の通常ソースを生成し、Drizzle Kitが共通migrationを生成する。共通Revisionはmetadataのみ。request時にDDLは実行しない。生成schemaとModelの不一致・DB未適用は明確なエラーにする。
13. **実D1のSQL上限**: 7 Modelを読んだ際のcompound SELECT上限エラーを、共通SQLのCASE/VALUES構造で修正。Cloudflare専用回避処理ではない。
14. **設定の配置・命名**: DB設定は今回アプリ所有のDrizzle adapterへ置換し、assets設定はNuxt側に保持。orphanGracePeriodはcleanup.minimumAge（秒）、leaseはoperationLeaseSecondsへ変更。負値・非有限値・文字列を拒否し、GCの自動実行はしない。
15. **DevTools**: nuxt-files-sdkに合わせ、DevTools v3 iframe / v4+ DevFrame dockを実装。認可付きread-only snapshot、手動Refresh、Copy Diagnostics、schema未適用の案内を提供。本文・default・secretを返さず、productionではendpoint/import/client assetを生成しない。

16. **Better Auth型の接続**: @liria24/site-admin/adapters/drizzleを追加。Coreでのdb0/Drizzle接続生成を削除し、Nuxtはsite-admin:database hookから受け取る。useSiteAdmin(event)はasync。appの接続・adapterを共有してwarm cacheを維持する。
17. **共有DBの原子性**: ロックはadapterではなくnative connection単位。SQLite transaction中はawaitせず、別のアプリ処理を巻き込んでrollbackしないことを回帰テスト。D1はnative batchを使用し、非対応driverは拒否する。
18. **生成schemaの所有権**: .site-admin/schema.tsとライブラリの/schema exportを廃止。共通tableも通常のDrizzle定義として生成し、渡されたModel tableを実行時にも使用する。独立content/auth migrationを共通履歴へ統合。
19. **R2配信**: ローカルR2 proxyで遅延読み込みがbodyを二重消費する問題を検出。共通download処理でstream形式を明示し、公開・管理双方の配信を修正した。
20. **native auth schema生成**: `site-admin generate --auth server/auth.config.ts --auth-use-plural` が `defineServerAuth()` factoryを生成時contextで評価し、DB接続を要求せずSite Admin admin pluginとDrizzle schema adapterを補う。実行時と同じauth plugin群からcontent/authを1つのschema.tsへ生成し、既存schemaとのbyte一致とDrizzle差分なしを確認した。
21. **nuxt-llms統合**: 独自 `/llms*.txt` handlerと `siteAdmin.llms.full` を削除。`siteAdmin.llms` は既定trueの有効/無効だけとし、本文設定はnativeなトップレベル `llms` optionへ移した。公開Entryは `llms:generate` / `llms:generate:full` hookから供給し、`route.llms: false` の除外を維持する。DB contentをbuild時に固定しないようnuxt-llmsのprerender登録は取り消す。
22. **並列test schema生成**: Vitest workerが同じ一時schemaを同時にtruncate/importする競合を、process単位の生成先へ分離した。並列実行を含む全34 testsで再発しないことを確認した。
23. **nuxt-files-sdk v0.0.5（当時）**: dependencyを更新し、named storageの `devStorage` 切替をfixtureとconsumerで検証した。liry24.comはdevelopmentでfs、productionでR2だけをbundleし、旧ローカルR2 bindingと `globalThis.__env__` fallbackを撤去した。Site Admin DevToolsもnuxt-files-sdkと同じNuxt DevTools系のsurface・border・accent・light/dark tokenへ統一した。現在はv0.1.1の `$development.storage` を使用する。

## 消費側の依存更新で修正した問題

- Files SDKのR2 adapter経由で必要となるAWS SDK peer dependenciesを追加し、Worker buildを修正。
- Vitest 5とWorkers poolの不整合は、既存Wranglerのlocal D1 proxyで実SQLテストを動かす形へ変更。Vitestはdowngradeしていない。完成Worker自体も別途起動してAPI/Cronを検証した。
- Better Auth 1.7.5に合わせ、accounts.issuerをnullableへ変更し、JWTのjwks schema名を明示。既存値を保持する変更を今回の共通migrationに統合し、ローカルだけへ適用した。本番適用前にはbackupと重複account key検査が必要。根拠: [公式upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)。

## 検証結果

- Site Admin: `bun run check` 全体成功。format/lint/typecheck、34 unit/contract tests、package build、Nuxt Node build/probe（native auth・nuxt-llmsを含む）、Cloudflare local D1、publint、ATTW（ESM profile）、packed consumer検証。
- liry24.com: format/lint/typecheck成功、unit 3件・Worker DB検証2件成功、単一Cloudflare Worker build成功。native `/api/auth`、管理API認可、CRUD、競合、公開/予約/restoreを単一ローカルD1のHTTP probeで確認した。dev fsとproduction R2 bindingの公開Asset HEADはいずれも200。fs側は41,235,170 bytes、`image/png`で、production bundleにはfs rootとDevTools endpointが含まれないことを確認した。
- production buildのローカルWorker: 匿名admin404/API401、テストadmin認証、CRUD、409、A/B/Cのrevision分離、restore、公開解除、delete、Cron予約公開。
- Chrome: DevTools v3のinspector表示・Refresh、モーダル起動、Formの連続保存、Save Draft非公開維持、XHR upload進捗、参照解除後のBlob保持。v4 dockは型検査/buildまでで、実v4 hostのブラウザ検証は未実施。
- 公開AssetのHEAD/ETag/304、sitemap/robots/llms、production DevFrame404を確認。生成schemaの再生成でmigration差分なし、ローカルmigration再実行も成功。
- production成果物633ファイル（mapを含む）を検査し、ローカル.envの4 secret値とDevFrame importが埋め込まれていないことを確認。
- OAuth providerへの実ログイン・実機passkeyは未検証。ローカル専用user/sessionでBetter Authの認可経路を検証した。

## 再開方法と本番切替前の作業

ローカルlink登録後、ライブラリ変更時は先にlibraryをbuildする。

```powershell
# E:\git\site-admin
bun run build
# E:\git\site-admin\packages\site-admin
bun link
# E:\git\liry24.com
bun install
bun run content:generate                            # schema + migration generation
bun run content:migrate                             # explicit local D1 migration
node scripts/migrate-to-site-admin.ts                 # dry-run
node scripts/migrate-to-site-admin.ts --apply         # local D1 only
bun run build
```

ルート.envのD1_NAME/D1_ID等を明示的にbuildへ渡すこと。渡さないとローカルWorkerも別の空DBを参照しうる。
`scripts/prepare-worker-local.mjs` は新規local Worker保存先への明示的なschema/data/Blob準備用。既存保存先を上書きしない。
検証用user/session/entry/uploadは `scripts/test-site-admin-local.mjs` のfinallyで削除する。

npm publish後に、別途明示的に行う作業:

1. linkを公開versionに置換し、lockfileと隔離buildを再検証。
2. 本番DBは既存のDBを使い、CONTENT_DBは作らない。更新停止点で認証・旧contentをbackup/exportし、復元と移行先データのparity手順を先に検証する。
3. `drizzle/20260915190614_site_admin_single_database/migration.sql` をレビューして明示適用し、保存済みexportからcontentを移行する。このSQLには旧content/MCPテーブル削除も含むため、backup/exportと復元検証が終わる前には適用しない。認証user/account/session保持はテスト済み。本番Asset identityと既存R2 keyの対応を確定する。現在のscriptはremoteBindings:falseのローカル専用で、本番移行は別途明示的な作業が必要。
4. 統合Workerの認証secret、OAuth callback、Cron、必要なD1/R2 bindingを確認してからpush/deploy。
5. 切替確認後に旧Worker/Workflowを削除。productionへの削除・migration適用は今回は未実施。
6. Asset参照の照合が終わるまでGCを実行しない。

任意の旧Post Review/AIメタデータUIは継承していない。MCPと同様に旧依存を撤去し、必要なら将来Entry/Revisionを参照するapplication featureとして追加する。
適用済みDrizzle SQL履歴に旧テーブル名が残るのは履歴保存のためで、現行アプリは参照しない。

削除前のsourceはGit HEADと `.data/legacy-baseline.zip`、未commit差分は `.data/pre-legacy-removal.patch`、旧admin生成物は `.data/legacy-admin-artifacts` に保存。root移動前の生成物・ローカルdataは `.data/pre-root-home` / `.data/pre-root-layer` に保持。復旧可能。
今回の統合前DBと旧schema/migrationは `.data/pre-single-db-20260916` に追加保存。元のローカルDBも残している。
本番export・認証schema・baseline・backupはすべてignored `.data` 以下にあり、commit対象に含めない。

## 2026-09-16: schema生成の統合

- bun run content:generate は site-admin generate --auth server/auth.config.ts --auth-use-plural --out packages/database/src/schema.ts を実行し、Better Authのpluginを含む認証table・relationsとSite Adminのcontent tableを一括生成する。
- server/auth.config.ts のnative `defineServerAuth()` optionsを実行時と生成時で共有する。生成はBetter AuthのDrizzle relations-v2 adapterのcreateSchemaへ委譲し、接続・認証初期化・DB変更は行わない。
- content-schema.ts と手書きの relations.ts は削除。Drizzle Kitと実行時の参照先は schema.ts のみ。再生成は追加差分なし。
- 公式生成器の外部キー名へ合わせる前進migrationを追加。既存issuer列は追加fieldとして保持し、認証行を保持する回帰テストを実施。適用済み履歴は変更していない。
- ローカルDBは .data/before-unified-schema-20260916 にbackup後、migrationを適用。本番変更・push・deploy・publishなし。
- CoreのDrizzle依存は後続のadapter分離で解消（下記参照）。SQLite方言への依存は別の制約として残る。
- 上記のバンドル・ソース量の表は、このschema生成統合より前の測定値。

## 2026-09-16: CoreのDrizzle adapter分離

- CoreとNuxtのDB型は @liria24/site-admin/adapter の SiteAdminDatabase を使用。Drizzleのtable metadata・値変換・insert SQL生成・native client・transaction/batch処理はadapter内へ移動した。
- query / atomic / bind のSQLite契約を公開。bindはapplication-owned schemaを照合し、schema検査・revision投影・型付きrevision書込みを返す。CoreはDrizzleをimportしない。
- Prisma / TypeORM / Sequelize / MikroORMのSQLite raw-queryとtransactionによる追加を想定。ORM固有の戻り値・型変換・エラー・schema generationは各adapterの責任。他ORM実装や依存追加は行っていない。
- SQL方言の抽象化は対象外。PostgreSQL/MySQL/MongoDB対応は別途storage backendを設計する。Drizzle非依存とDB非依存を混同しない。
- 既存の drizzleAdapter(db, { schema }) の呼び出しは変更不要。DB schema変更・migration追加なし。
- Node SQLiteの非DrizzleテストadapterでCRUD・公開・競合・rollbackを検証。配布consumerではDrizzleのimportを禁止してCoreを読み込むチェックを追加。

## 2026-09-30: npm v0.0.0への切替

- Site Adminの全変更とCI修正をmainへpushし、`f9439aff7448dd34b9258c38474af34714630d61`に`v0.0.0`タグを付けた。[CI](https://github.com/liria24/site-admin/actions/runs/36628149010)は全ジョブ成功。単体42件、Linux/WindowsのNuxt、D1/R2、bun/npm/pnpmの配布パッケージ検証を含む。
- `@liria24/site-admin@0.0.0`をnpmへ初回公開。公開tarballのSHA-1は`12c75acbfa74c86f19abbd53eba7d536e108debb`で、ローカルの配布検証対象と一致。初回は対話2FAで公開したため、CI由来のprovenanceは付与していない。
- liry24.comの依存を`0.0.0`に完全固定してbun.lockを更新。旧symlinkを解除し、`bun ci`で公開版を取得した。実パスもliry24.com配下のnode_modulesで、別リポジトリへの参照は残っていない。
- Cloudflare Worker起動時にPasskeyの証明書検証依存（tsyringe）が停止する不具合を修正。`nitro.moduleSideEffects: ['reflect-metadata']`で既存polyfillの削除を防ぎ、追加依存や起動時の動的importは不要。
- Workerをローカル検証する場合は`--local --persist-to .data/unified --test-scheduled --var NUXT_PUBLIC_SITE_URL:http://127.0.0.1:3100`を指定する。認証secretはローカル`.env`と一致する値をignoredな`.output/server/.dev.vars`へ設定する。公開URLを本番のままにするとブラウザ認証が本番originへ向かう。
- 実行確認は既存の`node --env-file=.env scripts/test-site-admin-local.mjs http://127.0.0.1:3100 --worker --browser`を使用。公開ページ、匿名管理画面404/API401、管理者セッション、CRUD、競合、公開/予約/復元、Cron、フォームの連続保存、11MiBのR2アップロードと参照解除を検証した。
- npm公開版へ切替後もformat/lint/typecheck、unit 3件・DB 2件、Cloudflare build、上記Worker/Chrome検証が成功。robots/sitemap/llms/llms-fullはすべて200、公開7 Modelは合計28件を維持。公開版CLIの生成schemaとは生成元コメントを揃えて一致し、今回の切替による追加DB migrationは不要。
- liry24.comは未push・未deploy。本番D1/R2の変更は行っていない。

## 2026-10-01: cfとWorkers Previews

- Cloudflare操作をcf CLIへ移行。設定、ブランチ別D1/R2、GitHub管理者限定ログイン、Secrets、削除手順は [cloudflare-previews.md](./cloudflare-previews.md) を参照。
- ローカルWorkerの認証secret配置先はルート `.dev.vars`。旧 `.output/server/.dev.vars` 手順を置き換える。ローカル保存先 `.data/unified/v3` は維持。
- Previewには空のschemaのみを作成。本番DB移行とproduction deploymentは別作業のまま。
