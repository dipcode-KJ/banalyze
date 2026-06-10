import {
  ArrowRight,
  BarChart3,
  Database,
  Gauge,
  ListOrdered,
  LineChart,
  Menu,
  Search,
  ShieldCheck,
  Table2,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";
import { type GameResult, type SeasonKey } from "../data/mockStats";
import { useSeasonData } from "../hooks/useSeasonData";
import SiteFooter from "./SiteFooter";
import "./StatsDashboard.css";

const portalLinks = [
  {
    href: "/dashboard",
    eyebrow: "Overview",
    title: "全体ダッシュボード",
    description: "シーズン別の勝率、得失点差、直近結果をまとめて確認する入口です。まず全体像を掴みたいときに使います。",
    icon: BarChart3,
  },
  {
    href: "/teams",
    eyebrow: "Teams",
    title: "チーム別スタッツ",
    description: "勝率、平均得点、平均失点、HOME/AWAY勝率を表で比較できます。列見出しでソート可能です。",
    icon: Table2,
  },
  {
    href: "/analytics",
    eyebrow: "Analytics",
    title: "多角指標分析",
    description: "攻撃、守備、ホーム依存度、直近フォーム、安定度、独自の総合スコアを横断して確認できます。",
    icon: Search,
  },
  {
    href: "/trends",
    eyebrow: "Trends",
    title: "シーズン推移",
    description: "過去シーズンとの勝率推移や得失点差の傾向を見ます。継続的な強さや変化を追うページです。",
    icon: LineChart,
  },
  {
    href: "/results",
    eyebrow: "Results",
    title: "試合結果",
    description: "試合カード、スコア比較、合計得点ランキングを確認できます。結果一覧は縦にスクロールできます。",
    icon: ListOrdered,
  },
];

const conceptCards = [
  {
    title: "結果を集める",
    description: "公開されている試合結果をシーズン単位で整理し、チーム、カテゴリ、会場条件ごとに追える状態にします。",
    icon: Database,
  },
  {
    title: "強さを比べる",
    description: "勝率だけで終わらせず、得失点差、平均得点、平均失点、HOME/AWAY差からチームの輪郭を見ます。",
    icon: Gauge,
  },
  {
    title: "変化を読む",
    description: "過去シーズンとの比較や直近フォームを重ねて、今の順位の背景にある流れを確認します。",
    icon: Trophy,
  },
];

export default function PortalHome() {
  const currentSeason: SeasonKey = "2025-26";
  const { recentGames, source } = useSeasonData(currentSeason, "ALL");
  const latestGames = useMemo(() => recentGames.slice(0, 4), [recentGames]);

  return (
    <main className="dashboard portalPage">
      <header className="siteHeader">
        <a className="brand" href="/">
          <img alt="NINES ANALYZE" src="/nines_analyze_logo.svg" />
        </a>
        <nav className="siteNav" aria-label="主要ナビゲーション">
          <a href="/">
            <span>Home</span>
            <small>使い方</small>
          </a>
          <a href="/dashboard">
            <span>Dashboard</span>
            <small>全体</small>
          </a>
          <a href="/teams">
            <span>Teams</span>
            <small>チーム</small>
          </a>
          <a href="/rankings">
            <span>Rankings</span>
            <small>順位</small>
          </a>
          <a href="/analytics">
            <span>Analytics</span>
            <small>分析</small>
          </a>
          <a href="/trends">
            <span>Trends</span>
            <small>推移</small>
          </a>
          <a href="/results">
            <span>Results</span>
            <small>結果</small>
          </a>
        </nav>
        <a className="headerCta" href="https://kjnine.com" rel="noreferrer" target="_blank">
          KJ9へ
          <ArrowRight size={14} />
        </a>
        <button className="menuButton" aria-controls="mobile-drawer" aria-expanded="false" aria-label="メニュー" type="button">
          <Menu size={22} />
        </button>
        <MobileDrawer />
      </header>

      <section className="portalHero">
        <div className="portalHeroText">
          <p className="eyebrow">B.LEAGUE DATA PORTAL</p>
          <h1>試合結果の先にあるチームの現在地</h1>
          <p>
            NINES ANALYZEは、Bリーグの試合結果を勝率、得失点差、HOME/AWAY成績、シーズン推移へ変換し、
            順位表だけでは見えにくい強さの理由を探る非公式データポータル。
          </p>
          <div className="portalActions">
            <a className="primaryAction" href="/dashboard">
              全体ダッシュボードへ
              <ArrowRight size={16} />
            </a>
            <a className="textAction" href="/teams">
              チーム別に見る
              <ArrowRight size={14} />
            </a>
            <a className="textAction" href="https://kjnine.com" rel="noreferrer" target="_blank">
              KJ9を見る
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
        <div className="portalHeroMedia" aria-label="Bリーグ分析イメージ">
          <img
            alt="バスケットボールコートのイメージ"
            src="https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=82"
          />
          <div className="heroDataCard">
            <span>Win Rate</span>
            <strong>72.4%</strong>
            <small>勝敗を起点に、得失点差と会場条件まで重ねて確認。</small>
          </div>
          <div className="heroMiniChart" aria-hidden="true">
            <i style={{ height: "38%" }} />
            <i style={{ height: "64%" }} />
            <i style={{ height: "52%" }} />
            <i style={{ height: "82%" }} />
            <i style={{ height: "70%" }} />
          </div>
        </div>
      </section>

      <section className="portalLatest" aria-label="最新試合結果">
        <div className="sectionHeader">
          <div>
            <p>Recent Results</p>
            <h2>最新試合結果</h2>
            <small>
              {currentSeason}シーズンの直近ゲームを表示しています。試合一覧やスコア比較はResultsページで確認できます。
            </small>
          </div>
          <a className="textAction" href="/results">
            全試合を見る
            <ArrowRight size={14} />
          </a>
        </div>
        <div className="portalGameList">
          {latestGames.map((game) => (
            <LatestGameCard game={game} key={game.id} />
          ))}
        </div>
        <p className="portalDataNote">
          {source === "loading" ? "データ取得中" : source === "db" ? "取り込み済みデータベースから表示中" : "サンプルデータで表示中"}
        </p>
      </section>

      <section className="portalVisualBand" aria-label="サイトの特徴">
        <article className="visualPhotoCard">
          <img
            alt="バスケットボールリング"
            loading="lazy"
            src="https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=900&q=82"
          />
          <div>
            <p>Live Context</p>
            <h2>試合結果を、比較できる形に整える。</h2>
          </div>
        </article>
        <article className="visualDataPanel">
          <p>Season Map</p>
          <h2>勝率、得失点差、直近フォームを横断。</h2>
          <div className="dataBars" aria-hidden="true">
            <span style={{ width: "84%" }} />
            <span style={{ width: "66%" }} />
            <span style={{ width: "76%" }} />
            <span style={{ width: "58%" }} />
          </div>
        </article>
        <article className="visualPhotoCard visualPhotoCardDark">
          <img
            alt="バスケットボールゲームのイメージ"
            loading="lazy"
            src="https://images.unsplash.com/photo-1515523110800-9415d13b84a8?auto=format&fit=crop&w=900&q=82"
          />
          <div>
            <p>Team Lens</p>
            <h2>順位だけでは拾えない、強さの質を見る。</h2>
          </div>
        </article>
      </section>

      <section className="portalGuide" aria-label="使い方">
        <article>
          <span>01</span>
          <h2>シーズンとカテゴリを選ぶ</h2>
          <p>各ページ上部のシーズン切り替えとALL/B1/B2で、見たい対象を絞り込みます。</p>
        </article>
        <article>
          <span>02</span>
          <h2>グラフで傾向を見る</h2>
          <p>勝率、得失点差、HOME/AWAY差などをグラフで見て、気になるチームや傾向を探します。</p>
        </article>
        <article>
          <span>03</span>
          <h2>表で根拠を確認する</h2>
          <p>詳細表はソートできます。順位だけでなく、攻撃、守備、安定度など別軸で見直せます。</p>
        </article>
      </section>

      <section className="portalConcept" aria-label="コンセプト">
        <div className="sectionHeader">
          <div>
            <p>Concept</p>
            <h2>見る順番を変えると、リーグの見え方が変わる。</h2>
            <small>公式順位の確認ではなく、試合結果から「なぜその数字になっているか」を追うための入口です。</small>
          </div>
        </div>
        <div className="conceptGrid">
          {conceptCards.map(({ title, description, icon: Icon }) => (
            <article key={title}>
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="portalLinks" aria-label="ページ一覧">
        <div className="sectionHeader">
          <div>
            <p>Pages</p>
            <h2>目的別にページを選ぶ</h2>
            <small>最初はDashboardで全体を見て、気になる観点ごとに各ページへ進むのがおすすめです。</small>
          </div>
        </div>
        <div className="portalLinkGrid">
          {portalLinks.map(({ href, eyebrow, title, description, icon: Icon }) => (
            <a className="portalLinkCard" href={href} key={href}>
              <span>
                <Icon size={20} />
              </span>
              <p>{eyebrow}</p>
              <h3>{title}</h3>
              <small>{description}</small>
              <em>
                開く
                <ArrowRight size={14} />
              </em>
            </a>
          ))}
        </div>
      </section>

      <section className="portalTrust" aria-label="データ掲載方針">
        <div>
          <ShieldCheck size={22} />
          <h2>非公式だからこそ、計算式と見方を明示します。</h2>
        </div>
        <p>
          掲載データは公開されている試合結果をもとに独自集計しています。勝率は「勝利数 ÷ 試合数」、得失点差は「総得点 - 総失点」を基本にしています。公式記録や最終確認はB.LEAGUE公式情報をご確認ください。
        </p>
      </section>

      <SiteFooter />
    </main>
  );
}

function LatestGameCard({ game }: { game: GameResult }) {
  const homeWon = game.homeScore > game.awayScore;
  const awayWon = game.awayScore > game.homeScore;

  return (
    <article className="portalGameCard">
      <time dateTime={game.date}>{formatGameDate(game.date)}</time>
      <div className="portalScoreLine">
        <span className={homeWon ? "winner" : ""}>{game.home}</span>
        <strong>
          {game.homeScore} - {game.awayScore}
        </strong>
        <span className={awayWon ? "winner" : ""}>{game.away}</span>
      </div>
      <small>{game.venue}</small>
    </article>
  );
}

function formatGameDate(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

function MobileDrawer() {
  return (
    <div className="mobileDrawer" id="mobile-drawer">
      <div className="mobileDrawerTop">
        <img alt="NINES ANALYZE" src="/nines_analyze_logo_wht.svg" />
        <span>Menu</span>
      </div>
      <nav className="mobileDrawerNav" aria-label="モバイルナビゲーション">
        <a href="/"><span>01</span><strong>Home<small>使い方</small></strong></a>
        <a href="/dashboard"><span>02</span><strong>Dashboard<small>全体</small></strong></a>
        <a href="/teams"><span>03</span><strong>Teams<small>チーム</small></strong></a>
        <a href="/rankings"><span>04</span><strong>Rankings<small>順位</small></strong></a>
        <a href="/analytics"><span>05</span><strong>Analytics<small>分析</small></strong></a>
        <a href="/trends"><span>06</span><strong>Trends<small>推移</small></strong></a>
        <a href="/results"><span>07</span><strong>Results<small>結果</small></strong></a>
        <a href="/terms"><span>08</span><strong>Terms<small>規約</small></strong></a>
        <a href="/privacy"><span>09</span><strong>Privacy<small>方針</small></strong></a>
      </nav>
      <a className="mobileDrawerContact" href="https://kjnine.com" rel="noreferrer" target="_blank">
        KJ9サイトへ
        <ArrowRight size={18} />
      </a>
    </div>
  );
}
