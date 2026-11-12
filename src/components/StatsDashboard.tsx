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
import { Activity, ArrowRight, ArrowUpDown, CalendarRange, Database, TrendingUp } from "lucide-react";
import { Bar, Line } from "react-chartjs-2";
import { pointDiff, seasonLabels, type SeasonKey, type TeamRecord, winRate } from "../data/mockStats";
import { type DivisionFilter, useSeasonData, useSeasonSeries } from "../hooks/useSeasonData";
import SiteFooter from "./SiteFooter";
import "./StatsDashboard.css";
import LeagueWebGL from "./LeagueWebGL";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

const chartPalette = {
  ink: "#0f172a",
  graphite: "#334155",
  muted: "#94a3b8",
  neon: "#ff5722",
  neonGlow: "rgba(255, 87, 34, 0.2)",
  cyan: "#06b6d4",
  cyanGlow: "rgba(6, 182, 212, 0.18)",
  emerald: "#10b981",
  gridLine: "rgba(15, 23, 42, 0.06)",
};

const modernBarColors = [
  "#ff5722",
  "#ff6b35",
  "#ff7f49",
  "#ff935e",
  "#ffa673",
  "#3b82f6",
  "#60a5fa",
  "#06b6d4",
  "#22d3ee",
  "#64748b",
  "#94a3b8",
  "#cbd5e1",
];

const barColorByIndex = (index: number) => {
  return modernBarColors[index % modernBarColors.length];
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false as const,
  plugins: {
    legend: {
      labels: {
        color: "#475569",
        boxWidth: 12,
        font: {
          family: "'Plus Jakarta Sans', 'Inter', sans-serif",
          weight: 600,
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: "#0f172a",
      titleColor: "#ffffff",
      bodyColor: "#f1f5f9",
      padding: 10,
      cornerRadius: 8,
      boxPadding: 4,
    },
  },
  scales: {
    x: {
      ticks: {
        color: "#64748b",
        font: {
          family: "'Plus Jakarta Sans', 'Inter', sans-serif",
          size: 11,
          weight: 600,
        },
      },
      grid: { display: false },
    },
    y: {
      ticks: {
        color: "#64748b",
        font: {
          family: "'Plus Jakarta Sans', 'Inter', sans-serif",
          size: 11,
        },
      },
      grid: { color: chartPalette.gridLine },
    },
  },
};

export default function StatsDashboard() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const { teams, source } = useSeasonData(selectedSeason, selectedDivision);
  const { series } = useSeasonSeries(selectedDivision);

  const sortedTeams = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const chartTeams = sortedTeams.slice(0, 12);
  const leader = sortedTeams[0] ?? emptyTeam(selectedDivision);
  const totalGames = teams.reduce((sum, team) => sum + team.wins + team.losses, 0) / 2;
  const avgPoints = totalGames > 0 ? Math.round(teams.reduce((sum, team) => sum + team.pointsFor, 0) / (totalGames * 2)) : 0;
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
        label: "勝率 (%)",
        data: chartTeams.map((team) => Number((winRate(team) * 100).toFixed(1))),
        backgroundColor: chartTeams.map((_, index) => barColorByIndex(index)),
        borderColor: "transparent",
        borderWidth: 0,
        borderRadius: 6,
      },
    ],
  };

  const pointDiffData = {
    labels: chartTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "得失点差",
        data: chartTeams.map(pointDiff),
        borderColor: chartPalette.neon,
        backgroundColor: chartPalette.neonGlow,
        fill: true,
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBorderWidth: 2,
        pointBorderColor: "#ffffff",
        pointBackgroundColor: chartPalette.neon,
      },
    ],
  };

  const historyData = {
    labels: [...seasonLabels].reverse(),
    datasets: [
      {
        label: `${leader.shortName} 勝率推移 (%)`,
        data: leaderHistory,
        borderColor: chartPalette.cyan,
        backgroundColor: chartPalette.cyanGlow,
        fill: true,
        tension: 0.35,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBorderWidth: 2,
        pointBorderColor: "#ffffff",
        pointBackgroundColor: chartPalette.cyan,
      },
    ],
  };

  return (
    <main className="dashboard">
      <section className="hero">
        <div className="heroText" id="overview">
          <p className="eyebrow">B.LEAGUE DATA LAB</p>
          <h1>
            <span>リーグの現在地を</span>
            <span>数字でつかむ。</span>
          </h1>
          <p>
            {selectedSeason} / {selectedDivision} の勝率、得失点差、直近フォームを同じ画面で比較。気になる数字からチームの強さを読み解きます。
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
          <DivisionSwitch activeSeason={selectedSeason} activeDivision={selectedDivision} onDivisionChange={setSelectedDivision} />
          <div className="heroActions">
            <a className="primaryAction" href="#charts">
              グラフを見る
              <ArrowRight size={16} />
            </a>
            <a className="textAction" href="/results">
              試合結果へ
              <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className="heroVisual" aria-label="勝率と得失点差のデータ可視化">
          <div className="heroDataStage">
            <div className="heroDataStageHeader"><span>LIVE STANDINGS</span><strong>{selectedSeason} / {selectedDivision}</strong></div>
            <LeagueWebGL teams={sortedTeams.slice(0, 8).map((team) => ({ name: team.shortName, winRate: winRate(team), margin: pointDiff(team) }))} />
            <div className="heroDataStageFooter"><span><b>{leader.shortName}</b> 現在の勝率トップ</span><span>得失点差 <b>{pointDiff(leader) > 0 ? "+" : ""}{pointDiff(leader)}</b></span></div>
          </div>
        </div>
      </section>

      <section className="metricGrid" aria-label="主要指標">
        <Metric icon={<TrendingUp size={18} />} label="最高勝率" value={`${(winRate(leader) * 100).toFixed(1)}%`} />
        <Metric icon={<Activity size={18} />} label="対象試合" value={`${totalGames}試合`} />
        <Metric icon={<ArrowUpDown size={18} />} label="1試合平均得点" value={`${avgPoints}点`} />
        <Metric icon={<CalendarRange size={18} />} label="データ" value={source === "db" ? "DB/API" : source === "loading" ? "確認中" : selectedSeason} />
      </section>

      <section className="contentGrid" id="charts">
        <article className="chartPanel">
          <div className="panelHeader">
            <div>
              <p>Win Rate</p>
              <h2>チーム勝率</h2>
              <small>勝利数を総試合数で割った割合です。高いほど安定して勝っているチームとして見られます。</small>
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
              <small>総得点から総失点を引いた値です。勝敗だけでは見えない試合内容の優位性を確認できます。</small>
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
              <small>現在のトップチームが過去シーズンでも強かったのか、単年で伸びたのかを見るグラフです。</small>
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
            <small>勝敗、勝率、HOME/AWAY、直近5試合をまとめた基本順位表です。</small>
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
                  <TeamNameCell name={team.name} shortName={team.shortName} />
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

      <section className="noticeBand" aria-label="サイト利用上の注意">
        <div>
          <p>Unofficial Notice</p>
          <h2>B.LEAGUE公式サイトではありません。</h2>
        </div>
        <p>
          本サイトは公開されている試合結果をもとに独自に集計・可視化した非公式の分析サイトです。
          データの正確性・完全性は保証しません。公式情報はB.LEAGUE公式サイトをご確認ください。
        </p>
      </section>
      <SiteFooter />
    </main>
  );
}

function DivisionSwitch({
  activeSeason,
  activeDivision,
  onDivisionChange,
}: {
  activeSeason: SeasonKey;
  activeDivision: DivisionFilter;
  onDivisionChange: (division: DivisionFilter) => void;
}) {
  const divisionOptions = (activeSeason === "2026-27" ? ["ALL", "B.PREMIER", "B.ONE", "B.NEXT"] : ["ALL", "B1", "B2"]) as DivisionFilter[];

  return (
    <div className="divisionSwitch" aria-label="ディビジョン選択">
      {divisionOptions.map((division) => (
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

function TeamNameCell({ name, shortName }: { name: string; shortName: string }) {
  const showName = normalizeTeamLabel(name) !== normalizeTeamLabel(shortName);

  return (
    <td className="teamNameCell">
      <strong>{shortName}</strong>
      {showName && <span>{name}</span>}
    </td>
  );
}

function normalizeTeamLabel(value: string) {
  return value.replace(/\s+/g, "").trim();
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
