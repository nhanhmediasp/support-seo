"use client";

import { FormEvent, useEffect, useState } from "react";
import { localModeAllowed, supabase, supabaseConfigured } from "../../lib/supabase";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error" | "info">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (supabaseConfigured) supabase?.auth.getSession().then(({ data }) => { if (data.session) window.location.href = "/"; });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (!supabaseConfigured || !supabase) {
      setMessageTone("error");
      setMessage("Chưa cấu hình Supabase. Hãy điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong Vercel.");
      return;
    }
    setBusy(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessageTone("error");
      setMessage(result.error.message);
      return;
    }
    setMessageTone("success");
    setMessage("Đăng nhập thành công…");
    window.location.href = "/";
  };

  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><div className="brand-mark">A<span>+</span></div><div><b>Air & Sea</b><small>SEO Control Center</small></div></div><p className="eyebrow">MULTI-WEBSITE SEO MANAGEMENT</p><h1>Đăng nhập</h1><p className="auth-muted">Khu vực quản trị dành cho tài khoản đã được cấp quyền.</p>{!supabaseConfigured && <div className="auth-notice"><b>Hệ thống chưa được cấu hình đăng nhập.</b><span>Thêm Supabase URL và Anon Key vào biến môi trường Vercel rồi tải lại trang. Giao diện quản trị đang được khóa.</span></div>}<form onSubmit={submit}><label>Email<input disabled={!supabaseConfigured} type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="email@domain.com" /></label><label>Mật khẩu<input disabled={!supabaseConfigured} type="password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" /></label><button className="primary auth-submit" disabled={busy || !supabaseConfigured}>{busy ? "Đang xử lý…" : "Đăng nhập"}</button></form>{message && <p className={`auth-message ${messageTone}`}>{message}</p>}{localModeAllowed && <button className="local-mode-button" onClick={() => { window.location.href = "/"; }}>Vào chế độ local dành cho phát triển</button>}</div></main>;
}
