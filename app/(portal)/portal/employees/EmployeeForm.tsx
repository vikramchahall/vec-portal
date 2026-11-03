"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveEmployeeAction, type FormState } from "./actions";
import { Icon } from "@/components/vec/Icon";

export type FormInitial = Record<string, string | boolean | number | null | undefined>;
type Unit = { code: string; name: string; siteName: string };

const CATS = ["UNSKILLED", "SEMI SKILLED", "SKILLED", "HIGH SKILLED"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function EmployeeForm({ id, initial, units, secrets }: {
  id: number | null; initial: FormInitial; units: Unit[]; secrets: { aadhaar: string | null; pan: string | null; account: string | null };
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveEmployeeAction.bind(null, id), null);
  const v = (k: string) => (state?.fields?.[k] ?? (initial[k] === null || initial[k] === undefined ? "" : String(initial[k])));
  const isNew = id === null;

  const F = ({ k, label, req, hint, type = "text", span, ph }: { k: string; label: string; req?: boolean; hint?: string; type?: string; span?: boolean; ph?: string }) => (
    <div className={`field ${span ? "span2" : ""}`}>
      <label htmlFor={k}>{label}{req ? <span className="req"> *</span> : null}</label>
      <input className="input" id={k} name={k} type={type} defaultValue={v(k)} placeholder={ph} required={req} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
  const S = ({ k, label, opts, req, hint }: { k: string; label: string; opts: [string, string][]; req?: boolean; hint?: string }) => (
    <div className="field">
      <label htmlFor={k}>{label}{req ? <span className="req"> *</span> : null}</label>
      <select className="select" id={k} name={k} defaultValue={v(k)} required={req}>{opts.map(([val, t]) => <option key={val} value={val}>{t}</option>)}</select>
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
  const C = ({ k, label }: { k: string; label: string }) => (
    <label className="row" style={{ gap: 8, fontSize: 13.5 }}>
      <input type="hidden" name={`${k}__present`} value="1" />
      <input type="checkbox" name={k} defaultChecked={state?.fields ? state.fields[k] === "on" : Boolean(initial[k])} />{label}
    </label>
  );
  const Secret = ({ k, label, ph, stored }: { k: "aadhaar" | "pan" | "account"; label: string; ph: string; stored: string | null }) => (
    <div className="field">
      <label htmlFor={k}>{label}</label>
      <input className="input" id={k} name={k} placeholder={stored ? `Stored (ends ${stored}) — type to replace` : ph} autoComplete="off" />
      <span className="hint">Stored encrypted · shown as last 4{stored ? <> · <label><input type="checkbox" name={`${k}__clear`} /> clear</label></> : null}</span>
    </div>
  );

  return (
    <form action={action}>
      {state?.error ? <div className="alert err" style={{ marginBottom: 16 }}><Icon name="xCircle" size="sm" /><div>{state.error}</div></div> : null}
      <div className="card">
        <div className="card-h"><h3>Personal</h3></div>
        <div className="card-b form-grid">
          <F k="name" label="Full name (as on Aadhaar)" req />
          <F k="fatherName" label="Father's name" />
          <F k="dob" label="Date of birth" type="date" />
          <S k="gender" label="Gender" opts={[["", "—"], ["Male", "Male"], ["Female", "Female"], ["Other", "Other"]]} />
          <F k="mobile" label="Mobile" ph="+91 98xxx xxxxx" />
          <Secret k="aadhaar" label="Aadhaar" ph="12 digits" stored={secrets.aadhaar} />
          <Secret k="pan" label="PAN" ph="ABCDE1234F" stored={secrets.pan} />
          <F k="address" label="Address" span />
        </div>
      </div>

      <div className="card mt16">
        <div className="card-h"><h3>Employment</h3><span className="right dim" style={{ fontSize: 12 }}>A new card, unit or pay amount starts from the &ldquo;applies from&rdquo; date; the old one is kept in history</span></div>
        <div className="card-b form-grid">
          <S k="unitCode" label="Unit" req opts={[["", "Choose unit…"], ...units.map((u): [string, string] => [u.code, `${u.code} — ${u.siteName}`])]} />
          <F k="cardNo" label="Gate card / employee code" hint="Punch files are matched to this person by this number" />
          <F k="registerNo" label="Register no." />
          <F k="designation" label="Designation" req={isNew} />
          <S k="category" label="Category" opts={[["", "—"], ...CATS.map((c): [string, string] => [c, c])]} hint="Sets the minimum-wage check" />
          <S k="woWeekday" label="Usual weekly off" opts={[["", "—"], ...DAYS.map((d): [string, string] => [d, d])]} hint="New joiners start with Sunday" />
          <F k="doj" label="Date of joining" type="date" />
          <S k="status" label="Status" opts={[["active", "Active"], ["on_hold", "On hold"], ["left", "Left"]]} />
          <F k="dol" label="Date of leaving" type="date" />
          <F k="effectiveFrom" label="Changes apply from" type="date" hint="Leave empty for date of joining (new) or today" />
          <div className="field" style={{ justifyContent: "flex-end" }}><C k="isDriver" label="Driver (driver salary rules)" /></div>
        </div>
      </div>

      <div className="card mt16">
        <div className="card-h"><h3>Pay structure (₹ per month)</h3></div>
        <div className="card-b form-grid">
          <F k="basicDa" label="Basic + DA" req={isNew} type="number" />
          <F k="hra" label="HRA" type="number" />
          <F k="special" label="Special allowance" type="number" />
          <F k="conveyance" label="Conveyance" type="number" />
          <F k="others" label="Others" type="number" />
          <div className="field" style={{ gap: 8, justifyContent: "flex-end" }}>
            <C k="pfMember" label="PF member" /><C k="esiMember" label="ESIC member" /><C k="bonusMonthly" label="Bonus paid monthly (8.33%)" />
          </div>
        </div>
      </div>

      <div className="card mt16">
        <div className="card-h"><h3>Statutory &amp; bank</h3></div>
        <div className="card-b form-grid">
          <F k="uan" label="UAN" ph="12 digits" />
          <F k="pfAccount" label="PF account no." />
          <F k="esicIp" label="ESIC IP no." />
          <F k="bankName" label="Bank" />
          <Secret k="account" label="Account no." ph="digits only" stored={secrets.account} />
          <F k="ifsc" label="IFSC" ph="SBIN0001234" />
          <F k="notes" label="Notes" span />
        </div>
        <div className="card-h" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
          <Link className="btn ghost" href={id ? `/portal/employees/${id}` : "/portal/employees"}>Cancel</Link>
          <div className="right"><button className="btn primary" type="submit" disabled={pending}><Icon name="check" size="sm" />{pending ? "Saving…" : isNew ? "Save employee" : "Save changes"}</button></div>
        </div>
      </div>
    </form>
  );
}
