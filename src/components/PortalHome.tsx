import { Activity, ArrowRight, BarChart3, Flag, ListOrdered, ShieldCheck } from "lucide-react";
import { winRate, type SeasonKey } from "../data/mockStats";
import { useSeasonData } from "../hooks/useSeasonData";
import SiteFooter from "./SiteFooter";

const shortcuts = [
  { href: "/dashboard/", label: "全体ダッシュボード", icon: Activity },
  { href: "/rankings/", label: "スタッツランキング", icon: ListOrdered },
  { href: "/teams/", label: "チーム比較", icon: BarChart3 },
  { href: "/japan/", label: "男子日本代表", icon: Flag },
  { href: "/forecast/", label: "試合予測", icon: ShieldCheck },
];

export default function PortalHome() {
  const season: SeasonKey = "2026-27";
  const { recentGames, teams, source } = useSeasonData(season, "B.PREMIER");
  const leaders = [...teams].sort((a, b) => winRate(b) - winRate(a)).slice(0, 5);
  const loaded = source !== "loading";

  return (
    <main className="analyzeHome">
      <div className="homeMasthead">
        <div className="homeContent homeMastheadInner">
          <p><Activity size={16} aria-hidden="true" /> B.LEAGUE / DATA DESK</p>
          <h1>NINES ANALYZE</h1>
          <div className="homeEdition"><span>{season}</span><strong>B.PREMIER</strong></div>
        </div>
      </div>
      <div className="homeContent">
        <div className="homeScoreboard">
          <section className="homeResults" aria-labelledby="home-results-title">
            <header className="homeSectionHeader">
              <div><p>01 / RESULTS</p><h2 id="home-results-title">最新試合結果</h2></div>
              <a href="/results/">全試合 <ArrowRight size={16} aria-hidden="true" /></a>
            </header>
            {loaded && recentGames.length > 0 ? (
              <ul className="homeGames">
                {recentGames.slice(0, 4).map((game) => (
                  <li key={game.id}>
                    <time dateTime={game.date}>{game.date.replaceAll("-", ".")}</time>
                    <div className="homeGameTeams">
                      <div><span className={game.homeScore > game.awayScore ? "homeWinner" : ""}>{game.home}</span><strong>{game.homeScore}</strong></div>
                      <div><span className={game.awayScore > game.homeScore ? "homeWinner" : ""}>{game.away}</span><strong>{game.awayScore}</strong></div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="homeEmpty" role="status">{loaded ? "試合結果はまだありません。" : "試合結果を取得中…"}</p>}
          </section>
          <section className="homeStandings" aria-labelledby="home-standings-title">
            <header className="homeSectionHeader">
              <div><p>02 / WIN RATE</p><h2 id="home-standings-title">勝率トップ5</h2></div>
              <a href="/teams/">チーム一覧 <ArrowRight size={16} aria-hidden="true" /></a>
            </header>
            {loaded && leaders.length > 0 ? (
              <ol className="homeLeaders">
                {leaders.map((team, index) => (
                  <li key={team.id}>
                    <span className="homeRank">{String(index + 1).padStart(2, "0")}</span>
                    <span>{team.shortName}</span>
                    <strong>{(winRate(team) * 100).toFixed(1)}<small>%</small></strong>
                  </li>
                ))}
              </ol>
            ) : <p className="homeEmpty" role="status">{loaded ? "チーム成績はまだありません。" : "チーム成績を取得中…"}</p>}
          </section>
        </div>
        {source === "mock" && <p className="homeSource" role="status">{recentGames.length || leaders.length ? "データを取得できないため、サンプルを表示しています。" : "現在、データを取得できません。"}</p>}
        <section className="homeExplore" aria-labelledby="home-explore-title">
          <header className="homeSectionHeader"><div><p>03 / EXPLORE</p><h2 id="home-explore-title">データを探す</h2></div></header>
          <div className="homeShortcuts">
            {shortcuts.map(({ href, label, icon: Icon }) => (
              <a href={href} key={href}><Icon size={20} aria-hidden="true" /><strong>{label}</strong><ArrowRight size={16} aria-hidden="true" /></a>
            ))}
          </div>
        </section>
      </div>
      <SiteFooter />
    </main>
  );
}
