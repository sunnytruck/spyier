# GitHub Pagesでテストプレイを公開する

ゲームのエンジン・カード・敵・セーブのキーとバージョンは変更しません。リポジトリの公開範囲をワークフローが自動変更することもありません。

**確認結果：GitHub FreeのPrivateリポジトリではPagesを利用できませんが、Publicなら利用できます。現在はGitHubの公開ページからPublicであることを確認済みです。** 所有者からPublicへの変更を明示的に許可済みです。この環境からのGitHub API操作はForbiddenで拒否されたため、こちらから公開範囲やPages設定を変更したわけではありません。

その後、所有者による設定後の [Actions実行](https://github.com/sunnytruck/spyier/actions/runs/39185160437) で **Test and build・Deploy to GitHub Pagesの両方が成功**し、公開先 `https://sunnytruck.github.io/spyier/` が表示されることを確認しました。初回有効化は完了しています。以下の初回手順は、設定をやり直す場合の記録です。この環境から公開ドメインへの直接アクセスは接続プロキシに403で拒否されるため、公開ページそのものの操作確認と、Actionsの公開成功確認は区別します。

## Privateリポジトリで利用できるか

GitHubの公式案内では、PrivateリポジトリのPagesはGitHub Pro、Team、Enterpriseで利用できます。個人アカウントのGitHub Freeでは、PrivateリポジトリのままGitHub Pagesは利用できません。

- 公式案内: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- 個人のプラン: 右上のプロフィール画像 → Settings → Billing and licensing（画面によってBilling & plans）→ 現在のプラン。
- リポジトリ側: https://github.com/sunnytruck/spyier/settings/pages を開きます。利用できない場合はアップグレードを案内する表示が出ます。

この開発環境からGitHub APIを使ってリポジトリとPages設定を調べようとしましたが、API接続がForbiddenで拒否されました。契約プランは所有者の回答と公式の利用条件から判断しています。GitHub上での既存設定は直接取得できていません。Gitの読み書き権限があることと、Pages利用資格があることは別です。

Privateリポジトリから作るPagesサイトも、通常はインターネット上に公開されます。サイトのアクセス制限には別のEnterprise向け要件があります。リポジトリのPrivate設定とは区別してください。

## 初回設定の記録（現在は設定済み）

あなたのブラウザでGitHubにログインして操作します。PCでコマンドを打つ必要はありません。

1. Publicであることを確認します。**現在は確認済みなので、この操作は不要です。** 今後Privateへ戻した場合は https://github.com/sunnytruck/spyier/settings の **General → 最下部のDanger Zone → Change repository visibility → Change to public** から変更できます。
2. https://github.com/sunnytruck/spyier/settings/pages を開き、**Build and deployment → Source → GitHub Actions** を選びます。「Deploy from a branch」は選びません。
3. **Settings → Actions → General** でActionsが有効であり、GitHub公式の `actions/*` が許可されていることを確認します。組織のポリシーでPagesやOIDCが禁止されている場合は管理者の設定が必要です。
4. **Settings → Environments → github-pages** に承認ルールがある場合、初回のActions画面で必要な承認を行います。継続的な自動公開を希望する場合は、所有者の判断で承認ルールを調整してください。
5. https://github.com/sunnytruck/spyier/actions を開き、**Build and deploy IWASON SPIRE → Run workflow → Branch: main → Run workflow** を押します。Publicへ切り替えた後に新しい実行を開始してください。
6. **Test and build** と **Deploy to GitHub Pages** の両方が緑色になるのを待ちます。成功後、デプロイ欄に表示されるURLを開きます。標準の公開先は **https://sunnytruck.github.io/spyier/** です。

Publicの場合、公開を有効にする追加変数は不要です。将来、有料プランでPrivateに戻してPagesを使う場合だけ、**Settings → Secrets and variables → Actions → Variables** に `ENABLE_GITHUB_PAGES=true` を設定します。Free・Privateでこの変数だけを設定してもPagesは利用できません。

個人のアクセストークンを登録する必要はありません。ワークフローはGitHubが発行する `GITHUB_TOKEN` とOIDCを使い、公開ジョブだけに `pages: write` と `id-token: write` を付けます。ソースへの書き込み権限は付けていません。Pagesの有効化と公開範囲の変更をワークフローから勝手に行いません。

## 以後のCodex開発

1. このリポジトリのコードをCodexで変更します。
2. `npm test` と `npm run build` を確認し、変更を `main` へcommit・pushします。PRの場合は `main` へのマージが公開のきっかけです。
3. Actionsが `npm ci` → テスト → 型チェック・Viteビルド → `dist/` のアップロードを行います。Publicなら続けてPagesへデプロイします。有料Privateの場合は `ENABLE_GITHUB_PAGES=true` を条件にします。
4. その後は同じ公開URLで更新版をテストプレイできます。PRではテスト・ビルドだけ実行し、公開版を更新しません。

ゲームのソースや `node_modules` は公開物に含めず、`dist/` だけを配信します。ブラウザが実行するJavaScriptは公開サイトから取得できます。失敗したビルドはデプロイされません。`gh-pages` ブランチやビルド済みファイルをソースにコミットする運用は不要です。

Viteの `base` は `/spyier/` です。画像・リンクを今後追加する場合も、先頭 `/` 固定のサイトルート参照を避け、Viteのimportか `import.meta.env.BASE_URL` を使ってください。リポジトリ名を変更するときは、このbaseと公開URLも更新します。

## セーブデータへの影響

保存キーとデータ形式は従来どおりです。

| 内容 | キー                       |
| ---- | -------------------------- |
| 探索 | `iwason-spire:run:v2`      |
| 練習 | `iwason-spire:save:v1`     |
| 設定 | `iwason-spire:settings:v1` |

- 同じブラウザ・同じ公開ドメインであれば、通常の再デプロイでセーブは消えません。デプロイ処理はlocalStorageに触れません。
- localhostやCodexのプレビューとGitHub Pagesは別の保存場所です。公開先で以前のセーブが見えなくても、元のセーブが消えたわけではありません。自動転送・共有はしません。
- localStorageはプロトコル・ホスト・ポート単位です。`sunnytruck.github.io` 上の他のパスも同じ保存領域を共有します。このゲームを同じドメインへ複製する場合はキーの衝突に注意してください。
- ブラウザのデータ消去やシークレットモード終了、別端末への変更では継続できません。手動で開発者ツールからデータを移す作業は、この公開設定には含めません。

## Pagesを利用できない場合

リポジトリをPublicに変更せず、次のどちらかを選べます。代替サービスへの接続・公開は勝手には行いません。

| 選択肢                          | Privateリポジトリ | 必要な設定                                                                                                   |
| ------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------ |
| GitHub Proに変更してPagesを使う | 維持              | 上のPages初回設定。コードやワークフローの変更は不要                                                          |
| Cloudflare Pagesで公開する      | 維持              | GitHub連携でこのリポジトリだけ許可し、下記の `/spyier/` 配置設定を使う。mainへpushすると自動更新             |
| Vercelで公開する                | 維持              | Privateリポジトリのインポートに加え、`/spyier/` のリライト設定が必要。アカウント・用途ごとのプラン条件も確認 |

### Privateを維持する場合の代替：Cloudflare Pages

この方法ならGitHubをFree・Privateのまま使い、Viteの `/spyier/` も維持できます。Cloudflareのアカウント作成とGitHub連携は所有者が行います。Codexにパスワードやトークンを渡す必要はありません。

1. Cloudflareの管理画面で **Workers & Pages → Pagesの新規プロジェクト → Gitリポジトリの接続** を開きます。
2. GitHubとの連携を許可し、対象リポジトリを **sunnytruck/spyier** にします。選択できる場合はこのリポジトリだけを許可します。
3. Production branchを **main**、Framework presetを **None** にします。
4. **Build command欄**に、次の1行を入力します。あなたのPCのコマンド画面に入力するものではありません。

   ```sh
   npm run build && mkdir -p pages-output/spyier && cp -R dist/. pages-output/spyier/
   ```

5. **Build output directory** を **pages-output** にします。環境変数 **NODE_VERSION** を **24** にします。
6. **Save and Deploy** でビルドが成功したら、Cloudflareが表示する `https://プロジェクト名.pages.dev` の末尾に **/spyier/** を付けて開きます。
7. 以後はCodexからGitHubのmainへpushすると、Cloudflareが自動で公開版を更新します。GitHub Actions側のPages公開変数は未設定のままで構いません。

出力を `pages-output/spyier/` に置くことで、JavaScriptやCSSの `/spyier/assets/...` と実際の配置を一致させます。Viteのbaseを変更する必要はありません。サイトのルートURLではなく `/spyier/` をテストプレイURLとして使います。Cloudflareでの契約・公開設定の作成と外部デプロイは、このリポジトリへの変更だけでは実行されません。

Actionsの **Test and build** には `iwason-spire-dist` という成果物を残します。Pagesの有効化ができなくてもテスト・ビルドの結果と成果物を確認できます。Cloudflareを使う場合も、Pages公開変数を未設定にしてこのワークフローをテスト・ビルド用として使えます。

## 失敗箇所の確認

- テスト・ビルドが赤い: Actionsの該当ステップを開いてエラーを確認します。公開版は更新されません。
- Check Pages configurationが失敗: SourceがGitHub Actionsか、PrivateでPagesを利用できるプランかを確認します。
- Deployが403: Pages権限・OIDC・組織ポリシー・Environmentの承認条件を確認します。
- 公開ページが404: 両ジョブの成功と、末尾を含む `/spyier/` のURLを確認します。PrivateでのPages契約条件も確認してください。

設定ファイルの保存・Gitへのpushと、GitHub側でのデプロイ成功は別です。Actionsの成功と実URLの応答を確認するまでは、公開済みとは扱いません。
