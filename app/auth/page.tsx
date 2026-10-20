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

  const [showPassword, setShowPassword] = useState(false);
  return <main className="auth-page"><section className="auth-aside"><div className="auth-brand light"><div className="brand-mark">A<span>+</span></div><div><b>Air & Sea</b><small>SEO Command Center</small></div></div><div className="auth-aside-copy"><h2>Quản trị SEO nhiều website trong một nơi.</h2><p>Theo dõi công việc, thứ hạng từ khóa, backlink và xuất báo cáo cho khách hàng — tất cả trên một bảng điều khiển.</p><ul><li>Báo cáo tháng chia sẻ được bằng link</li><li>Đồng bộ Google Search Console &amp; GA4</li><li>Quản lý nhiều dự án website</li></ul></div><small className="auth-aside-foot">© Air &amp; Sea Global</small></section><section className="auth-main"><div className="auth-card"><div className="auth-brand mobile-only"><div className="brand-mark">A<span>+</span></div><div><b>Air & Sea</b><small>SEO Command Center</small></div></div><p className="eyebrow">KHU VỰC QUẢN TRỊ</p><h1>Chào mừng trở lại</h1><p className="auth-muted">Đăng nhập bằng tài khoản đã được cấp quyền.</p>{!supabaseConfigured && <div className="auth-notice"><b>Hệ thống chưa được cấu hình đăng nhập.</b><span>Thêm Supabase URL và Anon Key vào biến môi trường Vercel rồi tải lại trang. Giao diện quản trị đang được khóa.</span></div>}<form onSubmit={submit}><label>Email<input disabled={!supabaseConfigured} type="email" required autoComplete="email" autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="email@domain.com" /></label><label>Mật khẩu<span className="password-field"><input disabled={!supabaseConfigured} type={showPassword ? "text" : "password"} required minLength={6} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" /><button type="button" className="password-toggle" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}>{showPassword ? "Ẩn" : "Hiện"}</button></span></label><button className="primary auth-submit" disabled={busy || !supabaseConfigured}>{busy ? "Đang xử lý…" : "Đăng nhập"}</button></form>{message && <p className={`auth-message ${messageTone}`} role="alert">{message}</p>}{localModeAllowed && <button className="local-mode-button" onClick={() => { window.location.href = "/"; }}>Vào chế độ local dành cho phát triển</button>}</div></section></main>;
}
