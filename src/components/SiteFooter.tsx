import { ArrowRight, ArrowUpRight, Database, ShieldCheck } from "lucide-react";
import "./StatsDashboard.css";

export default function SiteFooter() {
  return (
    <footer className="siteFooter">
      <div className="siteFooterInner">
        <div className="footerBrand">
          <img alt="NINES ANALYZE" src="/nines_analyze_logo_wht.svg?v=20260814" />
          <p>Bリーグと男子日本代表の試合記録を統計化し、数字からバスケットボールを多角的に追うデータ分析サービス。</p>
        </div>

        <div className="footerNavGroup">
          <p>Explore</p>
          <nav className="footerLinks" aria-label="フッターナビゲーション">
            <a href="/dashboard">Dashboard <ArrowRight size={13} /></a>
            <a href="/teams">Teams <ArrowRight size={13} /></a>
            <a href="/rankings">Rankings <ArrowRight size={13} /></a>
            <a href="/japan">Japan <ArrowRight size={13} /></a>
            <a href="/results">Results <ArrowRight size={13} /></a>
          </nav>
        </div>

        <div className="footerNavGroup">
          <p>Service</p>
          <nav className="footerLinks" aria-label="サービスナビゲーション">
            <a href="/analytics">Analytics <ArrowRight size={13} /></a>
            <a href="/trends">Trends <ArrowRight size={13} /></a>
            <a href="/forecast"><ShieldCheck size={13} /> Forecast <ArrowRight size={13} /></a>
            <a href="https://kjnine.com" rel="noreferrer" target="_blank">KJ9 <ArrowUpRight size={13} /></a>
            <a href="https://kjnine.com/contact" rel="noreferrer" target="_blank">Contact <ArrowUpRight size={13} /></a>
          </nav>
        </div>

        <div className="footerInfo">
          <p><Database size={14} /> Data note</p>
          <span>公開されている試合結果をもとに独自に集計・可視化しています。公式記録とは異なる場合があります。</span>
          <a href="/terms">利用上の注意を見る <ArrowRight size={14} /></a>
        </div>
      </div>

      <div className="footerBottom">
        <small>© NINES DATA ANALYZE</small>
        <div><a href="/terms">Terms</a><a href="/privacy">Privacy</a><small>非公式データサービス</small></div>
      </div>
    </footer>
  );
}
