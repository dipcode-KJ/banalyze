import { ArrowRight } from "lucide-react";
import "./StatsDashboard.css";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerBrand">
          <img alt="NINES ANALYZE" src="/nines_analyze_logo_wht.svg" />
          <p>Bリーグの試合結果を統計化し、チームの変化を多角的に追うデータ分析サービス。</p>
        </div>

        <nav className="footerLinks" aria-label="フッターナビゲーション">
          <a href="/">Home</a>
          <a href="/dashboard">Dashboard</a>
          <a href="/teams">Teams</a>
          <a href="/rankings">Rankings</a>
          <a href="/analytics">Analytics</a>
          <a href="/trends">Trends</a>
          <a href="/results">Results</a>
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <a href="https://kjnine.com" rel="noreferrer" target="_blank">KJ9</a>
          <a href="https://kjnine.com/contact" rel="noreferrer" target="_blank">Contact</a>
        </nav>

        <div className="footerInfo">
          <p>Unofficial Data Service</p>
          <span>
            本サイトはB.LEAGUE公式サイトではありません。公開されている試合結果をもとに独自に集計・可視化しています。
          </span>
          <a href="/terms">
            免責事項を見る
            <ArrowRight size={14} />
          </a>
        </div>
      </div>

      <div className="footerBottom">
        <small>© NINES DATA ANALYZE</small>
        <small>非公式サイトです。公式情報はB.LEAGUE公式サイトをご確認ください。</small>
      </div>
    </footer>
  );
}
