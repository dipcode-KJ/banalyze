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
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Plus, X } from "lucide-react";
import { Bar, Line, Scatter } from "react-chartjs-2";
import { pointDiff, seasonLabels, type AdvancedRankingMetric, type AdvancedRankingRecord, type SeasonKey, type TeamRecord, winRate } from "../data/mockStats";
import { type DataSourceState, type DivisionFilter, useAdvancedRankings, useSeasonData, useSeasonSeries, useTeamAdvancedStats } from "../hooks/useSeasonData";
import SiteFooter from "./SiteFooter";
import "./StatsDashboard.css";

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

type SortDirection = "asc" | "desc";
type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
};
type AnalysisSortKey = "composite" | "offense" | "defense" | "winRate" | "homeAwayGap" | "form" | "balance";
type RankingTone = "shooting" | "creation" | "possession" | "offense" | "defense";
type AdvancedRankingSection = {
  metric: AdvancedRankingMetric;
  title: string;
  label: string;
  description: string;
  records: AdvancedRankingRecord[];
  value: (record: AdvancedRankingRecord) => string;
  tone: RankingTone;
};

const chartPalette = {
  ink: "#0f172a",
  graphite: "#334155",
  muted: "#94a3b8",
  neon: "#ff5722",
  offense: "#ff5722",
  defense: "#f43f5e",
  possession: "#06b6d4",
  creation: "#8b5cf6",
  shade900: "#0f172a",
  shade700: "#1e293b",
  shade500: "#ff5722",
  shade300: "#ff8a50",
  shade100: "#ffcc80",
};

const shadeScale = ["#0f172a", "#1e293b", "#334155", "#475569", "#ff8a50", "#ff7043", "#ff5722", "#f43f5e"];

const shadeByIndex = (index: number, total: number) => {
  const scaleIndex = Math.min(shadeScale.length - 1, Math.floor((index / Math.max(1, total - 1)) * (shadeScale.length - 1)));
  return shadeScale[scaleIndex];
};

const shadeByValue = (value: number, min: number, max: number) => {
  const ratio = max === min ? 0.5 : (value - min) / (max - min);
  const scaleIndex = Math.min(shadeScale.length - 1, Math.max(0, Math.round(ratio * (shadeScale.length - 1))));
  return shadeScale[scaleIndex];
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
      grid: { color: "rgba(15, 23, 42, 0.06)" },
    },
  },
};

export function TeamsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [queryReady, setQueryReady] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "copied" | "failed">("idle");
  const { teams, recentGames, source } = useSeasonData(selectedSeason, selectedDivision);
  const { series, source: seriesSource } = useSeasonSeries(selectedDivision);
  const { stats: advancedStats, source: advancedSource } = useTeamAdvancedStats(selectedSeason, selectedDivision);
  const winRateTeams = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const pointDiffTeams = useMemo(() => [...teams].sort((a, b) => pointDiff(b) - pointDiff(a)), [teams]);
  const offenseTeams = useMemo(() => [...teams].sort((a, b) => avgFor(b) - avgFor(a)), [teams]);
  const defenseTeams = useMemo(() => [...teams].sort((a, b) => avgAgainst(a) - avgAgainst(b)), [teams]);
  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? winRateTeams[0],
    [selectedTeamId, teams, winRateTeams],
  );
  const comparisonTeams = useMemo(() => {
    const ids = comparisonIds.length > 0 ? comparisonIds : winRateTeams.slice(0, 3).map((team) => team.id);
    return ids
      .map((id) => teams.find((team) => team.id === id))
      .filter((team): team is TeamRecord => Boolean(team))
      .slice(0, 4);
  }, [comparisonIds, teams, winRateTeams]);
  const shareUrl = useMemo(
    () => buildTeamsShareUrl(selectedSeason, selectedDivision, selectedTeam?.id ?? null, comparisonTeams.map((team) => team.id)),
    [comparisonTeams, selectedDivision, selectedSeason, selectedTeam?.id],
  );

  useEffect(() => {
    const query = readTeamsQuery();
    setSelectedSeason(query.season);
    setSelectedDivision(query.division);
    setSelectedTeamId(query.teamId);
    setComparisonIds(query.compareIds);
    setQueryReady(true);
  }, []);

  useEffect(() => {
    if (!queryReady || teams.length === 0) return;

    const validIds = new Set(teams.map((team) => team.id));
    const fallbackTeamId = winRateTeams[0]?.id ?? teams[0]?.id ?? null;

    if (!selectedTeamId || !validIds.has(selectedTeamId)) {
      setSelectedTeamId(fallbackTeamId);
    }

    setComparisonIds((currentIds) => {
      const validCurrentIds = currentIds.filter((id) => validIds.has(id)).slice(0, 4);
      if (validCurrentIds.length > 0) {
        return validCurrentIds;
      }

      const defaultIds = winRateTeams.slice(0, 3).map((team) => team.id);
      return defaultIds.length > 0 ? defaultIds : fallbackTeamId ? [fallbackTeamId] : [];
    });
  }, [queryReady, selectedTeamId, teams, winRateTeams]);

  useEffect(() => {
    if (!queryReady) return;
    syncTeamsQuery(selectedSeason, selectedDivision, selectedTeam?.id ?? null, comparisonTeams.map((team) => team.id));
  }, [comparisonTeams, queryReady, selectedDivision, selectedSeason, selectedTeam?.id]);

  if (!selectedTeam) {
    return (
      <PageFrame
        eyebrow="Team Analytics"
        title="選んだチームだけを深く見る。"
        activeSeason={selectedSeason}
        activeDivision={selectedDivision}
        onSeasonChange={setSelectedSeason}
        onDivisionChange={setSelectedDivision}
        source={mergeSource(source, seriesSource)}
      >
        <section className="noticeBand" aria-label="チームデータなし">
          <div>
            <p>No Team Data</p>
            <h2>表示できるチームデータがありません。</h2>
          </div>
          <p>シーズンまたはカテゴリを切り替えて、取得済みのチームデータを確認してください。</p>
        </section>
      </PageFrame>
    );
  }

  const selectedGames = recentGames.filter((game) => game.home === selectedTeam.shortName || game.away === selectedTeam.shortName).slice(0, 6);
  const selectedGamesCount = selectedTeam.wins + selectedTeam.losses;
  const selectedHomeRate = rate(selectedTeam.homeWins, selectedTeam.homeWins + selectedTeam.homeLosses);
  const selectedAwayRate = rate(selectedTeam.awayWins, selectedTeam.awayWins + selectedTeam.awayLosses);
  const selectedTrend = [...seasonLabels]
    .reverse()
    .map((label) => series[label]?.find((team) => team.id === selectedTeam.id || team.shortName === selectedTeam.shortName))
    .map((team) => (team ? Number((winRate(team) * 100).toFixed(1)) : null));
  const selectedTrendCurrent = selectedTrend.at(-1);
  const selectedTrendPrevious = selectedTrend.at(-2);
  const selectedTrendDelta =
    typeof selectedTrendCurrent === "number" && typeof selectedTrendPrevious === "number"
      ? Number((selectedTrendCurrent - selectedTrendPrevious).toFixed(1))
      : null;
  const selectedHomeAwayGap = Math.abs(selectedHomeRate - selectedAwayRate) * 100;
  const selectedAdvancedStats = advancedStats[selectedTeam.id] ?? null;
  const articleMetrics = [
    {
      label: "勝率",
      value: `${(winRate(selectedTeam) * 100).toFixed(1)}%`,
      note: `${rankOf(winRateTeams, selectedTeam)}位 / ${teams.length}チーム`,
    },
    {
      label: "得失点差",
      value: String(pointDiff(selectedTeam)),
      note: `${rankOf(pointDiffTeams, selectedTeam)}位。内容面の優位を確認する軸。`,
    },
    {
      label: "平均得点",
      value: avgFor(selectedTeam).toFixed(1),
      note: `${rankOf(offenseTeams, selectedTeam)}位。攻撃力を語る時の基本指標。`,
    },
    {
      label: "平均失点",
      value: avgAgainst(selectedTeam).toFixed(1),
      note: `${rankOf(defenseTeams, selectedTeam)}位。低いほど守備面で優位。`,
    },
    {
      label: "HOME / AWAY差",
      value: `${selectedHomeAwayGap.toFixed(1)}pt`,
      note: selectedHomeAwayGap >= 15 ? "会場条件による差が大きい可能性。" : "場所に左右されにくい傾向。",
    },
    {
      label: "勝率前年差",
      value: selectedTrendDelta === null ? "-" : `${selectedTrendDelta > 0 ? "+" : ""}${selectedTrendDelta}pt`,
      note: "過去シーズン比較で伸び・失速を確認する軸。",
    },
  ];
  const advancedMetrics = [
    {
      label: "AST",
      value: formatAdvancedValue(selectedAdvancedStats?.assists, "本"),
      note: "アシスト数。ボールがどう得点機会につながったかを見る指標。",
    },
    {
      label: "TO",
      value: formatAdvancedValue(selectedAdvancedStats?.turnovers, "本"),
      note: "ターンオーバー数。攻撃のリスクや安定性を見る指標。",
    },
    {
      label: "REB",
      value: formatAdvancedValue(selectedAdvancedStats?.totalRebounds, "本"),
      note: "総リバウンド数。ポゼッションを終わらせる力を見る指標。",
    },
    {
      label: "3PM",
      value: formatAdvancedValue(selectedAdvancedStats?.threePointMakes, "本"),
      note: "3ポイント成功数。外角から得点に変えた本数。",
    },
    {
      label: "3P%",
      value: formatPercentageValue(selectedAdvancedStats?.threePointPercentage),
      note: "3ポイント成功率。成功数 ÷ 試投数で見る精度。",
    },
    {
      label: "3PA",
      value: formatAdvancedValue(selectedAdvancedStats?.threePointAttempts, "本"),
      note: "3ポイント試投数。外角をどれだけ使ったかを見る指標。",
    },
    {
      label: "PACE",
      value: formatAdvancedValue(selectedAdvancedStats?.pace),
      note: "試合展開の速さ。高いほどテンポが速い傾向。",
    },
    {
      label: "ORtg",
      value: formatAdvancedValue(selectedAdvancedStats?.offensiveRating),
      note: "100ポゼッションあたりの得点効率。",
    },
    {
      label: "DRtg",
      value: formatAdvancedValue(selectedAdvancedStats?.defensiveRating),
      note: "100ポゼッションあたりの失点効率。低いほど良い。",
    },
  ];

  const selectedSplitData = {
    labels: ["勝率", "HOME", "AWAY"],
    datasets: [
      {
        label: selectedTeam.shortName,
        data: [
          Number((winRate(selectedTeam) * 100).toFixed(1)),
          Number((selectedHomeRate * 100).toFixed(1)),
          Number((selectedAwayRate * 100).toFixed(1)),
        ],
        backgroundColor: [chartPalette.neon, chartPalette.shade500, chartPalette.shade300],
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  const selectedScoreData = {
    labels: ["平均得点", "平均失点", "得失点差 / 試合"],
    datasets: [
      {
        label: selectedTeam.shortName,
        data: [
          Number(avgFor(selectedTeam).toFixed(1)),
          Number(avgAgainst(selectedTeam).toFixed(1)),
          Number((selectedGamesCount > 0 ? pointDiff(selectedTeam) / selectedGamesCount : 0).toFixed(1)),
        ],
        backgroundColor: [chartPalette.neon, chartPalette.shade500, chartPalette.shade300],
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  const selectedTrendData = {
    labels: [...seasonLabels].reverse(),
    datasets: [
      {
        label: `${selectedTeam.shortName} 勝率`,
        data: selectedTrend,
        borderColor: chartPalette.shade700,
        backgroundColor: "rgba(215, 255, 0, 0.16)",
        tension: 0.35,
        pointRadius: 5,
        pointBorderWidth: 2,
        pointBorderColor: chartPalette.ink,
        pointBackgroundColor: chartPalette.neon,
      },
    ],
  };
  const comparisonSummaryData = {
    labels: comparisonTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "勝率",
        data: comparisonTeams.map((team) => Number((winRate(team) * 100).toFixed(1))),
        backgroundColor: comparisonTeams.map((_, index) => (index === 0 ? chartPalette.neon : shadeByIndex(index, Math.max(1, comparisonTeams.length)))),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "得失点差 / 試合",
        data: comparisonTeams.map((team) => {
          const games = team.wins + team.losses;
          return Number((games > 0 ? pointDiff(team) / games : 0).toFixed(1));
        }),
        backgroundColor: comparisonTeams.map((_, index) => shadeByIndex(index + 2, Math.max(1, comparisonTeams.length + 2))),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };
  const comparisonSplitData = {
    labels: comparisonTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "HOME勝率",
        data: comparisonTeams.map((team) => Number((rate(team.homeWins, team.homeWins + team.homeLosses) * 100).toFixed(1))),
        backgroundColor: chartPalette.neon,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "AWAY勝率",
        data: comparisonTeams.map((team) => Number((rate(team.awayWins, team.awayWins + team.awayLosses) * 100).toFixed(1))),
        backgroundColor: chartPalette.shade500,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };
  const comparisonEfficiencyData = {
    datasets: comparisonTeams.map((team, index) => {
      const stats = advancedStats[team.id] ?? null;
      return {
        label: team.shortName,
        data: [
          {
            x: Number((stats?.offensiveRating ?? avgFor(team)).toFixed(1)),
            y: Number((stats?.defensiveRating ?? avgAgainst(team)).toFixed(1)),
          },
        ],
        backgroundColor: index === 0 ? chartPalette.neon : comparisonColor(index),
        borderColor: chartPalette.ink,
        borderWidth: 1,
        pointRadius: 9,
        pointHoverRadius: 11,
      };
    }),
  };
  const comparisonRows = comparisonTeams.map((team) => {
    const games = team.wins + team.losses;
    const stats = advancedStats[team.id] ?? null;

    return {
      team,
      games,
      winRate: winRate(team) * 100,
      margin: pointDiff(team),
      marginPerGame: games > 0 ? pointDiff(team) / games : 0,
      homeRate: rate(team.homeWins, team.homeWins + team.homeLosses) * 100,
      awayRate: rate(team.awayWins, team.awayWins + team.awayLosses) * 100,
      assists: stats?.assists ?? null,
      turnovers: stats?.turnovers ?? null,
      threePointPercentage: stats?.threePointPercentage ?? null,
      pace: stats?.pace ?? null,
      offensiveRating: stats?.offensiveRating ?? null,
      defensiveRating: stats?.defensiveRating ?? null,
    };
  });

  function toggleComparisonTeam(teamId: string) {
    setComparisonIds((currentIds) => {
      if (currentIds.includes(teamId)) {
        return currentIds.filter((id) => id !== teamId);
      }

      return [...currentIds, teamId].slice(0, 4);
    });
  }

  function selectFeaturedTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setComparisonIds((currentIds) => {
      if (currentIds.includes(teamId)) {
        return currentIds;
      }

      return [teamId, ...currentIds].slice(0, 4);
    });
  }

  async function copyShareUrl() {
    try {
      await copyText(shareUrl);
      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch {
      setShareState("failed");
      window.setTimeout(() => setShareState("idle"), 1600);
    }
  }

  return (
    <PageFrame
      eyebrow="Team Analytics"
      title="選んだチームだけを深く見る。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
      source={mergeSource(mergeSource(source, seriesSource), advancedSource)}
    >
      <section className="teamDetailPanel">
        <div className="teamPicker" aria-label="チーム選択">
          {winRateTeams.map((team) => (
            <button
              aria-pressed={selectedTeam.id === team.id}
              className={selectedTeam.id === team.id ? "active" : ""}
              key={team.id}
              onClick={() => setSelectedTeamId(team.id)}
              type="button"
            >
              <span>{team.shortName}</span>
              <small>{(winRate(team) * 100).toFixed(1)}%</small>
            </button>
          ))}
        </div>

        <section className="teamComparePanel" aria-label="チーム比較">
          <div className="sectionHeader">
            <div>
              <p>Compare Mode</p>
              <h2>気になるチームを横に並べて見る。</h2>
              <small>最大4チームまで選択できます。URLに条件が反映されるので、記事やSNSから同じ表示状態を共有できます。</small>
            </div>
            <button className="shareButton" onClick={copyShareUrl} type="button">
              {shareState === "copied" ? <Check size={16} /> : <Copy size={16} />}
              {shareState === "copied" ? "コピー済み" : shareState === "failed" ? "コピー失敗" : "共有URL"}
            </button>
          </div>
          <div className="comparisonPicker" aria-label="比較チーム選択">
            {winRateTeams.map((team) => {
              const isCompared = comparisonTeams.some((comparisonTeam) => comparisonTeam.id === team.id);
              const isDisabled = !isCompared && comparisonTeams.length >= 4;

              return (
                <button
                  aria-pressed={isCompared}
                  className={isCompared ? "active" : ""}
                  disabled={isDisabled}
                  key={team.id}
                  onClick={() => toggleComparisonTeam(team.id)}
                  type="button"
                >
                  {isCompared ? <X size={14} /> : <Plus size={14} />}
                  <span>{team.shortName}</span>
                </button>
              );
            })}
          </div>
          <div className="comparisonCards">
            {comparisonRows.map((row) => (
              <article className={selectedTeam.id === row.team.id ? "active" : ""} key={row.team.id}>
                <button onClick={() => selectFeaturedTeam(row.team.id)} type="button">
                  <span>{selectedTeam.id === row.team.id ? "表示中" : "詳細を見る"}</span>
                  <strong>{row.team.shortName}</strong>
                </button>
                <dl>
                  <div>
                    <dt>勝率</dt>
                    <dd>{row.winRate.toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt>得失点差</dt>
                    <dd>{row.margin}</dd>
                  </div>
                  <div>
                    <dt>ORtg</dt>
                    <dd>{formatAdvancedValue(row.offensiveRating)}</dd>
                  </div>
                  <div>
                    <dt>PACE</dt>
                    <dd>{formatAdvancedValue(row.pace)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="comparisonGrid">
            <DataPanel label="Win / Margin" title="勝率と得失点差を比較" description="勝敗の結果と、試合内容に近い得失点差を同時に確認します。">
              <div className="chartBox compactChart">
                <Bar data={comparisonSummaryData} options={chartOptions} />
              </div>
            </DataPanel>
            <DataPanel label="Home / Away" title="開催地別の強さを比較" description="HOMEとAWAYの勝率を並べ、会場条件による差を見ます。">
              <div className="chartBox compactChart">
                <Bar data={comparisonSplitData} options={chartOptions} />
              </div>
            </DataPanel>
            <DataPanel label="ORtg / DRtg Map" title="攻守効率で比較" description="右に行くほど攻撃効率が高く、上に行くほど守備効率が良い配置です。">
              <div className="chartBox compactChart">
                <Scatter data={comparisonEfficiencyData} options={efficiencyScatterOptions} />
              </div>
            </DataPanel>
          </div>
          <div className="tableWrap comparisonTableWrap">
            <table>
              <thead>
                <tr>
                  <th>チーム</th>
                  <th>勝敗</th>
                  <th>勝率</th>
                  <th>得失点差</th>
                  <th>HOME</th>
                  <th>AWAY</th>
                  <th>AST</th>
                  <th>TO</th>
                  <th>3P%</th>
                  <th>PACE</th>
                  <th>ORtg</th>
                  <th>DRtg</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr className={selectedTeam.id === row.team.id ? "selectedRow" : ""} key={row.team.id}>
                    <TeamNameCell name={row.team.name} shortName={row.team.shortName} />
                    <td>{row.team.wins}-{row.team.losses}</td>
                    <td>{row.winRate.toFixed(1)}%</td>
                    <td>{row.margin}</td>
                    <td>{row.homeRate.toFixed(1)}%</td>
                    <td>{row.awayRate.toFixed(1)}%</td>
                    <td>{formatAdvancedValue(row.assists)}</td>
                    <td>{formatAdvancedValue(row.turnovers)}</td>
                    <td>{formatPercentageValue(row.threePointPercentage)}</td>
                    <td>{formatAdvancedValue(row.pace)}</td>
                    <td>{formatAdvancedValue(row.offensiveRating)}</td>
                    <td>{formatAdvancedValue(row.defensiveRating)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="teamProfile">
          <div className="teamProfileLead">
            <p>Team Detail</p>
            <h2>{selectedTeam.name}</h2>
            <small>{selectedSeason} / {selectedDivision} / {selectedTeam.conference ?? "Conference未設定"}</small>
          </div>
          <div className="teamProfileStats">
            <article>
              <span>勝敗</span>
              <strong>{selectedTeam.wins}-{selectedTeam.losses}</strong>
              <small>{selectedGamesCount}試合</small>
            </article>
            <article>
              <span>勝率</span>
              <strong>{(winRate(selectedTeam) * 100).toFixed(1)}%</strong>
              <small>勝利数 ÷ 試合数</small>
            </article>
            <article>
              <span>得失点差</span>
              <strong>{pointDiff(selectedTeam)}</strong>
              <small>{selectedGamesCount > 0 ? `${(pointDiff(selectedTeam) / selectedGamesCount).toFixed(1)} / 試合` : "-"}</small>
            </article>
            <article>
              <span>平均得点</span>
              <strong>{avgFor(selectedTeam).toFixed(1)}</strong>
              <small>平均失点 {avgAgainst(selectedTeam).toFixed(1)}</small>
            </article>
          </div>
        </div>

        <div className="articleDataPanel">
          <div className="sectionHeader">
            <div>
              <p>Team Snapshot</p>
              <h2>チーム分析サマリー</h2>
              <small>選択チームごとに同じ観点で比較できます。各チームの強みや課題を確認するための主要指標です。</small>
            </div>
          </div>
          <div className="articleMetricGrid">
            {articleMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.note}</small>
              </article>
            ))}
          </div>
          <div className="advancedMetricPanel">
            <div>
              <p>Advanced Stats</p>
              <h3>高度指標</h3>
              <small>
                {selectedAdvancedStats
                  ? `取得元: ${selectedAdvancedStats.source ?? "登録データ"}`
                  : "詳細スタッツは未取得です。データ登録後に同じ場所へ表示されます。"}
              </small>
            </div>
            <div className="advancedMetricGrid">
              {advancedMetrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="teamDetailGrid">
          <DataPanel label="Team Split" title="チーム内訳" description="選択チームの全体勝率、HOME勝率、AWAY勝率を並べて確認できます。">
            <div className="chartBox compactChart">
              <Bar data={selectedSplitData} options={chartOptions} />
            </div>
          </DataPanel>
          <DataPanel label="Season History" title="シーズン別勝率推移" description="過去シーズンと比較して、チームの勝率がどう変化しているかを確認できます。">
            <div className="chartBox compactChart">
              <Line data={selectedTrendData} options={chartOptions} />
            </div>
          </DataPanel>
          <div className="teamGamePanel">
            <p>Recent Games</p>
            <h2>直近の関連試合</h2>
            <small>選択チームが含まれる直近試合です。DBに取り込まれた試合結果から表示します。</small>
            <div className="teamGameList">
              {selectedGames.length > 0 ? (
                selectedGames.map((game) => (
                  <article key={game.id}>
                    <time dateTime={game.date}>{game.date}</time>
                    <strong>{game.home} {game.homeScore} - {game.awayScore} {game.away}</strong>
                    <span>{game.venue}</span>
                  </article>
                ))
              ) : (
                <article>
                  <strong>関連試合がありません</strong>
                  <span>この条件では直近試合に選択チームが含まれていません。</span>
                </article>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="dataGrid twoColumns selectedOnlyData">
        <DataPanel label="Score Balance" title={`${selectedTeam.shortName}の得失点バランス`} description="選択チームの平均得点、平均失点、1試合あたりの得失点差を同じグラフで確認できます。">
          <div className="chartBox">
            <Bar data={selectedScoreData} options={chartOptions} />
          </div>
        </DataPanel>
        <div className="teamGamePanel teamSplitPanel">
          <p>Home / Away Detail</p>
          <h2>{selectedTeam.shortName}の開催地別成績</h2>
          <small>同じチームの中で、HOMEとAWAYの勝ち方に差があるかを確認します。</small>
          <div className="teamSplitList">
            <article>
              <span>HOME</span>
              <strong>{selectedTeam.homeWins}-{selectedTeam.homeLosses}</strong>
              <small>{(selectedHomeRate * 100).toFixed(1)}%</small>
            </article>
            <article>
              <span>AWAY</span>
              <strong>{selectedTeam.awayWins}-{selectedTeam.awayLosses}</strong>
              <small>{(selectedAwayRate * 100).toFixed(1)}%</small>
            </article>
            <article>
              <span>GAP</span>
              <strong>{selectedHomeAwayGap.toFixed(1)}pt</strong>
              <small>{selectedHomeAwayGap >= 15 ? "開催地による差が大きい傾向" : "開催地差は比較的小さい傾向"}</small>
            </article>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}

export function RankingsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const [activeMetric, setActiveMetric] = useState<AdvancedRankingMetric>("three_point_percentage");
  const [rankingActionState, setRankingActionState] = useState<"idle" | "copied" | "saved" | "failed">("idle");
  const { teams, source: teamSource } = useSeasonData(selectedSeason, selectedDivision);
  const { records: shootingRecords, source: shootingSource } = useAdvancedRankings(selectedSeason, selectedDivision, "three_point_percentage", 10);
  const { records: assistRecords, source: assistSource } = useAdvancedRankings(selectedSeason, selectedDivision, "assists", 10);
  const { records: reboundRecords, source: reboundSource } = useAdvancedRankings(selectedSeason, selectedDivision, "total_rebounds", 10);
  const { records: offensiveRatingRecords, source: offensiveRatingSource } = useAdvancedRankings(selectedSeason, selectedDivision, "offensive_rating", 10);
  const { records: defensiveRatingRecords, source: defensiveRatingSource } = useAdvancedRankings(selectedSeason, selectedDivision, "defensive_rating", 10);
  const standings = useMemo(() => [...teams].sort((a, b) => winRate(b) - winRate(a)), [teams]);
  const winRateTop = standings.slice(0, 10);
  const pointDiffRankings = useMemo(() => [...teams].sort((a, b) => pointDiff(b) - pointDiff(a)).slice(0, 10), [teams]);
  const offenseRankings = useMemo(() => [...teams].sort((a, b) => avgFor(b) - avgFor(a)).slice(0, 10), [teams]);
  const defenseRankings = useMemo(() => [...teams].sort((a, b) => avgAgainst(a) - avgAgainst(b)).slice(0, 10), [teams]);
  const standingsLeader = standings[0] ?? null;
  const chartRecords = shootingRecords.slice(0, 10);
  const advancedSource = mergeSource(
    mergeSource(mergeSource(shootingSource, assistSource), mergeSource(reboundSource, offensiveRatingSource)),
    defensiveRatingSource,
  );
  const advancedRankingSections: AdvancedRankingSection[] = [
    {
      metric: "three_point_percentage" as const,
      title: "3P成功率 TOP10",
      label: "3P%",
      description: "3P成功率が高い順。3PM/3PAと合わせて精度を確認できます。",
      records: shootingRecords,
      value: (record: AdvancedRankingRecord) => formatPercentageValue(record.value),
      tone: "shooting",
    },
    {
      metric: "assists" as const,
      title: "アシストランキング TOP10",
      label: "AST",
      description: "平均アシスト数が多い順。チームオフェンスの連動性を見る入口です。",
      records: assistRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
      tone: "creation",
    },
    {
      metric: "total_rebounds" as const,
      title: "リバウンドランキング TOP10",
      label: "REB",
      description: "平均総リバウンド数が多い順。ポゼッション確保力を確認できます。",
      records: reboundRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
      tone: "possession",
    },
    {
      metric: "offensive_rating" as const,
      title: "オフェンスレーティング TOP10",
      label: "ORtg",
      description: "100ポゼッションあたりの得点効率が高い順です。",
      records: offensiveRatingRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
      tone: "offense",
    },
    {
      metric: "defensive_rating" as const,
      title: "ディフェンスレーティング TOP10",
      label: "DRtg",
      description: "100ポゼッションあたりの失点効率が低い順です。",
      records: defensiveRatingRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
      tone: "defense",
    },
  ];
  const activeSection = advancedRankingSections.find((section) => section.metric === activeMetric) ?? advancedRankingSections[0];
  const activeRecords = activeSection.records.slice(0, 10);
  const activeLeader = activeRecords[0] ?? null;
  const activeLeaderTeam = activeLeader ? teams.find((team) => team.id === activeLeader.teamId || team.shortName === activeLeader.shortName) : null;
  const activeLeaderStandingRank = activeLeaderTeam ? rankOf(standings, activeLeaderTeam) : null;
  const activeChartLabel = activeSection.label;
  const rankingInsights = buildRankingInsights(activeSection, activeLeader, activeLeaderStandingRank, standingsLeader, selectedSeason, selectedDivision);

  const rankingData = {
    labels: activeRecords.map((record) => record.shortName),
    datasets: [
      {
        label: activeSection.title.replace(" TOP10", ""),
        data: activeRecords.map((record) => record.value ?? 0),
        backgroundColor: activeRecords.map((_, index) => (index === 0 ? metricToneColor(activeSection.tone) : shadeByIndex(index, Math.max(1, activeRecords.length)))),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

  async function copyRankingText() {
    try {
      await copyText(buildRankingCopy(activeSection, selectedSeason, selectedDivision));
      setRankingActionState("copied");
      window.setTimeout(() => setRankingActionState("idle"), 1600);
    } catch {
      setRankingActionState("failed");
      window.setTimeout(() => setRankingActionState("idle"), 1600);
    }
  }

  function saveRankingImage() {
    try {
      exportRankingPng(activeSection, selectedSeason, selectedDivision);
      setRankingActionState("saved");
      window.setTimeout(() => setRankingActionState("idle"), 1600);
    } catch {
      setRankingActionState("failed");
      window.setTimeout(() => setRankingActionState("idle"), 1600);
    }
  }

  return (
    <PageFrame
      eyebrow="Rankings"
      title="順位と主要ランキングを見る。"
      activeSeason={selectedSeason}
      activeDivision={selectedDivision}
      onSeasonChange={setSelectedSeason}
      onDivisionChange={setSelectedDivision}
      source={mergeSource(teamSource, advancedSource)}
      calculationTitle="勝率 = 勝利数 ÷ 試合数"
      calculationDescription="基本順位に加えて、3P成功率、AST、REB、ORtg、DRtgのTOP10をAPIから表示します。"
    >
      <section className="rankingWorkbench" aria-label="ランキング素材作成">
        <div className="rankingWorkbenchHeader">
          <div>
            <p>Article Ready Rankings</p>
            <h2>記事に使うランキングを一発で整える。</h2>
            <small>指標を切り替えるとTOP10、グラフ、コピー文、保存用カードが同じ条件で更新されます。</small>
          </div>
          <div className="rankingActions">
            <button onClick={copyRankingText} type="button">
              {rankingActionState === "copied" ? <Check size={16} /> : <Copy size={16} />}
              {rankingActionState === "copied" ? "コピー済み" : "ブログ用コピー"}
            </button>
            <button onClick={saveRankingImage} type="button">
              {rankingActionState === "saved" ? <Check size={16} /> : <Download size={16} />}
              {rankingActionState === "saved" ? "保存済み" : "画像保存"}
            </button>
          </div>
        </div>
        <div className="metricTabs" role="tablist" aria-label="ランキング指標">
          {advancedRankingSections.map((section) => (
            <button
              aria-selected={activeMetric === section.metric}
              className={activeMetric === section.metric ? `active ${section.tone}` : section.tone}
              key={section.metric}
              onClick={() => setActiveMetric(section.metric)}
              role="tab"
              type="button"
            >
              <span>{section.label}</span>
              <strong>{section.title.replace(" TOP10", "")}</strong>
            </button>
          ))}
        </div>
        <div className="rankingWorkbenchGrid">
          <div className={`rankingExportCard ${activeSection.tone}`}>
            <span>{selectedSeason} / {selectedDivision}</span>
            <h2>{activeSection.title}</h2>
            <p>{activeSection.description}</p>
            <div className="rankingExportList">
              {activeRecords.length > 0 ? (
                activeRecords.map((record) => (
                  <article key={`${record.metric}-export-${record.teamId}`}>
                    <span>{String(record.rank).padStart(2, "0")}</span>
                    <strong>{record.shortName}</strong>
                    <em>{activeSection.value(record)}</em>
                  </article>
                ))
              ) : (
                <article>
                  <span>--</span>
                  <strong>未取得</strong>
                  <em>-</em>
                </article>
              )}
            </div>
            <small>NINES ANALYZE / analyze.kjnine.com</small>
          </div>
          <div className="rankingInsightPanel">
            <p>Reading Points</p>
            <h2>このランキングの見どころ</h2>
            <div className="insightCardGrid">
              {rankingInsights.map((insight) => (
                <article key={insight.title}>
                  <span>{insight.label}</span>
                  <strong>{insight.title}</strong>
                  <small>{insight.description}</small>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rankingHeroGrid">
        <div className="rankingLeaderPanel">
          <p>Standings Leader</p>
          <h2>{standingsLeader?.shortName ?? "未取得"}</h2>
          <strong>{standingsLeader ? `${(winRate(standingsLeader) * 100).toFixed(1)}%` : "-"}</strong>
          <small>
            {standingsLeader
              ? `${selectedSeason} / ${selectedDivision} の勝率トップ。${standingsLeader.wins}勝${standingsLeader.losses}敗、得失点差 ${pointDiff(standingsLeader)}。`
              : "DBまたはサンプルデータを確認中です。"}
          </small>
        </div>
        <div className="rankingSummaryGrid">
          <article>
            <span>対象チーム</span>
            <strong>{teams.length}</strong>
            <small>選択条件に一致するチーム数</small>
          </article>
          <article>
            <span>勝率首位</span>
            <strong>{standingsLeader ? `${(winRate(standingsLeader) * 100).toFixed(1)}%` : "-"}</strong>
            <small>基本順位表の先頭チーム</small>
          </article>
          <article>
            <span>最大得失点差</span>
            <strong>{pointDiffRankings[0] ? pointDiff(pointDiffRankings[0]) : "-"}</strong>
            <small>試合内容の優位を見る基本指標</small>
          </article>
        </div>
      </section>

      <section className="rankingsOverviewGrid">
        <RankingListPanel title="勝率順位 TOP10" label="Win Rate" records={winRateTop} value={(team) => `${(winRate(team) * 100).toFixed(1)}%`} />
        <RankingListPanel title="得失点差 TOP10" label="Point Margin" records={pointDiffRankings} value={(team) => String(pointDiff(team))} />
        <RankingListPanel title="平均得点 TOP10" label="Offense" records={offenseRankings} value={(team) => avgFor(team).toFixed(1)} />
        <RankingListPanel title="平均失点 TOP10" label="Defense" records={defenseRankings} value={(team) => avgAgainst(team).toFixed(1)} />
      </section>

      <section className="advancedRankingGrid compactAdvancedGrid">
        {advancedRankingSections.map((section) => (
          <AdvancedRankingPanel
            description={section.description}
            key={section.label}
            label={section.label}
            records={section.records}
            title={section.title}
            value={section.value}
          />
        ))}
      </section>

      <section className="tableSection pageTable standingsTable">
        <div className="sectionHeader">
          <div>
            <p>Standings</p>
            <h2>基本順位表</h2>
            <small>勝敗、勝率、得失点差、HOME/AWAYをまとめて確認できます。まずここが通常の順位データです。</small>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>チーム</th>
                <th>勝敗</th>
                <th>勝率</th>
                <th>平均得点</th>
                <th>平均失点</th>
                <th>得失点差</th>
                <th>HOME</th>
                <th>AWAY</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr key={team.id}>
                  <td>{index + 1}</td>
                  <TeamNameCell name={team.name} shortName={team.shortName} />
                  <td>{team.wins}-{team.losses}</td>
                  <td>{(winRate(team) * 100).toFixed(1)}%</td>
                  <td>{avgFor(team).toFixed(1)}</td>
                  <td>{avgAgainst(team).toFixed(1)}</td>
                  <td className={pointDiff(team) >= 0 ? "positive" : "negative"}>{pointDiff(team)}</td>
                  <td>{team.homeWins}-{team.homeLosses}</td>
                  <td>{team.awayWins}-{team.awayLosses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="dataGrid twoColumns">
        <DataPanel label={activeChartLabel} title={`${activeSection.title} グラフ`} description="タブで選択中のランキングをグラフ化します。記事に貼る前の数字確認にも使えます。">
          <div className="chartBox">
            <Bar data={rankingData} options={chartOptions} />
          </div>
        </DataPanel>
        <div className="rankPanel">
          <p>Top 10</p>
          <h2>{activeSection.title}</h2>
          <small>{activeSection.description}</small>
          <div className={activeRecords.length <= 10 ? "rankScroll rankScrollFull" : "rankScroll"}>
            {activeRecords.map((record) => (
              <article className="rankItem shootingRankItem" key={record.teamId}>
                <span>{String(record.rank).padStart(2, "0")}</span>
                <strong>
                  {record.shortName}
                  <small>{record.conference ?? record.division ?? "Division未設定"}</small>
                </strong>
                <em>{activeSection.value(record)}</em>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="tableSection pageTable rankingTable">
        <div className="sectionHeader">
          <div>
            <p>Shooting Detail</p>
            <h2>3P成功率 TOP10 詳細</h2>
            <small>DBに公式スタッツを取り込むと、API経由で最新のランキングに切り替わります。</small>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>チーム</th>
                <th>3PM</th>
                <th>3PA</th>
                <th>3P%</th>
                <th>データ元</th>
              </tr>
            </thead>
            <tbody>
              {chartRecords.map((record) => (
                <tr key={record.teamId}>
                  <td>{record.rank}</td>
                  <TeamNameCell name={record.name} shortName={record.shortName} />
                  <td>{formatAdvancedValue(record.threePointMakes)}</td>
                  <td>{formatAdvancedValue(record.threePointAttempts)}</td>
                  <td>{formatPercentageValue(record.threePointPercentage)}</td>
                  <td>{sourceDisplayLabel(record.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageFrame>
  );
}

function RankingListPanel({
  title,
  label,
  records,
  value,
}: {
  title: string;
  label: string;
  records: TeamRecord[];
  value: (team: TeamRecord) => string;
}) {
  return (
    <div className="rankPanel compactRankPanel">
      <p>{label}</p>
      <h2>{title}</h2>
      <small>上位10チームまでをスクロールなしで表示します。</small>
      <div className="rankScroll rankScrollFull">
        {records.map((team, index) => (
          <article className="rankItem" key={team.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>
              {team.shortName}
              <small>{team.conference ?? team.division ?? "Division未設定"}</small>
            </strong>
            <em>{value(team)}</em>
          </article>
        ))}
      </div>
    </div>
  );
}

function AdvancedRankingPanel({
  title,
  label,
  description,
  records,
  value,
}: {
  title: string;
  label: string;
  description: string;
  records: AdvancedRankingRecord[];
  value: (record: AdvancedRankingRecord) => string;
}) {
  return (
    <div className="rankPanel compactRankPanel advancedRankPanel">
      <p>{label}</p>
      <h2>{title}</h2>
      <small>{description}</small>
      <div className="rankScroll rankScrollFull">
        {records.length > 0 ? (
          records.map((record) => (
            <article className="rankItem shootingRankItem" key={`${record.metric}-${record.teamId}`}>
              <span>{String(record.rank).padStart(2, "0")}</span>
              <strong>
                {record.shortName}
                <small>{record.conference ?? record.division ?? "Division未設定"}</small>
              </strong>
              <em>{value(record)}</em>
            </article>
          ))
        ) : (
          <article className="rankItem emptyRankItem">
            <span>--</span>
            <strong>未取得</strong>
            <em>-</em>
          </article>
        )}
      </div>
    </div>
  );
}

function buildRankingCopy(section: AdvancedRankingSection, season: SeasonKey, division: DivisionFilter) {
  const rows = section.records
    .slice(0, 10)
    .map((record) => `${record.rank}. ${record.shortName} ${section.value(record)}`)
    .join("\n");

  return [
    `${season} ${division} ${section.title}`,
    "",
    rows || "データ未取得",
    "",
    "データ: NINES ANALYZE",
    "https://analyze.kjnine.com/rankings/",
  ].join("\n");
}

function buildRankingInsights(
  section: AdvancedRankingSection,
  leader: AdvancedRankingRecord | null,
  leaderStandingRank: number | "-" | null,
  standingsLeader: TeamRecord | null,
  season: SeasonKey,
  division: DivisionFilter,
) {
  const leaderText = leader ? `${leader.shortName}が${section.value(leader)}でトップ。` : "まだランキングデータを取得できていません。";
  const standingText =
    leader && leaderStandingRank && leaderStandingRank !== "-"
      ? `基本順位では${leaderStandingRank}位なので、勝率だけでは見えない強みとして読めます。`
      : "順位表と重ねると、指標単体では見えない差が出ます。";
  const standingsLeaderText = standingsLeader
    ? `勝率トップは${standingsLeader.shortName}。${section.label}トップと同じかどうかを見ると記事の切り口になります。`
    : "勝率トップとの比較は、記事の導入に使いやすい視点です。";

  return [
    {
      label: "Leader",
      title: leader?.shortName ?? "未取得",
      description: leaderText,
    },
    {
      label: "Context",
      title: `${season} / ${division}`,
      description: section.metric === "defensive_rating" ? "DRtgは低いほど優秀です。ランキングは昇順で表示しています。" : standingText,
    },
    {
      label: "Article Hook",
      title: "勝率と比べる",
      description: standingsLeaderText,
    },
  ];
}

function exportRankingPng(section: AdvancedRankingSection, season: SeasonKey, division: DivisionFilter) {
  if (typeof document === "undefined") return;

  const canvas = document.createElement("canvas");
  const scale = 2;
  const width = 1200;
  const height = 675;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.scale(scale, scale);
  context.fillStyle = "#f7f7f6";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#18181b";
  context.fillRect(0, 0, width, 118);
  context.fillStyle = metricToneColor(section.tone);
  context.fillRect(0, 114, width, 8);
  context.fillStyle = "#ffffff";
  context.font = "900 54px Arial, sans-serif";
  context.fillText(section.title, 52, 72);
  context.fillStyle = "rgba(255,255,255,0.72)";
  context.font = "700 22px Arial, sans-serif";
  context.fillText(`${season} / ${division} / NINES ANALYZE`, 54, 102);

  const rows = section.records.slice(0, 10);
  rows.forEach((record, index) => {
    const y = 152 + index * 44;
    context.fillStyle = index % 2 === 0 ? "#ffffff" : "#f4efec";
    context.fillRect(48, y - 28, width - 96, 40);
    context.fillStyle = metricToneColor(section.tone);
    context.fillRect(48, y - 28, 8, 40);
    context.fillStyle = "#18181b";
    context.font = "900 24px Arial, sans-serif";
    context.fillText(String(record.rank).padStart(2, "0"), 76, y);
    context.font = "900 28px Arial, sans-serif";
    context.fillText(record.shortName, 150, y);
    context.textAlign = "right";
    context.fillText(section.value(record), width - 80, y);
    context.textAlign = "left";
  });

  context.fillStyle = "#18181b";
  context.font = "800 20px Arial, sans-serif";
  context.fillText("analyze.kjnine.com", 52, height - 42);
  context.textAlign = "right";
  context.fillText("B.LEAGUE DATA PORTAL", width - 52, height - 42);

  const link = document.createElement("a");
  link.download = `${season}-${section.metric}-top10.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function metricToneColor(tone: RankingTone) {
  switch (tone) {
    case "offense":
      return chartPalette.offense;
    case "defense":
      return chartPalette.defense;
    case "possession":
      return chartPalette.possession;
    case "creation":
      return chartPalette.creation;
    case "shooting":
      return chartPalette.neon;
  }
}

function comparisonColor(index: number) {
  const colors = [chartPalette.offense, chartPalette.creation, chartPalette.possession, chartPalette.defense, chartPalette.shade500];
  return colors[index % colors.length];
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

export function TrendsPage() {
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const { teams, source } = useSeasonData(selectedSeason, selectedDivision);
  const { series, source: seriesSource } = useSeasonSeries(selectedDivision);
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
      borderColor: shadeByIndex(index, topTeams.length),
      backgroundColor: "rgba(255, 255, 255, 0)",
      tension: 0.35,
      pointRadius: 5,
      pointBorderWidth: 2,
      pointBorderColor: chartPalette.ink,
      pointBackgroundColor: index === 0 ? chartPalette.neon : shadeByIndex(index, topTeams.length),
    })),
  };

  const marginValues = sortedTeams.map(pointDiff);
  const minMargin = Math.min(...marginValues);
  const maxMargin = Math.max(...marginValues);
  const marginData = {
    labels: sortedTeams.map((team) => team.shortName),
    datasets: [
      {
        label: "得失点差",
        data: marginValues,
        backgroundColor: sortedTeams.map((team, index) => {
          if (index === 0) return chartPalette.neon;
          return shadeByValue(pointDiff(team), minMargin, maxMargin);
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
      source={mergeSource(source, seriesSource)}
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const { recentGames: games, source } = useSeasonData(selectedSeason, selectedDivision);
  const chartGames = games.slice(0, 12);
  const highScoreGames = [...games].sort((a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore));

  const scoreData = {
    labels: chartGames.map((game) => `${game.home}-${game.away}`),
    datasets: [
      {
        label: "HOME",
        data: chartGames.map((game) => game.homeScore),
        backgroundColor: chartPalette.shade700,
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "AWAY",
        data: chartGames.map((game) => game.awayScore),
        backgroundColor: chartPalette.shade300,
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
      source={source}
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
          <div className="rankScroll">
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
        </div>
      </section>

      <section className="resultsBoard scrollArea">
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2026-27");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("B.PREMIER");
  const [analysisSort, setAnalysisSort] = useState<SortState<AnalysisSortKey>>({ key: "composite", direction: "desc" });
  const { teams, source } = useSeasonData(selectedSeason, selectedDivision);
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
  const sortedProfiles = useMemo(() => sortProfiles(profiles, analysisSort), [analysisSort, profiles]);
  const chartProfiles = profiles.slice(0, 16);
  const dependencyValues = chartProfiles.map((profile) => Number(profile.homeAwayGap.toFixed(1)));
  const minDependency = Math.min(...dependencyValues);
  const maxDependency = Math.max(...dependencyValues);

  const quadrantData = {
    datasets: profiles.map((profile, index) => ({
      label: profile.team.shortName,
      data: [{ x: Number(profile.offense.toFixed(1)), y: Number(profile.defense.toFixed(1)) }],
      backgroundColor: index === 0 ? chartPalette.neon : shadeByIndex(index, profiles.length),
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
        data: dependencyValues,
        backgroundColor: dependencyValues.map((value, index) => (index === 0 ? chartPalette.neon : shadeByValue(value, minDependency, maxDependency))),
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
        backgroundColor: chartProfiles.map((_, index) => (index === 0 ? chartPalette.neon : shadeByIndex(index, chartProfiles.length))),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
      {
        label: "安定度",
        data: chartProfiles.map((profile) => profile.balance),
        backgroundColor: chartPalette.shade100,
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
      source={source}
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
            <small>列見出しで並び替えできます。総合スコアは独自指標なので、攻撃・守備・勝率などの基礎値も合わせて確認してください。</small>
          </div>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>チーム</th>
                <SortableTh<AnalysisSortKey> label="総合" sortKey="composite" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="攻撃" sortKey="offense" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="守備" sortKey="defense" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="勝率" sortKey="winRate" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="ホーム依存" sortKey="homeAwayGap" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="直近フォーム" sortKey="form" activeSort={analysisSort} onSort={setAnalysisSort} />
                <SortableTh<AnalysisSortKey> label="安定度" sortKey="balance" activeSort={analysisSort} onSort={setAnalysisSort} />
              </tr>
            </thead>
            <tbody>
              {sortedProfiles.map((profile) => (
                <tr key={profile.team.id}>
                  <TeamNameCell name={profile.team.name} shortName={profile.team.shortName} />
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
  source,
  calculationTitle = "勝率 = 勝利数 ÷ 試合数",
  calculationDescription = "平均得点・平均失点・得失点差は集計済みの得点データから算出します。",
  children,
}: {
  eyebrow: string;
  title: string;
  activeSeason: SeasonKey;
  activeDivision: DivisionFilter;
  onSeasonChange: (season: SeasonKey) => void;
  onDivisionChange: (division: DivisionFilter) => void;
  source: DataSourceState;
  calculationTitle?: string;
  calculationDescription?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="dashboard statPage">
      <section className="pageHero">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
        <div className="pageHeroControls">
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
          <DivisionSwitch activeSeason={activeSeason} activeDivision={activeDivision} onDivisionChange={onDivisionChange} />
        </div>
      </section>

      <section className="portalMeta" aria-label="データの見方">
        <article>
          <span>Data Source</span>
          <strong>{sourceLabel(source)}</strong>
          <p>{sourceDescription(source)}</p>
        </article>
        <article>
          <span>Calculation</span>
          <strong>{calculationTitle}</strong>
          <p>{calculationDescription}</p>
        </article>
        <article>
          <span>Explore</span>
          <strong>条件を切り替えて確認</strong>
          <p>シーズン、カテゴリ、ページごとの操作で、見たい観点へ表示を切り替えられます。</p>
        </article>
      </section>

      {children}
      <SiteFooter />
    </main>
  );
}

function SortableTh<Key extends string>({
  label,
  sortKey,
  activeSort,
  onSort,
}: {
  label: string;
  sortKey: Key;
  activeSort: SortState<Key>;
  onSort: (sort: SortState<Key>) => void;
}) {
  const isActive = activeSort.key === sortKey;
  const direction = isActive ? activeSort.direction : "desc";

  return (
    <th>
      <button
        aria-label={`${label}で${isActive && activeSort.direction === "desc" ? "昇順" : "降順"}に並び替え`}
        aria-sort={isActive ? (activeSort.direction === "desc" ? "descending" : "ascending") : undefined}
        className={`sortButton${isActive ? " active" : ""}`}
        onClick={() => onSort({ key: sortKey, direction: isActive && activeSort.direction === "desc" ? "asc" : "desc" })}
        type="button"
      >
        {label}
        <span>{direction === "desc" ? "↓" : "↑"}</span>
      </button>
    </th>
  );
}

type AnalysisProfile = {
  team: TeamRecord;
  offense: number;
  defense: number;
  homeAwayGap: number;
  form: number;
  balance: number;
  composite: number;
};

function sortProfiles(profiles: AnalysisProfile[], sort: SortState<AnalysisSortKey>) {
  return [...profiles].sort((a, b) => compareByDirection(profileSortValue(a, sort.key), profileSortValue(b, sort.key), sort.direction));
}

function profileSortValue(profile: AnalysisProfile, key: AnalysisSortKey) {
  switch (key) {
    case "composite":
      return profile.composite;
    case "offense":
      return profile.offense;
    case "defense":
      return profile.defense;
    case "winRate":
      return winRate(profile.team);
    case "homeAwayGap":
      return profile.homeAwayGap;
    case "form":
      return profile.form;
    case "balance":
      return profile.balance;
  }
}

function compareByDirection(a: number, b: number, direction: SortDirection) {
  return direction === "desc" ? b - a : a - b;
}

function rankOf(teams: TeamRecord[], target: TeamRecord) {
  const index = teams.findIndex((team) => team.id === target.id || team.shortName === target.shortName);
  return index >= 0 ? index + 1 : "-";
}

function formatAdvancedValue(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "未取得";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}${suffix}`;
}

function formatPercentageValue(value: number | null | undefined) {
  if (value === null || value === undefined) return "未取得";
  return `${value.toFixed(1)}%`;
}

function sourceDisplayLabel(source: string | null) {
  if (!source) return "未設定";
  return source === "Sample fallback" ? "サンプル" : "取得済み";
}

function normalizeTeamLabel(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function mergeSource(source: DataSourceState, seriesSource: DataSourceState): DataSourceState {
  if (source === "db" || seriesSource === "db") return "db";
  if (source === "loading" || seriesSource === "loading") return "loading";
  return "mock";
}

function sourceLabel(source: DataSourceState) {
  if (source === "db") return "DB / Scraped Results";
  if (source === "loading") return "DB確認中";
  return "Sample Fallback";
}

function sourceDescription(source: DataSourceState) {
  if (source === "db") return "取り込み済みの試合結果テーブルから集計しています。";
  if (source === "loading") return "本番データをAPIから確認しています。取得後に表示内容を更新します。";
  return "API取得に失敗した場合のサンプル表示です。公開前にDB/APIの状態を確認してください。";
}

function readTeamsQuery() {
  const defaultState = {
    season: "2026-27" as SeasonKey,
    division: "B.PREMIER" as DivisionFilter,
    teamId: null as string | null,
    compareIds: [] as string[],
  };

  if (typeof window === "undefined") {
    return defaultState;
  }

  const params = new URLSearchParams(window.location.search);
  const season = parseSeason(params.get("season")) ?? defaultState.season;
  const division = parseDivision(params.get("division")) ?? defaultState.division;
  const teamId = sanitizeId(params.get("team"));
  const compareIds = (params.get("compare") ?? "")
    .split(",")
    .map((value) => sanitizeId(value))
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);

  return { season, division, teamId, compareIds };
}

function buildTeamsShareUrl(season: SeasonKey, division: DivisionFilter, teamId: string | null, compareIds: string[]) {
  if (typeof window === "undefined") {
    return "/teams";
  }

  const url = new URL("/teams", window.location.origin);
  url.searchParams.set("season", season);
  if (division !== "ALL") {
    url.searchParams.set("division", division);
  }
  if (teamId) {
    url.searchParams.set("team", teamId);
  }
  if (compareIds.length > 0) {
    url.searchParams.set("compare", compareIds.join(","));
  }

  return url.toString();
}

function syncTeamsQuery(season: SeasonKey, division: DivisionFilter, teamId: string | null, compareIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  const nextUrl = buildTeamsShareUrl(season, division, teamId, compareIds);
  if (nextUrl !== window.location.href) {
    window.history.replaceState(null, "", nextUrl);
  }
}

function parseSeason(value: string | null): SeasonKey | null {
  return seasonLabels.includes(value as SeasonKey) ? (value as SeasonKey) : null;
}

function parseDivision(value: string | null): DivisionFilter | null {
  return ["ALL", "B1", "B2", "B.PREMIER", "B.ONE", "B.NEXT"].includes(value ?? "") ? (value as DivisionFilter) : null;
}

function sanitizeId(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return /^[a-z0-9-]+$/i.test(trimmed) ? trimmed : null;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back for local previews or browsers that block clipboard permissions.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copyCommand = (document as unknown as { execCommand: (commandId: string) => boolean }).execCommand.bind(document);
  const copied = copyCommand("copy");
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error("Copy failed");
  }
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
    <div className="divisionSwitch compactSwitch" aria-label="ディビジョン選択">
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

const efficiencyScatterOptions = {
  ...chartOptions,
  plugins: {
    ...chartOptions.plugins,
    legend: {
      labels: {
        color: chartPalette.ink,
        boxWidth: 10,
      },
    },
  },
  scales: {
    x: {
      title: { display: true, text: "ORtg / 攻撃効率", color: chartPalette.ink },
      ticks: { color: chartPalette.graphite },
      grid: { color: "rgba(17, 17, 17, 0.1)" },
    },
    y: {
      reverse: true,
      title: { display: true, text: "DRtg / 守備効率", color: chartPalette.ink },
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
