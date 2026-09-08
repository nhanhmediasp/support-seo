"use client";

import { FormEvent, useEffect, useState } from "react";
import { localModeAllowed, supabase, supabaseConfigured } from "../../lib/supabase";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (supabaseConfigured) supabase?.auth.getSession().then(({ data }) => { if (data.session) window.location.href = "/"; }); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage("");
    if (!supabaseConfigured || !supabase) { setMessage("Chưa cấu hình Supabase. Hãy điền NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong Vercel."); return; }
    setBusy(true);
    const result = mode === "login" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
    setBusy(false);
    if (result.error) setMessage(result.error.message);
    else setMessage(mode === "login" ? "Đăng nhập thành công…" : "Đăng ký thành công. Kiểm tra email để xác nhận tài khoản.");
    if (mode === "login" && !result.error) window.location.href = "/";
  };
  return <main className="auth-page"><div className="auth-card"><div className="auth-brand"><div className="brand-mark">A<span>+</span></div><div><b>Air & Sea</b><small>SEO Control Center</small></div></div><p className="eyebrow">MULTI-WEBSITE SEO MANAGEMENT</p><h1>{mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</h1><p className="auth-muted">Quản lý nhiều website, mỗi website là một project với dữ liệu riêng.</p>{!supabaseConfigured && <div className="auth-notice"><b>Hệ thống chưa được cấu hình đăng nhập.</b><span>Thêm Supabase URL và Anon Key vào biến môi trường Vercel rồi tải lại trang. Giao diện quản trị đang được khóa.</span></div>}<form onSubmit={submit}>{mode === "signup" && <label>Họ tên<input disabled={!supabaseConfigured} value={name} onChange={event => setName(event.target.value)} placeholder="Nguyễn Văn A" /></label>}<label>Email<input disabled={!supabaseConfigured} type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="email@domain.com" /></label><label>Mật khẩu<input disabled={!supabaseConfigured} type="password" required minLength={6} value={password} onChange={event => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" /></label><button className="primary auth-submit" disabled={busy || !supabaseConfigured}>{busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Đăng ký"}</button></form>{message && <p className="auth-message">{message}</p>}{supabaseConfigured && <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMessage(""); }}>{mode === "login" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}</button>}{localModeAllowed && <button className="local-mode-button" onClick={() => { window.location.href = "/"; }}>Vào chế độ local dành cho phát triển</button>}</div></main>;
}
