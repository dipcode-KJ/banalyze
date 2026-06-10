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
  ink: "#10121d",
  graphite: "#2f341c",
  muted: "#e6edcc",
  neon: "#d7ff00",
  shade900: "#161d00",
  shade700: "#334700",
  shade500: "#5f8000",
  shade300: "#92bd00",
  shade100: "#c4ef00",
};

const shadeScale = ["#161d00", "#243200", "#334700", "#496300", "#5f8000", "#7fa800", "#a5d100", "#d7ff00"];

const shadeByIndex = (index: number, total: number) => {
  const scaleIndex = Math.min(shadeScale.length - 1, Math.floor((index / Math.max(1, total - 1)) * (shadeScale.length - 1)));
  return shadeScale[scaleIndex];
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
      grid: { color: "rgba(95, 128, 0, 0.18)" },
    },
  },
};

export default function StatsDashboard() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
  const { teams, source } = useSeasonData(selectedSeason, selectedDivision);
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
        backgroundColor: chartTeams.map((_, index) => (index === 0 ? chartPalette.neon : shadeByIndex(index, chartTeams.length))),
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
        borderColor: chartPalette.shade500,
        backgroundColor: "rgba(95, 128, 0, 0.16)",
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
          <img alt="NINES ANALYZE" src="/nines_analyze_logo.svg" />
        </a>
        <nav className="siteNav" aria-label="主要ナビゲーション">
          <a href="/"><span>Home</span><small>使い方</small></a>
          <a href="/dashboard"><span>Dashboard</span><small>全体</small></a>
          <a href="/teams"><span>Teams</span><small>チーム</small></a>
          <a href="/rankings"><span>Rankings</span><small>順位</small></a>
          <a href="/analytics"><span>Analytics</span><small>分析</small></a>
          <a href="/trends"><span>Trends</span><small>推移</small></a>
          <a href="/results"><span>Results</span><small>結果</small></a>
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
            <a className="textAction" href="/results">
              試合結果へ
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
                <img alt="NINES ANALYZE" src="/nines_analyze_logo_wht.svg" />
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
