import {
  CalendarDays,
  Database,
  ExternalLink,
  Flag,
  RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type NationalTeamGame,
  type NationalTeamPayload,
  type NationalTeamStats,
  useNationalTeamData,
} from "../hooks/useNationalTeamData";
import SiteFooter from "./SiteFooter";
import "./StatsDashboard.css";

const statRows: Array<{ label: string; metric: keyof NationalTeamStats; format?: "shooting" }> = [
  { label: "3P", metric: "threePointMakes", format: "shooting" },
  { label: "2P", metric: "twoPointMakes", format: "shooting" },
  { label: "FT", metric: "freeThrowMakes", format: "shooting" },
  { label: "REB", metric: "rebounds" },
  { label: "AST", metric: "assists" },
  { label: "TO", metric: "turnovers" },
  { label: "STL", metric: "steals" },
  { label: "BLK", metric: "blocks" },
];

const attempts: Partial<Record<keyof NationalTeamStats, keyof NationalTeamStats>> = {
  threePointMakes: "threePointAttempts",
  twoPointMakes: "twoPointAttempts",
  freeThrowMakes: "freeThrowAttempts",
};

export default function JapanPage({ initialData }: { initialData?: NationalTeamPayload | null }) {
  const { summary, games, players, playerLeaders, loading, error, updatedAt } = useNationalTeamData(initialData);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedGameId === null && games[0]) setSelectedGameId(games[0].id);
  }, [games, selectedGameId]);

  const game = useMemo(
    () => games.find((item) => item.id === selectedGameId) ?? games[0] ?? null,
    [games, selectedGameId],
  );
  const gamePlayers = useMemo(
    () => players.filter((player) => player.gameId === game?.id && player.isJapan),
    [game?.id, players],
  );
  const leaders = useMemo(
    () => [...playerLeaders].sort((a, b) => b.pointsPerGame - a.pointsPerGame).slice(0, 5),
    [playerLeaders],
  );

  return (
    <main className="dashboard japanPage">

      <section className="japanHero">
        <div className="japanHeroInner">
          <div className="japanHeroCopy">
            <p className="eyebrow">AKATSUKI JAPAN DATA</p>
            <h1>日本代表を、<br />試合ごとの<br />数字で追う。</h1>
            <p>男子日本代表の公式ボックススコアを自動取得。得点だけでなく、シュート、リバウンド、アシスト、選手別成績まで一つの流れで確認できます。</p>
            <div className="japanHeroMeta">
              <span><Database size={15} /> JBA公開記録</span>
              <span><RefreshCw size={15} /> 定期自動更新</span>
            </div>
          </div>

          {game ? <Scoreboard game={game} /> : <EmptyScoreboard loading={loading} error={error} />}
        </div>
      </section>

      <section className="japanSummary" aria-label="日本代表集計サマリー">
        <SummaryItem label="Record" value={`${summary.wins}-${summary.losses}`} detail={`${summary.games} GAMES`} />
        <SummaryItem label="Points" value={summary.averagePoints.toFixed(1)} detail={`失点 ${summary.averageAllowed.toFixed(1)}`} />
        <SummaryItem label="3P%" value={`${summary.threePointPercentage.toFixed(1)}%`} detail="全収録試合集計" />
        <SummaryItem label="Assists" value={summary.averageAssists.toFixed(1)} detail={`TO ${summary.averageTurnovers.toFixed(1)}`} />
        <SummaryItem label="Rebounds" value={summary.averageRebounds.toFixed(1)} detail="1試合平均" />
      </section>

      {game && (
        <>
          <section className="japanContent japanComparison">
            <SectionHeading eyebrow="GAME BREAKDOWN" title={`${formatDate(game.date)} vs ${game.opponent}`} description="選択中の試合における両チームの主要スタッツ比較。" />
            <div className="japanComparisonGrid">
              {statRows.map((row) => <ComparisonRow game={game} key={row.label} {...row} />)}
            </div>
          </section>

          <section className="japanContent japanBoxscore">
            <SectionHeading eyebrow="PLAYER BOX SCORE" title="日本代表 選手スタッツ" description="選択中の試合に出場登録された日本代表選手。Sはスターターです。" />
            <div className="tableWrap japanTableWrap">
              <table>
                <thead>
                  <tr><th>No.</th><th>選手</th><th>MIN</th><th>PTS</th><th>3P</th><th>2P</th><th>FT</th><th>REB</th><th>AST</th><th>TO</th><th>STL</th><th>BLK</th></tr>
                </thead>
                <tbody>
                  {gamePlayers.map((player) => (
                    <tr key={`${player.number}-${player.name}`}>
                      <td>{player.number}</td>
                      <td className="japanPlayerName"><span>{player.starter ? "S" : ""}</span><strong>{player.name}</strong></td>
                      <td>{player.didNotPlay ? "DNP" : player.minutes}</td>
                      <td><strong>{player.points}</strong></td>
                      <td>{player.threePointMakes}/{player.threePointAttempts}</td>
                      <td>{player.twoPointMakes}/{player.twoPointAttempts}</td>
                      <td>{player.freeThrowMakes}/{player.freeThrowAttempts}</td>
                      <td>{player.rebounds}</td><td>{player.assists}</td><td>{player.turnovers}</td><td>{player.steals}</td><td>{player.blocks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="japanHistoryBand">
        <div className="japanContent">
          <SectionHeading eyebrow="GAME ARCHIVE" title="過去試合" description="公式の詳細記録を取得できた国内開催の男子日本代表戦。試合を選ぶと上の比較とボックススコアが切り替わります。" />
          <div className="japanGameList">
            {games.map((item) => (
              <button className={item.id === game?.id ? "active" : ""} key={item.id} onClick={() => setSelectedGameId(item.id)} type="button">
                <span className={`japanResult japanResult--${item.result.toLowerCase()}`}>{item.result}</span>
                <span><small>{formatDate(item.date)}</small><strong>日本 {item.japanScore} - {item.opponentScore} {item.opponent}</strong></span>
                <span className="japanGameDiff">{signed(item.japanScore - item.opponentScore)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="japanContent japanLeaders">
        <SectionHeading eyebrow="PLAYER LEADERS" title="収録試合の平均得点上位" description="本ページに収録している試合のみを対象に集計しています。" />
        <div className="japanLeaderGrid">
          {leaders.map((leader, index) => (
            <article key={leader.name}>
              <span>0{index + 1}</span><small>{leader.games} GAMES</small><h3>{leader.name}</h3>
              <strong>{leader.pointsPerGame.toFixed(1)}<em>PPG</em></strong>
              <p>{leader.reboundsPerGame.toFixed(1)} REB / {leader.assistsPerGame.toFixed(1)} AST</p>
            </article>
          ))}
        </div>
      </section>

      <section className="japanSource">
        <div>
          <Flag size={20} />
          <p><strong>Official source, independent analysis.</strong><span>JBAが公開する確定ボックススコアを参照し、NINES ANALYZEが独自に蓄積・再集計しています。</span></p>
        </div>
        <small>最終データ更新: {updatedAt ? formatTimestamp(updatedAt) : "準備中"}</small>
      </section>
      <SiteFooter />
    </main>
  );
}

function Scoreboard({ game }: { game: NationalTeamGame }) {
  return (
    <article className="japanScoreboard">
      <div className="japanScoreTop"><span className={`japanResult japanResult--${game.result.toLowerCase()}`}>{game.result}</span><p>{game.competition}</p></div>
      <div className="japanScoreMain">
        <div><small>JAPAN</small><strong>{game.japanScore}</strong></div><span>-</span><div><small>{game.opponent}</small><strong>{game.opponentScore}</strong></div>
      </div>
      <div className="japanPeriods">
        <span>TEAM</span>{game.periods.map((period) => <span key={period.label}>{period.label.replace("st", "Q").replace("nd", "Q").replace("rd", "Q").replace("th", "Q")}</span>)}<strong>T</strong>
        <b>JPN</b>{game.periods.map((period) => <b key={`j-${period.label}`}>{period.japan}</b>)}<b>{game.japanScore}</b>
        <b>{shortOpponent(game.opponent)}</b>{game.periods.map((period) => <b key={`o-${period.label}`}>{period.opponent}</b>)}<b>{game.opponentScore}</b>
      </div>
      <footer><span><CalendarDays size={14} /> {formatDate(game.date)} {game.tipoffTime ?? ""}</span><span>{game.venue}</span><a href={game.sourceUrl} rel="noreferrer" target="_blank">公式記録 <ExternalLink size={13} /></a></footer>
    </article>
  );
}

function EmptyScoreboard({ loading, error }: { loading: boolean; error: boolean }) {
  return <article className="japanScoreboard japanScoreboard--empty"><Database size={30} /><strong>{loading ? "データを取得しています" : error ? "データを取得できませんでした" : "試合データを準備中です"}</strong><span>公式記録の取得後に自動で表示されます。</span></article>;
}

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="japanSectionHeading"><div><p>{eyebrow}</p><h2>{title}</h2></div><span>{description}</span></div>;
}

function ComparisonRow({ game, label, metric: statKey, format }: { game: NationalTeamGame; label: string; metric: keyof NationalTeamStats; format?: "shooting" }) {
  const japanValue = game.japanStats[statKey];
  const opponentValue = game.opponentStats[statKey];
  const max = Math.max(japanValue, opponentValue, 1);
  const attemptKey = attempts[statKey];
  const showValue = (stats: NationalTeamStats) => format === "shooting" && attemptKey ? `${stats[statKey]}/${stats[attemptKey]}` : String(stats[statKey]);
  return (
    <article className="japanCompareRow">
      <strong>{showValue(game.japanStats)}</strong><span>{label}</span><strong>{showValue(game.opponentStats)}</strong>
      <div className="japanCompareBars"><i style={{ width: `${(japanValue / max) * 100}%` }} /><i style={{ width: `${(opponentValue / max) * 100}%` }} /></div>
    </article>
  );
}

function formatDate(value: string) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00+09:00`)); }
function formatTimestamp(value: string) { return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value.replace(" ", "T") + "+09:00")); }
function signed(value: number) { return value > 0 ? `+${value}` : String(value); }
function shortOpponent(value: string) { return value === "韓国" ? "KOR" : value === "フランス" ? "FRA" : value === "スロベニア" ? "SLO" : value === "オランダ" ? "NED" : value === "ニュージーランド" ? "NZL" : value.slice(0, 3).toUpperCase(); }
