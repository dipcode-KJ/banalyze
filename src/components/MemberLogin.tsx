import { useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import "./MemberAccess.css";

export default function MemberLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth-endpoint.php?action=me", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result: { authenticated?: boolean } | null) => {
        if (active && result?.authenticated) window.location.replace("/forecast/");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth-endpoint.php?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("メールアドレスまたはパスワードを確認してください。");
      window.location.href = "/forecast/";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ログインに失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="memberShell">
      <section className="memberPanel">
        <div className="memberEyebrow"><ShieldCheck size={16} /> MEMBERS ONLY</div>
        <h1>予測ラボにログイン</h1>
        <p className="memberLead">過去の試合データから、次のB.LEAGUEを読み解きます。</p>
        <form className="memberForm" onSubmit={submit}>
          <label>メールアドレス<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error && <p className="memberError" role="alert">{error}</p>}
          <button className="memberSubmit" disabled={loading} type="submit"><LockKeyhole size={17} />{loading ? "確認中..." : "ログイン"}<ArrowRight size={17} /></button>
        </form>
        <p className="memberNote">新規登録は公開していません。利用アカウントは管理者が発行します。</p>
      </section>
    </main>
  );
}
