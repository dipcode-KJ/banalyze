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
import { pointDiff, seasonLabels, type AdvancedRankingRecord, type SeasonKey, type TeamRecord, winRate } from "../data/mockStats";
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
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
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
  const advancedRankingSections = [
    {
      title: "3P成功率 TOP10",
      label: "3P%",
      description: "3P成功率が高い順。3PM/3PAと合わせて精度を確認できます。",
      records: shootingRecords,
      value: (record: AdvancedRankingRecord) => formatPercentageValue(record.value),
    },
    {
      title: "アシストランキング TOP10",
      label: "AST",
      description: "平均アシスト数が多い順。チームオフェンスの連動性を見る入口です。",
      records: assistRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
    },
    {
      title: "リバウンドランキング TOP10",
      label: "REB",
      description: "平均総リバウンド数が多い順。ポゼッション確保力を確認できます。",
      records: reboundRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
    },
    {
      title: "オフェンスレーティング TOP10",
      label: "ORtg",
      description: "100ポゼッションあたりの得点効率が高い順です。",
      records: offensiveRatingRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
    },
    {
      title: "ディフェンスレーティング TOP10",
      label: "DRtg",
      description: "100ポゼッションあたりの失点効率が低い順です。",
      records: defensiveRatingRecords,
      value: (record: AdvancedRankingRecord) => formatAdvancedValue(record.value),
    },
  ];

  const rankingData = {
    labels: chartRecords.map((record) => record.shortName),
    datasets: [
      {
        label: "3P成功率",
        data: chartRecords.map((record) => record.threePointPercentage ?? 0),
        backgroundColor: chartRecords.map((_, index) => (index === 0 ? chartPalette.neon : shadeByIndex(index, Math.max(1, chartRecords.length)))),
        borderColor: chartPalette.ink,
        borderWidth: 1,
      },
    ],
  };

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

      <section className="advancedRankingGrid">
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
        <DataPanel label="3P Percentage" title="3P成功率ランキング" description="成功率の高いチームを上位から表示します。試投数も合わせて見ると、精度とボリュームの両方を確認できます。">
          <div className="chartBox">
            <Bar data={rankingData} options={chartOptions} />
          </div>
        </DataPanel>
        <div className="rankPanel">
          <p>Top 10</p>
          <h2>3P成功率ランキング</h2>
          <small>3PM、3PA、3P%を同じ行で確認できます。</small>
          <div className={chartRecords.length <= 10 ? "rankScroll rankScrollFull" : "rankScroll"}>
            {chartRecords.map((record) => (
              <article className="rankItem shootingRankItem" key={record.teamId}>
                <span>{String(record.rank).padStart(2, "0")}</span>
                <strong>
                  {record.shortName}
                  <small>{record.conference ?? record.division ?? "Division未設定"}</small>
                </strong>
                <em>{formatPercentageValue(record.threePointPercentage)}</em>
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
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
  const [selectedSeason, setSelectedSeason] = useState<SeasonKey>("2025-26");
  const [selectedDivision, setSelectedDivision] = useState<DivisionFilter>("ALL");
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
          <DivisionSwitch activeDivision={activeDivision} onDivisionChange={onDivisionChange} />
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
