# Xserver公開チェックリスト

## 1. ビルド

公開前にローカルでビルドします。

```bash
npm run build
```

成功すると `dist/` に静的ファイルが生成されます。

## 2. アップロード

Xserverには次のように配置します。

- `dist/` の中身 -> `public_html/`
- `api/` -> `public_html/api/`
- `cron/` -> できれば `public_html` の外側。難しければ `public_html/cron/`
- `database/schema.sql` -> 初期セットアップ用。公開ページとしては使いません

`cron/.htaccess` と `database/.htaccess` は、これらのフォルダを
`public_html` 配下に置いた場合でもWebアクセスを拒否するためのものです。
CronからPHPファイルを実行することはできます。

## 3. 本番DB設定

サーバー上で設定ファイルを作ります。

```bash
cp api/config.example.php api/config.php
```

`api/config.php` にXserverのMySQL情報を設定します。

- DBホスト
- DBポート
- DB名
- DBユーザー
- DBパスワード

本番用の `api/config.php` は公開環境ごとに変わるため、Gitには含めません。

## 4. テーブル作成

本番DBにテーブルを作成します。

```bash
mysql -h your_mysql_host -u your_mysql_user -p your_database_name < database/schema.sql
```

Xserverの管理画面やphpMyAdminを使う場合は、`database/schema.sql` の内容を実行します。

## 5. 過去シーズン投入

初回のみ、必要な過去シーズンを取り込みます。

```bash
php cron/import-games.php 2025-26 backfill
php cron/import-games.php 2024-25 backfill
php cron/import-games.php 2023-24 backfill
```

取り込み済みデータから順位・勝率集計だけ作り直したい場合はこちらです。

```bash
php cron/rebuild-records.php 2025-26
php cron/rebuild-records.php 2024-25
php cron/rebuild-records.php 2023-24
```

## 6. Cron設定

XserverのCronで、現行シーズンの更新を定期実行します。

```bash
/usr/bin/php /home/your_account/path/to/cron/import-games.php 2025-26 latest
```

試合開催日やプレーオフ期間は、1日1回より多めに実行しても構いません。

## 7. 公開後の確認

アップロード後、次のURLを確認します。

```txt
https://your-domain.example/
https://your-domain.example/api/health.php
https://your-domain.example/api/team-records.php?season=2025-26&division=B1
https://your-domain.example/api/recent-games.php?season=2024-25&division=B2&limit=5
```

`/api/health.php` が `ok: true` を返し、`teams`、`games`、`records` の件数が
0より大きければ、DB接続とデータ投入は成功しています。

## 8. 公開時の注意

- `api/config.php` にはDBパスワードが入るため、外部共有しません
- `cron/` は可能なら `public_html` の外に置きます
- `database/schema.sql` は公開後の初期化・確認用として保管します
- フロントは `/api/...` を同一ドメインで呼び出す前提です
