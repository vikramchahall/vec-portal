"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveEmployee, type ActionState } from "@/app/(portal)/portal/actions";
import {
  SKILL_GRADES,
  type Employee,
  type EmployeeDocument,
} from "@/lib/types";
import Documents from "./Documents";
import { Detail, Field, Notice, btnGhost, btnPrimary, fieldCls, labelCls } from "./ui";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnPrimary}>
      <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
      <span className="relative z-10">{pending ? "Saving…" : label}</span>
    </button>
  );
}

/** The full add/edit form. Also used for the expanded "Edit" view. */
function EmployeeForm({
  siteId,
  employee,
  onDone,
}: {
  siteId: string;
  employee?: Employee;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveEmployee, null);

  if (state?.ok && onDone) setTimeout(onDone, 700);

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="site_id" value={siteId} />
      {employee ? <input type="hidden" name="id" value={employee.id} /> : null}

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Identity
        </h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" name="full_name" required defaultValue={employee?.full_name} />
          <Field label="Father's name" name="father_name" defaultValue={employee?.father_name} />
          <Field label="Employee code" name="emp_code" defaultValue={employee?.emp_code} />
          <Field label="Date of birth" name="dob" type="date" defaultValue={employee?.dob} />
          <Field label="Mobile" name="mobile" type="tel" defaultValue={employee?.mobile} />
          <Field label="Email" name="email" type="email" defaultValue={employee?.email} />
          <div className="sm:col-span-2 lg:col-span-3">
            <label className={labelCls} htmlFor="address">
              Address
            </label>
            <textarea
              id="address"
              name="address"
              rows={2}
              defaultValue={employee?.address ?? ""}
              className={`${fieldCls} mt-1.5 resize-y`}
            />
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Engagement
        </h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Designation" name="designation" defaultValue={employee?.designation} />
          <div>
            <label className={labelCls} htmlFor="category">
              Grade
            </label>
            <select
              id="category"
              name="category"
              defaultValue={employee?.category ?? ""}
              className={`${fieldCls} mt-1.5`}
            >
              <option value="">—</option>
              {SKILL_GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <Field label="Date of joining" name="doj" type="date" defaultValue={employee?.doj} />
          <div>
            <label className={labelCls} htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={employee?.status ?? "active"}
              className={`${fieldCls} mt-1.5`}
            >
              <option value="active">Active</option>
              <option value="left">Left</option>
              <option value="transferred">Transferred</option>
            </select>
          </div>
          <Field label="Date of leaving" name="dol" type="date" defaultValue={employee?.dol} />
        </div>
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Statutory
        </h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Aadhaar — last 4 only"
            name="aadhaar_last4"
            placeholder="1234"
            defaultValue={employee?.aadhaar_last4}
          />
          <Field label="UAN" name="uan" placeholder="12 digits" defaultValue={employee?.uan} />
          <Field label="PF account no." name="pf_account_no" defaultValue={employee?.pf_account_no} />
          <Field label="ESI number" name="esi_number" defaultValue={employee?.esi_number} />
          <label className="flex items-center gap-2 text-[12px] text-chalk">
            <input
              type="checkbox"
              name="pf_applicable"
              defaultChecked={employee?.pf_applicable ?? true}
              className="accent-[#e1121b]"
            />
            PF applicable
          </label>
          <label className="flex items-center gap-2 text-[12px] text-chalk">
            <input
              type="checkbox"
              name="esi_applicable"
              defaultChecked={employee?.esi_applicable ?? true}
              className="accent-[#e1121b]"
            />
            ESI applicable
          </label>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-faint">
          Store only the last four digits of the Aadhaar number. The full card
          can be attached as a document if the client requires it.
        </p>
      </section>

      <section>
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          Payment
        </h4>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field label="Bank" name="bank_name" defaultValue={employee?.bank_name} />
          <Field label="Account no." name="bank_account_no" defaultValue={employee?.bank_account_no} />
          <Field label="IFSC" name="ifsc" placeholder="HDFC0001234" defaultValue={employee?.ifsc} />
        </div>
      </section>

      <div>
        <label className={labelCls} htmlFor="notes">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={employee?.notes ?? ""}
          className={`${fieldCls} mt-1.5 resize-y`}
        />
      </div>

      <Notice state={state} />
      <Submit label={employee ? "Save changes" : "Add employee"} />
    </form>
  );
}

export default function EmployeeList({
  siteId,
  employees,
  documents,
}: {
  siteId: string;
  employees: Employee[];
  documents: EmployeeDocument[];
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const docsFor = useMemo(() => {
    const m = new Map<string, EmployeeDocument[]>();
    for (const d of documents) {
      const list = m.get(d.employee_id) ?? [];
      list.push(d);
      m.set(d.employee_id, list);
    }
    return m;
  }, [documents]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.full_name, e.emp_code, e.designation, e.mobile, e.father_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [employees, query]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, code, designation, mobile…"
          className={`${fieldCls} max-w-xs`}
        />
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className={btnGhost}
        >
          {adding ? "Cancel" : "+ Add employee"}
        </button>
      </div>

      {adding ? (
        <div className="mt-5 border border-line bg-surface p-6">
          <h3 className="font-display text-base text-chalk">New employee</h3>
          <div className="mt-5">
            <EmployeeForm siteId={siteId} onDone={() => setAdding(false)} />
          </div>
        </div>
      ) : null}

      <p className="mt-5 text-[11px] uppercase tracking-[0.16em] text-faint">
        {shown.length} of {employees.length} shown
      </p>

      {shown.length === 0 ? (
        <p className="mt-6 border border-line bg-surface p-8 text-center text-[13px] text-mist">
          {employees.length === 0
            ? "No employees on this site yet. Import a master sheet or add someone."
            : "Nothing matches that search."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-line border border-line bg-surface">
          {shown.map((e) => {
            const open = openId === e.id;
            const docs = docsFor.get(e.id) ?? [];
            return (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(open ? null : e.id);
                    setEditId(null);
                  }}
                  aria-expanded={open}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-raised sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-chalk">
                      {e.full_name}
                    </span>
                    <span className="block truncate text-[11px] text-faint">
                      {e.emp_code ? `${e.emp_code} · ` : ""}
                      {e.father_name ?? "—"}
                    </span>
                  </span>

                  <span className="hidden min-w-0 sm:block">
                    <span className="block truncate text-[12px] text-chalk">
                      {e.designation ?? "—"}
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.14em] text-faint">
                      {e.category ?? "—"}
                    </span>
                  </span>

                  <span className="hidden text-[12px] text-mist sm:block">
                    {e.mobile ?? "—"}
                  </span>

                  <span className="flex items-center gap-3">
                    {e.status !== "active" ? (
                      <span className="bg-raised px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                        {e.status}
                      </span>
                    ) : null}
                    {docs.length ? (
                      <span className="text-[10px] text-faint">{docs.length} doc</span>
                    ) : null}
                    <span
                      aria-hidden
                      className={`text-faint transition-transform duration-300 ${open ? "rotate-45" : ""}`}
                    >
                      +
                    </span>
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-line bg-deep px-4 py-6 sm:px-6">
                    {editId === e.id ? (
                      <EmployeeForm
                        siteId={siteId}
                        employee={e}
                        onDone={() => setEditId(null)}
                      />
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                            Details
                          </h4>
                          <button
                            type="button"
                            onClick={() => setEditId(e.id)}
                            className={btnGhost}
                          >
                            Edit
                          </button>
                        </div>

                        <dl className="mt-4 grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
                          <Detail label="Employee code" value={e.emp_code} />
                          <Detail label="Father's name" value={e.father_name} />
                          <Detail label="Date of birth" value={e.dob} />
                          <Detail label="Date of joining" value={e.doj} />
                          <Detail label="Designation" value={e.designation} />
                          <Detail label="Grade" value={e.category} />
                          <Detail label="Mobile" value={e.mobile} />
                          <Detail label="Email" value={e.email} />
                          <Detail
                            label="Aadhaar"
                            value={e.aadhaar_last4 ? `•••• ${e.aadhaar_last4}` : null}
                          />
                          <Detail label="UAN" value={e.uan} />
                          <Detail label="ESI number" value={e.esi_number} />
                          <Detail label="PF account" value={e.pf_account_no} />
                          <Detail label="Bank" value={e.bank_name} />
                          <Detail label="Account no." value={e.bank_account_no} />
                          <Detail label="IFSC" value={e.ifsc} />
                          <Detail
                            label="PF / ESI"
                            value={`${e.pf_applicable ? "PF" : "no PF"} · ${
                              e.esi_applicable ? "ESI" : "no ESI"
                            }`}
                          />
                          <div className="sm:col-span-3 lg:col-span-4">
                            <Detail label="Address" value={e.address} />
                          </div>
                          {e.notes ? (
                            <div className="sm:col-span-3 lg:col-span-4">
                              <Detail label="Notes" value={e.notes} />
                            </div>
                          ) : null}
                        </dl>

                        <div className="mt-8 border-t border-line pt-6">
                          <Documents
                            employeeId={e.id}
                            siteId={siteId}
                            documents={docs}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
