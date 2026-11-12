import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarDays, LogOut, RefreshCw, ShieldCheck, Target } from "lucide-react";
import "./MemberAccess.css";
import "./ForecastFix.css";
import ForecastWebGL from "./ForecastWebGL";

type Prediction = {
  id: number;
  date: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  forecast: {
    modelVersion: string;
    dataCutoffDate: string;
    homeWinProbability: number;
    predictedHomeScore: number;
    predictedAwayScore: number;
    predictedMargin: number;
    homeElo: number;
    awayElo: number;
    homeAdvantage: number;
    inputSnapshot: { historyGames: number };
  };
};

type ForecastResponse = { user: { displayName: string; role: string }; predictions: Prediction[]; modelVersion: string };

export default function ForecastPage() {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => dateKey(0));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/forecast.php?season=2026-27&division=B.PREMIER", { credentials: "same-origin", cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/login/";
        return;
      }
      if (!response.ok) throw new Error("予測データを取得できませんでした。");
      setData(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "予測データを取得できませんでした。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const dateOptions = useMemo(() => [
    { key: dateKey(-1), label: "昨日" },
    { key: dateKey(0), label: "今日" },
    { key: dateKey(1), label: "明日" },
    { key: dateKey(2), label: "明後日" },
    { key: dateKey(3), label: "明々後日" },
  ], []);
  const selectedPredictions = useMemo(
    () => data?.predictions.filter((prediction) => prediction.date === selectedDate) ?? [],
    [data, selectedDate],
  );

  async function logout() {
    await fetch("/api/auth-endpoint.php?action=logout", { credentials: "same-origin" });
    window.location.href = "/login/";
  }

  return (
    <main className="forecastShell">
      <header className="forecastHeader">
        <div><div className="memberEyebrow"><ShieldCheck size={15} /> PRIVATE ANALYTICS</div><h1>Game Forecast</h1><p>2026-27 / B.PREMIER</p></div>
        <div className="forecastHeaderActions"><span>{data?.user.displayName ?? "読み込み中"}</span><button title="再取得" onClick={() => void load()}><RefreshCw size={17} /></button><button title="ログアウト" onClick={() => void logout()}><LogOut size={17} /></button></div>
      </header>
      <section className="forecastIntro"><div><Target size={25} /><h2>次の試合を、数字で予測する</h2></div><p>Eloレーティング、過去の得失点差、ホーム補正を組み合わせたPhase 1モデルです。予測対象試合日より前の確定試合だけを使用しています。</p></section>
      {loading && <div className="forecastState">予測を計算しています...</div>}
      {error && <div className="forecastState forecastState--error">{error}</div>}
      {!loading && !error && <>
        <nav className="forecastDateNav" aria-label="予測日を選択">
          <div className="forecastDateNavIntro"><CalendarDays size={17} /><span>表示する日付</span></div>
          <div className="forecastDateButtons" role="tablist">
            {dateOptions.map((option) => {
              const count = data?.predictions.filter((prediction) => prediction.date === option.key).length ?? 0;
              const active = selectedDate === option.key;
              return <button key={option.key} className={active ? "is-active" : ""} type="button" role="tab" aria-selected={active} onClick={() => setSelectedDate(option.key)}>
                <strong>{option.label}</strong><span>{formatShortDate(option.key)}</span><em>{count}試合</em>
              </button>;
            })}
          </div>
        </nav>
        {selectedPredictions[0] && <section className="forecastSignal"><div className="forecastSignalCopy"><span className="forecastSignalKicker">MODEL SIGNAL / {selectedDate}</span><h2>{selectedPredictions[0].homeTeam}<br /><em>vs</em> {selectedPredictions[0].awayTeam}</h2><p>勝率と強度の差を、予測モデルの入力値から可視化しています。</p><div className="forecastLegend"><span><i className="legendHome" />HOME ELO</span><span><i className="legendAway" />AWAY ELO</span><span><i className="legendProbability" />HOME WIN PROBABILITY</span></div></div><ForecastWebGL homeElo={selectedPredictions[0].forecast.homeElo} awayElo={selectedPredictions[0].forecast.awayElo} probability={selectedPredictions[0].forecast.homeWinProbability} homeTeam={selectedPredictions[0].homeTeam} awayTeam={selectedPredictions[0].awayTeam} /></section>}
        <section className="forecastDayHeading"><div><span>SELECTED DATE</span><h2>{formatJapaneseDate(selectedDate)}</h2></div><p>{selectedPredictions.length > 0 ? `${selectedPredictions.length}試合の予測` : "この日の予測はありません"}</p></section>
        <section className="forecastGrid">{selectedPredictions.map((prediction) => <PredictionCard key={prediction.id} prediction={prediction} />)}{selectedPredictions.length === 0 && <div className="forecastState">この日の予測対象の試合はありません。別の日付を選択してください。</div>}</section>
      </>}
      {data && <footer className="forecastFooter"><BarChart3 size={16} /> model {data.modelVersion} / 予測値は分析用の参考情報です</footer>}
    </main>
  );
}

function dateKey(offset: number): string {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function formatJapaneseDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function PredictionCard({ prediction }: { prediction: Prediction }) {
  const probability = Math.round(prediction.forecast.homeWinProbability * 100);
  return <article className="predictionCard">
    <div className="predictionMeta"><span><CalendarDays size={14} /> {prediction.date}</span><span>{prediction.forecast.inputSnapshot.historyGames}試合を参照</span></div>
    <div className="predictionTeams"><div><small>HOME</small><strong>{prediction.homeTeam}</strong></div><b>VS</b><div><small>AWAY</small><strong>{prediction.awayTeam}</strong></div></div>
    <div className="probability"><span>ホーム勝率</span><strong>{probability}%</strong><div><i style={{ width: `${probability}%` }} /></div></div>
    <div className="predictionScore"><div><small>予想スコア</small><strong>{prediction.forecast.predictedHomeScore} - {prediction.forecast.predictedAwayScore}</strong></div><div><small>予想得点差</small><strong>{prediction.forecast.predictedMargin > 0 ? "+" : ""}{prediction.forecast.predictedMargin}</strong></div></div>
    <details><summary>モデル入力を見る</summary><p>基準日 {prediction.forecast.dataCutoffDate} / HOME Elo {prediction.forecast.homeElo} / AWAY Elo {prediction.forecast.awayElo} / ホーム補正 +{prediction.forecast.homeAdvantage}</p></details>
  </article>;
}
