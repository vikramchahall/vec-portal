"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Icon } from "@/components/vec/Icon";

export default function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action}>
      <h1>Sign in</h1>
      <p className="muted">Office accounts only (Owner, HR).</p>
      {notice && !state ? <div className="alert info mt16"><Icon name="info" size="sm" /><div>{notice}</div></div> : null}
      <div className="field mt16"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="username" required /></div>
      <div className="field mt16"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn primary mt24" style={{ width: "100%", justifyContent: "center" }} disabled={pending} type="submit">
        {pending ? "Signing in…" : <>Sign in <Icon name="arrowR" size="sm" /></>}
      </button>
      {state ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{state.message}</div></div> : null}
      <div className="dim mt16" style={{ fontSize: 12 }}>Forgot password? Ask the owner — passwords are reset on the server (no reset email).</div>
      <a className="btn ghost mt16" style={{ width: "100%", justifyContent: "center" }} href="/worker/login">VEC worker? Check your salary <Icon name="arrowR" size="sm" /></a>
    </form>
  );
}
