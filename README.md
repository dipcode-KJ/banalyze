# NINES DATA

Bリーグの試合結果を収集し、勝率・得失点差・ホーム/アウェイ成績・直近フォームを可視化する統計Webサービスです。

## Stack

- Astro + React + TypeScript
- Chart.js
- PHP API
- MySQL / MariaDB on Xserver
- Xserver Cron

## Repository

```txt
git@github.com:dipcode-KJ/banalyze.git
```

## Database

The production database is intended to be Xserver's MySQL-compatible database
service. Xserver commonly exposes MySQL/MariaDB through PHP PDO, so the app's
dynamic layer is written as PHP API endpoints backed by the schema in
`database/schema.sql`.

React pages fetch JSON from the PHP endpoints and fall back to
`src/data/mockStats.ts` only when the API is unavailable:

```txt
/api/team-records.php?season=2025-26
/api/recent-games.php?season=2025-26&limit=20
/api/team-records.php?season=2024-25&division=B1
/api/recent-games.php?season=2023-24&division=B2&limit=20
/api/health.php
```

Local database config is stored in `api/config.php` and is ignored by git. The
current local connection target is:

```txt
host: 127.0.0.1
port: 8889
socket: /Applications/MAMP/tmp/mysql/mysql.sock
database: ninesdataanalyze
user: root
```

## Local Development

```bash
npm install
npm run dev:api
npm run dev
```

`npm run dev` proxies `/api/*` to `http://127.0.0.1:8088`, so keep
`npm run dev:api` running in another terminal when checking live DB data.

Open the local app at:

```txt
http://127.0.0.1:4321/
```

## Initial Data Setup

Create the MySQL tables first:

```bash
mysql -h 127.0.0.1 -P 8889 -u root -p ninesdataanalyze < database/schema.sql
```

For MAMP local development, the password is currently `root` and the app uses
the socket in `api/config.php`.

Backfill current and historical seasons:

```bash
php cron/import-games.php 2025-26 backfill
php cron/import-games.php 2024-25 backfill
php cron/import-games.php 2023-24 backfill
```

Rebuild standings from already imported games without fetching remote data:

```bash
php cron/rebuild-records.php 2025-26
php cron/rebuild-records.php 2024-25
php cron/rebuild-records.php 2023-24
```

For daily updates, schedule the latest importer with Xserver Cron:

```bash
/usr/bin/php /home/your_account/your_domain/public_html/cron/import-games.php 2025-26 latest
```

## Build for Xserver

```bash
npm run build
```

Upload the generated `dist/` directory contents to `public_html`.

PHP API files in `api/`, Cron scripts in `cron/`, and the MySQL schema in `database/schema.sql` are deployment scaffolds for the dynamic data layer.

## Pages

- `/` overview dashboard
- `/teams` team ranking, home/away splits, scoring profile
- `/trends` multi-season trend charts
- `/results` game result cards and score comparison

## Data Flow

1. `cron/import-games.php` fetches schedule/result data.
2. Normalized rows are saved to MySQL tables.
3. Public API endpoints return compact JSON.
4. Astro/React UI renders standings, win rate charts, and recent games.

## Historical Seasons

The data model is season-aware. Store every game and aggregate with a `season`
value such as `2025-26`, `2024-25`, or `2023-24`. The importer reads B1 and
B2 result tabs and skips event/youth teams such as All-Star and U18 entries.

```bash
php cron/import-games.php 2025-26
php cron/import-games.php 2025-26 month 05
php cron/import-games.php 2024-25 backfill
php cron/import-games.php 2023-24 backfill
```

Public API examples:

```txt
/api/team-records.php?season=2025-26
/api/recent-games.php?season=2024-25&limit=20
/api/team-records.php?season=2024-25&division=B1
/api/recent-games.php?season=2023-24&division=B2&limit=20
```

## Deployment Notes

Copy `api/config.example.php` to `api/config.php` on the server and set the Xserver MySQL credentials. Do not commit the real `config.php`.

Before uploading, run `npm run build`, then upload `dist/`, `api/`, `cron/`,
and `database/schema.sql` as needed. Keep `api/config.php` server-specific.

Detailed Xserver steps are in `docs/xserver-deploy.md`.
