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
import { Activity, ArrowRight, ArrowUpDown, CalendarRange, Database, Menu, TrendingUp } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
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
        color: "#334155",
        boxWidth: 12,
      },
    },
  },
  scales: {
    x: {
      ticks: { color: "#475569" },
      grid: { display: false },
    },
    y: {
      ticks: { color: "#475569" },
      grid: { color: "rgba(148, 163, 184, 0.24)" },
    },
  },
};

export default function StatsDashboard() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { teams, recentGames, source } = useSeasonData(selectedSeason, selectedDivision);
  const { series } = useSeasonSeries(selectedDivision);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const chartTeams = sortedTeams.slice(0, 12);
  const leader = sortedTeams[0] ?? emptyTeam(selectedDivision);
  const totalGames = teams.reduce((sum, team) => sum + team.wins + team.losses, 0) / 2;
  const avgPoints = teams.length > 0 ? Math.round(teams.reduce((sum, team) => sum + team.pointsFor, 0) / teams.length) : 0;
  const leaderHistory = [...seasonLabels]
    .reverse()
    .map((label) => {
      const matched = series[label]?.find((team) => team.shortName === leader.shortName || team.id === leader.id);
      return matched ? Number((winRate(matched) * 100).toFixed(1)) : null;
    });

  const winRateData = {
    labels: chartTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "勝率",
        data: chartTeams.map((team) => Number((winRate(team) * 100).toFixed(1))),
        backgroundColor: chartTeams.map((_, index) =>
          [chartPalette.neon, chartPalette.ink, chartPalette.purple, chartPalette.cyan, chartPalette.graphite, chartPalette.muted][index] ??
          chartPalette.muted,
        ),
        borderColor: chartPalette.ink,
        borderWidth: 1,
        borderRadius: 0,
      },
    ],
  };

  const pointDiffData = {
    labels: chartTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "得失点差",
        data: chartTeams.map(pointDiff),
        borderColor: chartPalette.purple,
        backgroundColor: "rgba(124, 77, 255, 0.1)",
        tension: 0.35,
        pointRadius: 5,
        pointBorderWidth: 2,
        pointBorderColor: chartPalette.ink,
        pointBackgroundColor: chartPalette.neon,
      },
    ],
  };

  const historyData = {
    labels: [...seasonLabels].reverse(),
    datasets: [
      {
        label: `${leader.shortName} 勝率`,
        data: leaderHistory,
        borderColor: chartPalette.ink,
        backgroundColor: "rgba(215, 255, 0, 0.16)",
        tension: 0.35,
        pointRadius: 6,
        pointBorderWidth: 2,
        pointBorderColor: chartPalette.ink,
        pointBackgroundColor: chartPalette.neon,
      },
    ],
  };

  return (
    <main className="dashboard">
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
        <button className="menuButton" aria-label="メニュー">
          <Menu size={22} />
        </button>
      </header>

      <section className="hero">
        <div className="heroText" id="overview">
          <p className="eyebrow">B.LEAGUE DATA LAB</p>
          <h1>
            <span>Bリーグ成績を</span>
            <span>シーズン別に追う。</span>
          </h1>
          <p>
            試合結果を収集し、現行シーズンから過去シーズンまで勝率・得失点差・対戦傾向を可視化します。
          </p>
          <div className="seasonSwitch" aria-label="シーズン選択">
            {seasonLabels.map((label) => (
              <button
                aria-pressed={selectedSeason === label}
                className={selectedSeason === label ? "active" : ""}
                key={label}
                onClick={() => setSelectedSeason(label)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <DivisionSwitch activeDivision={selectedDivision} onDivisionChange={setSelectedDivision} />
          <div className="heroActions">
            <a className="primaryAction" href="#charts">
              グラフを見る
              <ArrowRight size={16} />
            </a>
            <a className="textAction" href="#results">
              最新結果へ
              <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className="heroVisual" aria-label="データプレビュー">
          <svg className="deco decoSmiley" viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" />
            <circle cx="35" cy="42" r="6" fill="currentColor" />
            <circle cx="65" cy="42" r="6" fill="currentColor" />
            <path d="M30 62 Q50 78 70 62" stroke="currentColor" strokeWidth="5" fill="none" strokeLinecap="round" />
          </svg>
          <svg className="deco decoCrown" viewBox="0 0 120 80" fill="none" aria-hidden="true">
            <path d="M10 70 L10 30 L35 50 L60 10 L85 50 L110 30 L110 70 Z" stroke="currentColor" strokeWidth="4" fill="none" />
          </svg>
          <div className="phoneMock">
            <div className="phoneScreen">
              <div className="phoneTop">
                <img alt="NINES DATA ANALYZE" src="/nines_dataanalyze_wht.svg" />
                <span>{selectedSeason} / {selectedDivision}</span>
              </div>
              <p className="phoneLabel">WIN RATE LEADER</p>
              <h2>{leader.shortName}</h2>
              <strong>{(winRate(leader) * 100).toFixed(1)}%</strong>
              <div className="miniBars">
                {sortedTeams.slice(0, 5).map((team) => (
                  <span key={team.id} style={{ height: `${Math.max(26, winRate(team) * 100)}%` }} title={team.shortName} />
                ))}
              </div>
              <div className="phoneMeta">
                <span>{totalGames} Games</span>
                <span>{pointDiff(leader)} Margin</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="metricGrid" aria-label="主要指標">
        <Metric icon={<TrendingUp size={18} />} label="最高勝率" value={`${(winRate(leader) * 100).toFixed(1)}%`} />
        <Metric icon={<Activity size={18} />} label="対象試合" value={`${totalGames}試合`} />
        <Metric icon={<ArrowUpDown size={18} />} label="平均得点" value={`${avgPoints}点`} />
        <Metric icon={<CalendarRange size={18} />} label="データ" value={source === "db" ? "DB/API" : selectedSeason} />
      </section>

      <section className="contentGrid" id="charts">
        <article className="chartPanel">
          <div className="panelHeader">
            <div>
              <p>Win Rate</p>
              <h2>チーム勝率</h2>
            </div>
            <span>{selectedSeason} / {selectedDivision}</span>
          </div>
          <div className="chartBox">
            <Bar data={winRateData} options={chartOptions} />
          </div>
        </article>

        <article className="chartPanel">
          <div className="panelHeader">
            <div>
              <p>Point Margin</p>
              <h2>得失点差推移</h2>
            </div>
            <span>{selectedSeason} / {selectedDivision}</span>
          </div>
          <div className="chartBox">
            <Line data={pointDiffData} options={chartOptions} />
          </div>
        </article>
      </section>

      <section className="historySection">
        <article className="chartPanel">
          <div className="panelHeader">
            <div>
              <p>Season Trend</p>
              <h2>勝率トップチームの過去推移</h2>
            </div>
            <span>{leader.shortName}</span>
          </div>
          <div className="chartBox compact">
            <Line data={historyData} options={chartOptions} />
          </div>
        </article>
        <article className="seasonNote">
          <span><Database size={18} /></span>
          <h2>過去シーズンも同じ形式で蓄積</h2>
          <p>
            DB側は試合・集計テーブルに `season` を持たせているので、Cronで年度を指定して取り込めば同じ画面で切り替えられます。
          </p>
        </article>
      </section>

      <section className="tableSection" id="standings">
        <div className="sectionHeader">
          <div>
            <p>Standings</p>
            <h2>チーム別成績</h2>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>チーム</th>
                <th>地区</th>
                <th>勝敗</th>
                <th>勝率</th>
                <th>HOME</th>
                <th>AWAY</th>
                <th>得失点差</th>
                <th>直近5試合</th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team) => (
                <tr key={team.id}>
                  <td>
                    <strong>{team.shortName}</strong>
                    <span>{team.name}</span>
                  </td>
                  <td>{team.conference}</td>
                  <td>
                    {team.wins}-{team.losses}
                  </td>
                  <td>{(winRate(team) * 100).toFixed(1)}%</td>
                  <td>
                    {team.homeWins}-{team.homeLosses}
                  </td>
                  <td>
                    {team.awayWins}-{team.awayLosses}
                  </td>
                  <td className={pointDiff(team) >= 0 ? "positive" : "negative"}>{pointDiff(team)}</td>
                  <td>
                    <div className="formDots">
                      {team.lastFive.map((result, index) => (
                        <span className={result === "W" ? "win" : "loss"} key={`${team.id}-${index}`}>
                          {result}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="gamesSection" id="results">
        <div className="sectionHeader">
          <div>
            <p>Recent Results</p>
            <h2>最新試合結果</h2>
          </div>
        </div>
        <div className="gameList">
          {recentGames.map((game) => (
            <article className="gameItem" key={game.id}>
              <time dateTime={game.date}>{game.date}</time>
              <div className="scoreLine">
                <span>{game.home}</span>
                <strong>
                  {game.homeScore} - {game.awayScore}
                </strong>
                <span>{game.away}</span>
              </div>
              <small>{game.venue}</small>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
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
    <div className="divisionSwitch" aria-label="ディビジョン選択">
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function emptyTeam(division: DivisionFilter): TeamRecord {
  return {
    id: `empty-${division}`,
    name: "データ取得中",
    shortName: "取得中",
    division,
    conference: null,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    homeWins: 0,
    homeLosses: 0,
    awayWins: 0,
    awayLosses: 0,
    lastFive: [],
  };
}
