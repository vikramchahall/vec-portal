"use client";

import { useActionState } from "react";
import { workerLoginAction, type WorkerLoginState } from "../actions";
import { Icon } from "@/components/vec/Icon";

export default function WorkerLoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState<WorkerLoginState, FormData>(workerLoginAction, null);
  return (
    <form action={action}>
      <h1>Check your salary</h1>
      <p className="muted">For VEC workers. Use the number on your gate card and your date of birth.</p>
      {notice && !state ? <div className="alert info mt16"><Icon name="info" size="sm" /><div>{notice}</div></div> : null}
      <div className="field mt16"><label htmlFor="card">Card number</label>
        <input className="input" id="card" name="card" inputMode="numeric" autoComplete="username" placeholder="e.g. 46861508" defaultValue={state?.card} key={`c${state?.card}`} required /></div>
      <div className="field mt16"><label htmlFor="dob">Date of birth</label><input className="input" id="dob" name="dob" type="date" defaultValue={state?.dob} key={`d${state?.dob}`} required /></div>
      <button className="btn primary mt24" style={{ width: "100%", justifyContent: "center" }} disabled={pending} type="submit">
        {pending ? "Opening…" : <>Open my salary <Icon name="arrowR" size="sm" /></>}
      </button>
      {state ? <div className="alert err mt16"><Icon name="xCircle" size="sm" /><div>{state.message}</div></div> : null}
      <div className="dim mt16" style={{ fontSize: 12 }}>Problem signing in? Speak to the VEC office at your site.</div>
    </form>
  );
}
