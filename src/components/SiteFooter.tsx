import { ArrowRight } from "lucide-react";
import "./StatsDashboard.css";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerBrand">
          <img alt="NINES DATA ANALYZE" src="/nines_dataanalyze_wht.svg" />
          <p>Bリーグの試合結果を統計化し、チームの変化を多角的に追うデータ分析サービス。</p>
        </div>

        <nav className="footerLinks" aria-label="フッターナビゲーション">
          <a href="/teams">Teams</a>
          <a href="/analytics">Analytics</a>
          <a href="/trends">Trends</a>
          <a href="/results">Results</a>
        </nav>

        <div className="footerInfo">
          <p>Data Source</p>
          <span>試合結果・スコアデータを集計し、独自指標として可視化します。</span>
          <a href="/analytics">
            分析を見る
            <ArrowRight size={14} />
          </a>
        </div>
      </div>

      <div className="footerBottom">
        <small>© NINES DATA ANALYZE</small>
        <small>Stats are provided for reference and may differ from official records.</small>
      </div>
    </footer>
  );
}
