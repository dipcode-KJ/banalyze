import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo, useState } from "react";
import { ArrowRight, Menu } from "lucide-react";
import { Bar, Line, Scatter } from "react-chartjs-2";
import { pointDiff, seasonLabels, type SeasonKey, type TeamRecord, winRate } from "../data/mockStats";
import { type DivisionFilter, useSeasonData, useSeasonSeries } from "../hooks/useSeasonData";
import SiteFooter from "./SiteFooter";
import "./StatsDashboard.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const chartPalette = {
  ink: "#111111",
  graphite: "#3d3d3d",
  muted: "#c9c9c9",
  neon: "#d7ff00",
  purple: "#7c4dff",
  cyan: "#00c2ff",
  coral: "#ff5c35",
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: {
    legend: {
      labels: {
        color: "#333333",
        boxWidth: 12,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: "#333333" },
      grid: { display: false },
    },
    y: {
      ticks: { color: "#333333" },
      grid: { color: "rgba(17, 17, 17, 0.1)" },
    },
  },
};

export function TeamsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { teams } = useSeasonData(selectedSeason, selectedDivision);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const chartTeams = sortedTeams.slice(0, 16);

  const homeAwayData = {
    labels: chartTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "HOME勝率",
        data: chartTeams.map((team) => Number((rate(team.homeWins, team.homeWins + team.homeLosses) * 100).toFixed(1))),
        backgroundColor: chartPalette.neon,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "AWAY勝率",
        data: chartTeams.map((team) => Number((rate(team.awayWins, team.awayWins + team.awayLosses) * 100).toFixed(1))),
        backgroundColor: chartPalette.purple,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  return (
    <PageFrame
      eyebrow="Team Analytics"
      title="チーム別の強さを分解する。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
    >
      <section className="dataGrid twoColumns">
        <DataPanel label="Home / Away" title="ホーム・アウェイ勝率" description="ホーム開催時とアウェイ開催時の勝率を比較します。内弁慶型か、場所を問わず勝てるかを見られます。">
          <div className="chartBox">
            <Bar data={homeAwayData} options={chartOptions} />
          </div>
        </DataPanel>
        <div className="rankPanel">
          <p>Efficiency Ranking</p>
          <h2>得失点差ランキング</h2>
          <small>総得点から総失点を引いた差です。大きいほど試合内容で相手を上回っている傾向があります。</small>
          {sortedTeams.map((team, index) => (
            <article className="rankItem" key={team.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{team.shortName}</strong>
              <em>{pointDiff(team)}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="tableSection pageTable">
        <div className="sectionHeader">
          <div>
            <p>Team Matrix</p>
            <h2>詳細チームスタッツ</h2>
            <small>勝率、平均得点、平均失点、HOME/AWAY成績を一覧で比較できます。</small>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>チーム</th>
                <th>勝率</th>
                <th>勝敗</th>
                <th>平均得点</th>
                <th>平均失点</th>
                <th>得失点差</th>
                <th>HOME</th>
                <th>AWAY</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => {
                const games = team.wins + team.losses;
                return (
                  <tr key={team.id}>
                    <td>
                      <strong>{team.shortName}</strong>
                      <span>{team.name}</span>
                    </td>
                    <td>{(winRate(team) * 100).toFixed(1)}%</td>
                    <td>
                      {team.wins}-{team.losses}
                    </td>
                    <td>{games > 0 ? (team.pointsFor / games).toFixed(1) : "-"}</td>
                    <td>{games > 0 ? (team.pointsAgainst / games).toFixed(1) : "-"}</td>
                    <td className={pointDiff(team) >= 0 ? "positive" : "negative"}>{pointDiff(team)}</td>
                    <td>
                      {team.homeWins}-{team.homeLosses}
                    </td>
                    <td>
                      {team.awayWins}-{team.awayLosses}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

export function TrendsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { teams } = useSeasonData(selectedSeason, selectedDivision);
  const { series } = useSeasonSeries(selectedDivision);
  const sortedTeams = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const topTeams = sortedTeams.slice(0, 4);

  const trendData = {
    labels: [...seasonLabels].reverse(),
    datasets: topTeams.map((team, index) => ({
      label: team.shortName,
      data: [...seasonLabels]
        .reverse()
        .map((label) => series[label]?.find((item) => item.shortName === team.shortName || item.id === team.id))
        .map((matched) => (matched ? Number((winRate(matched) * 100).toFixed(1)) : null)),
      borderColor: [chartPalette.ink, chartPalette.purple, chartPalette.cyan, chartPalette.coral][index],
      backgroundColor: "rgba(255, 255, 255, 0)",
      tension: 0.35,
      pointRadius: 5,
      pointBorderWidth: 2,
      pointBorderColor: chartPalette.ink,
      pointBackgroundColor: [chartPalette.neon, chartPalette.purple, chartPalette.cyan, chartPalette.coral][index],
    })),
  };

  const marginData = {
    labels: sortedTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "得失点差",
        data: sortedTeams.map(pointDiff),
        backgroundColor: sortedTeams.map((team, index) => {
          if (index === 0) return chartPalette.neon;
          if (pointDiff(team) >= 250) return chartPalette.purple;
          return chartPalette.graphite;
        }),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  return (
    <PageFrame
      eyebrow="Season Trends"
      title="過去シーズンの変化を読む。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
    >
      <section className="dataGrid">
        <DataPanel label="Win Rate Trend" title="上位チームの勝率推移" description="選択シーズンの上位チームについて、過去シーズンの勝率変化を見ます。継続的な強さと急伸を判別できます。">
          <div className="chartBox">
            <Line data={trendData} options={chartOptions} />
          </div>
        </DataPanel>
        <DataPanel label="Point Margin" title="選択シーズンの得失点差" description="選択中のシーズン・ディビジョンで、どのチームが得失点面で優位かを比較します。">
          <div className="chartBox">
            <Bar data={marginData} options={chartOptions} />
          </div>
        </DataPanel>
      </section>

      <section className="insightStrip">
        {topTeams.map((team) => (
          <article key={team.id}>
            <span>{team.shortName}</span>
            <strong>{(winRate(team) * 100).toFixed(1)}%</strong>
            <small>{pointDiff(team)} margin</small>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function ResultsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { recentGames: games } = useSeasonData(selectedSeason, selectedDivision);
  const chartGames = games.slice(0, 12);
  const highScoreGames = [...games].sort((a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore));

  const scoreData = {
    labels: chartGames.map((game) => `${game.home}-${game.away}`),
    datasets: [
      {
        label: "HOME",
        data: chartGames.map((game) => game.homeScore),
        backgroundColor: chartPalette.neon,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "AWAY",
        data: chartGames.map((game) => game.awayScore),
        backgroundColor: chartPalette.purple,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  return (
    <PageFrame
      eyebrow="Game Results"
      title="試合結果をカードで追う。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
    >
      <section className="dataGrid twoColumns">
        <DataPanel label="Score Compare" title="試合別スコア比較" description="直近試合ごとのHOME得点とAWAY得点を比較します。接戦、大差、ホーム優勢を見分けやすくします。">
          <div className="chartBox">
            <Bar data={scoreData} options={chartOptions} />
          </div>
        </DataPanel>
        <div className="rankPanel">
          <p>High Score Games</p>
          <h2>合計得点ランキング</h2>
          <small>両チームの得点合計が高い試合です。ハイスコアゲームや攻撃的な展開を探せます。</small>
          {highScoreGames.map((game, index) => (
            <article className="rankItem" key={game.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>
                {game.home} vs {game.away}
              </strong>
              <em>{game.homeScore + game.awayScore}</em>
            </article>
          ))}
        </div>
      </section>

      <section className="resultsBoard">
        {games.map((game) => (
          <article className="resultCard" key={game.id}>
            <time dateTime={game.date}>{game.date}</time>
            <div>
              <span>{game.home}</span>
              <strong>
                {game.homeScore} - {game.awayScore}
              </strong>
              <span>{game.away}</span>
            </div>
            <small>{game.venue}</small>
          </article>
        ))}
      </section>
    </PageFrame>
  );
}

export function AnalyticsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { teams } = useSeasonData(selectedSeason, selectedDivision);
  const profiles = useMemo(
    () =>
      teams
        .map((team) => ({
          team,
          offense: avgFor(team),
          defense: avgAgainst(team),
          homeAwayGap: homeAwayGap(team),
          form: formScore(team),
          balance: balanceScore(team),
          composite: compositeScore(team),
        }))
        .sort((a, b) => b.composite - a.composite),
    [teams],
  );
  const chartProfiles = profiles.slice(0, 16);

  const quadrantData = {
    datasets: profiles.map((profile, index) => ({
      label: profile.team.shortName,
      data: [{ x: Number(profile.offense.toFixed(1)), y: Number(profile.defense.toFixed(1)) }],
      backgroundColor: [chartPalette.neon, chartPalette.purple, chartPalette.cyan, chartPalette.coral, chartPalette.ink, chartPalette.graphite][index],
      borderColor: chartPalette.ink,
      borderWidth: 1,
      pointRadius: 8,
      pointHoverRadius: 10,
    })),
  };

  const dependencyData = {
    labels: chartProfiles.map((profile) => profile.team.shortName),
    datasets: [
      {
        label: "ホーム依存度",
        data: chartProfiles.map((profile) => Number(profile.homeAwayGap.toFixed(1))),
        backgroundColor: chartProfiles.map((profile) => (profile.homeAwayGap >= 10 ? chartPalette.coral : chartPalette.cyan)),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  const formData = {
    labels: chartProfiles.map((profile) => profile.team.shortName),
    datasets: [
      {
        label: "直近フォーム",
        data: chartProfiles.map((profile) => profile.form),
        backgroundColor: chartProfiles.map((_, index) => (index === 0 ? chartPalette.neon : chartPalette.purple)),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "安定度",
        data: chartProfiles.map((profile) => profile.balance),
        backgroundColor: chartPalette.graphite,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  return (
    <PageFrame
      eyebrow="Deep Analytics"
      title="チームを多角的に読む。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
    >
      <section className="analysisCards">
        <div className="analysisIntro">
          <p>Composite Score</p>
          <h2>総合スコア上位</h2>
          <small>勝率、得失点差、直近フォーム、安定度を組み合わせた独自指標です。チームの総合的な状態をざっくり比較できます。</small>
        </div>
        {profiles.slice(0, 4).map((profile, index) => (
          <article key={profile.team.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <h2>{profile.team.shortName}</h2>
            <strong>{profile.composite}</strong>
            <p>
              攻撃 {profile.offense.toFixed(1)} / 守備 {profile.defense.toFixed(1)} / 直近 {profile.form}
            </p>
          </article>
        ))}
      </section>

      <section className="dataGrid">
        <DataPanel label="Offense / Defense Map" title="攻撃・守備ポジション" description="横軸が平均得点、縦軸が平均失点です。右に行くほど攻撃力が高く、上に行くほど失点が少ない見方です。">
          <div className="chartBox">
            <Scatter data={quadrantData} options={scatterOptions} />
          </div>
        </DataPanel>
        <DataPanel label="Home Dependency" title="ホーム依存度" description="HOME勝率とAWAY勝率の差です。数値が大きいほどホーム環境への依存が強い可能性があります。">
          <div className="chartBox">
            <Bar data={dependencyData} options={chartOptions} />
          </div>
        </DataPanel>
      </section>

      <section className="dataGrid oneWide">
        <DataPanel label="Form / Stability" title="直近フォームと安定度" description="直近フォームは直近5試合の勝利割合、安定度は得失点差とホーム依存度をもとにした独自指標です。">
          <div className="chartBox">
            <Bar data={formData} options={chartOptions} />
          </div>
        </DataPanel>
      </section>

      <section className="tableSection pageTable">
        <div className="sectionHeader">
          <div>
            <p>Analysis Matrix</p>
            <h2>多角指標マトリクス</h2>
            <small>総合、攻撃、守備、勝率、ホーム依存、直近フォーム、安定度を同じ表で比較できます。</small>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>チーム</th>
                <th>総合</th>
                <th>攻撃</th>
                <th>守備</th>
                <th>勝率</th>
                <th>ホーム依存</th>
                <th>直近フォーム</th>
                <th>安定度</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.team.id}>
                  <td>
                    <strong>{profile.team.shortName}</strong>
                    <span>{profile.team.name}</span>
                  </td>
                  <td>{profile.composite}</td>
                  <td>{profile.offense.toFixed(1)}</td>
                  <td>{profile.defense.toFixed(1)}</td>
                  <td>{(winRate(profile.team) * 100).toFixed(1)}%</td>
                  <td>{profile.homeAwayGap.toFixed(1)}</td>
                  <td>{profile.form}</td>
                  <td>{profile.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

function PageFrame({
  eyebrow,
  title,
  activeSeason,
  activeDivision,
  onSeasonChange,
  onDivisionChange,
  children,
}: {
  eyebrow: string;
  title: string;
  activeSeason: SeasonKey;
  activeDivision: DivisionFilter;
  onSeasonChange: (season: SeasonKey) => void;
  onDivisionChange: (division: DivisionFilter) => void;
  children: React.ReactNode;
}) {
  return (
    <main className="dashboard statPage">
      <header className="siteHeader">
        <a className="brand" href="/">
          <img alt="NINES DATA ANALYZE" src="/nines_dataanalyze.svg" />
        </a>
        <nav className="siteNav" aria-label="主要ナビゲーション">
          <a href="/">Overview</a>
          <a href="/teams">Teams</a>
          <a href="/analytics">Analytics</a>
          <a href="/trends">Trends</a>
          <a href="/results">Results</a>
        </nav>
        <a className="headerCta" href="/teams">
          詳細データ
          <ArrowRight size={14} />
        </a>
        <button className="menuButton" aria-controls="mobile-drawer" aria-expanded="false" aria-label="メニュー" type="button">
          <Menu size={22} />
        </button>
        <MobileDrawer />
      </header>

      <section className="pageHero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="seasonSwitch" aria-label="シーズン選択">
          {seasonLabels.map((label) => (
            <button
              aria-pressed={activeSeason === label}
              className={activeSeason === label ? "active" : ""}
              key={label}
              onClick={() => onSeasonChange(label)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
        <DivisionSwitch activeDivision={activeDivision} onDivisionChange={onDivisionChange} />
      </section>

      {children}
      <SiteFooter />
    </main>
  );
}

function MobileDrawer() {
  return (
    <div className="mobileDrawer" id="mobile-drawer">
      <div className="mobileDrawerTop">
        <img alt="NINES DATA ANALYZE" src="/nines_dataanalyze_wht.svg" />
        <span>Menu</span>
      </div>
      <nav className="mobileDrawerNav" aria-label="モバイルナビゲーション">
        <a href="/"><span>01</span>Overview</a>
        <a href="/teams"><span>02</span>Teams</a>
        <a href="/analytics"><span>03</span>Analytics</a>
        <a href="/trends"><span>04</span>Trends</a>
        <a href="/results"><span>05</span>Results</a>
        <a href="/terms"><span>06</span>Terms</a>
        <a href="/privacy"><span>07</span>Privacy</a>
      </nav>
      <a className="mobileDrawerContact" href="https://kjnine.com/contact" rel="noreferrer" target="_blank">
        Contact
        <ArrowRight size={18} />
      </a>
    </div>
  );
}

function DivisionSwitch({
  activeDivision,
  onDivisionChange,
}: {
  activeDivision: DivisionFilter;
  onDivisionChange: (division: DivisionFilter) => void;
}) {
  return (
    <div className="divisionSwitch compactSwitch" aria-label="ディビジョン選択">
      {(["ALL", "B1", "B2"] as DivisionFilter[]).map((division) => (
        <button
          aria-pressed={activeDivision === division}
          className={activeDivision === division ? "active" : ""}
          key={division}
          onClick={() => onDivisionChange(division)}
          type="button"
        >
          {division}
        </button>
      ))}
    </div>
  );
}

function DataPanel({
  label,
  title,
  description,
  children,
}: {
  label: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="chartPanel">
      <div className="panelHeader">
        <div>
          <p>{label}</p>
          <h2>{title}</h2>
          {description ? <small>{description}</small> : null}
        </div>
      </div>
      {children}
    </article>
  );
}

const scatterOptions = {
  ...chartOptions,
  scales: {
    x: {
      title: { display: true, text: "平均得点", color: chartPalette.ink },
      ticks: { color: chartPalette.graphite },
      grid: { color: "rgba(17, 17, 17, 0.1)" },
    },
    y: {
      reverse: true,
      title: { display: true, text: "平均失点", color: chartPalette.ink },
      ticks: { color: chartPalette.graphite },
      grid: { color: "rgba(17, 17, 17, 0.1)" },
    },
  },
};

function avgFor(team: TeamRecord) {
  const games = team.wins + team.losses;
  return games > 0 ? team.pointsFor / games : 0;
}

function avgAgainst(team: TeamRecord) {
  const games = team.wins + team.losses;
  return games > 0 ? team.pointsAgainst / games : 0;
}

function homeAwayGap(team: TeamRecord) {
  const homeGames = team.homeWins + team.homeLosses;
  const awayGames = team.awayWins + team.awayLosses;
  const homeRate = homeGames > 0 ? team.homeWins / homeGames : 0;
  const awayRate = awayGames > 0 ? team.awayWins / awayGames : 0;
  return Math.abs(homeRate - awayRate) * 100;
}

function formScore(team: TeamRecord) {
  return team.lastFive.length > 0 ? Math.round((team.lastFive.filter((result) => result === "W").length / team.lastFive.length) * 100) : 0;
}

function balanceScore(team: TeamRecord) {
  const games = team.wins + team.losses;
  const marginPerGame = games > 0 ? pointDiff(team) / games : 0;
  const dependencyPenalty = homeAwayGap(team) * 0.35;
  return Math.max(0, Math.round(70 + marginPerGame * 1.8 - dependencyPenalty));
}

function compositeScore(team: TeamRecord) {
  const score = winRate(team) * 55 + Math.max(0, pointDiff(team) / 8) + formScore(team) * 0.18 + balanceScore(team) * 0.24;
  return Math.round(score);
}

function rate(value: number, total: number) {
  return total > 0 ? value / total : 0;
}
