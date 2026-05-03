"use client";

import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getReadableError } from "@/data/errors";

export function LoginView() {
  const { sendOtp, verifyOtp, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const sendOtpErrorMessage = sendOtp.error ? getReadableError(sendOtp.error) : "";
  const canUseExistingCode =
    Boolean(email.trim()) &&
    (otpSent || /rate limit|too many|wait|频率|稍后/i.test(sendOtpErrorMessage));

  function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail) {
      return;
    }

    sendOtp.mutate(nextEmail, {
      onSuccess: () => {
        setOtpSent(true);
      }
    });
  }

  function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();
    const nextToken = token.trim();

    if (!nextEmail || !nextToken) {
      return;
    }

    verifyOtp.mutate({ email: nextEmail, token: nextToken });
  }

  function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = email.trim();

    if (!nextEmail || !password) {
      return;
    }

    signInWithPassword.mutate({ email: nextEmail, password });
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <p className="eyebrow">note-remeber</p>
        <h1 id="login-title">进入你的问题库</h1>
        <p className="login-copy">使用已授权邮箱获取验证码。第一版默认不开放陌生邮箱自动注册。</p>

        <form className="login-form" onSubmit={handleSendOtp}>
          <label htmlFor="email">邮箱</label>
          <div className="input-with-icon">
            <Mail size={17} />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <button className="primary-button" type="submit" disabled={sendOtp.isPending || !email.trim()}>
            {sendOtp.isPending ? "发送中" : otpSent ? "重新发送验证码" : "发送验证码"}
          </button>
          {email.trim() && !otpSent ? (
            <button className="secondary-button" type="button" onClick={() => setOtpSent(true)}>
              我已有验证码
            </button>
          ) : null}
        </form>

        {canUseExistingCode ? (
          <form className="login-form" onSubmit={handleVerifyOtp}>
            <label htmlFor="token">验证码</label>
            <div className="input-with-icon">
              <ShieldCheck size={17} />
              <input
                id="token"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="输入邮箱验证码"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </div>
            <button className="primary-button" type="submit" disabled={verifyOtp.isPending || !token.trim()}>
              {verifyOtp.isPending ? "验证中" : "登录"}
            </button>
          </form>
        ) : null}

        <form className="login-form" onSubmit={handlePasswordLogin}>
          <label htmlFor="password">密码登录</label>
          <div className="input-with-icon">
            <KeyRound size={17} />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="输入 Supabase 用户密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <button className="secondary-button" type="submit" disabled={signInWithPassword.isPending || !email.trim() || !password}>
            {signInWithPassword.isPending ? "登录中" : "使用密码登录"}
          </button>
        </form>

        {sendOtp.error ? <p className="form-error">{sendOtpErrorMessage}</p> : null}
        {verifyOtp.error ? <p className="form-error">{getReadableError(verifyOtp.error)}</p> : null}
        {signInWithPassword.error ? <p className="form-error">{getReadableError(signInWithPassword.error)}</p> : null}
        {otpSent && !verifyOtp.error ? <p className="form-hint">验证码已发送，请查看邮箱。</p> : null}
      </section>
    </main>
  );
}
