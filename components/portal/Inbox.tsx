"use client";

import { useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { btnGhost, Detail, fieldCls, Notice } from "./ui";

type Enquiry = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  company: string | null;
  message: string;
  type: string;
  handled: boolean;
  created_at: string;
};

type Application = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  position_applied: string | null;
  experience_years: number | null;
  message: string | null;
  status: string;
  created_at: string;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const badge = (isNew: boolean) =>
  `shrink-0 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${
    isNew ? "bg-accent text-white" : "bg-raised text-faint"
  }`;

const rowCls =
  "grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-raised sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto_auto]";

export default function Inbox({
  enquiries,
  applications,
}: {
  enquiries: Enquiry[];
  applications: Application[];
}) {
  const [tab, setTab] = useState<"enq" | "app">("enq");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  const matches = (hay: (string | null)[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return hay.filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
  };

  const enq = useMemo(
    () =>
      enquiries.filter((e) =>
        matches([e.name, e.company, e.email, e.phone, e.message]),
      ),
    [enquiries, query],
  );

  const app = useMemo(
    () =>
      applications.filter((a) =>
        matches([a.name, a.position_applied, a.city, a.phone, a.email]),
      ),
    [applications, query],
  );

  function mark(
    table: "enquiries" | "job_applications",
    id: string,
    value: boolean,
  ) {
    start(async () => {
      const supabase = createClient();
      const patch =
        table === "enquiries"
          ? { handled: value }
          : { status: value ? "shortlisted" : "new" };

      const { error } = await supabase.from(table).update(patch).eq("id", id);
      if (error) {
        setState({ ok: false, message: `Could not update: ${error.message}` });
        return;
      }
      setTouched((d) => ({ ...d, [id]: value }));
      setState({ ok: true, message: "Updated." });
    });
  }

  const empty = (tab === "enq" ? enq : app).length === 0;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-1 border-b border-line">
          {(
            [
              ["enq", `Enquiries (${enquiries.length})`],
              ["app", `Applications (${applications.length})`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              type="button"
              onClick={() => {
                setTab(k);
                setOpenId(null);
              }}
              className={`relative px-5 py-3 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors ${
                tab === k ? "text-chalk" : "text-faint hover:text-mist"
              }`}
            >
              {label}
              <span
                className={`absolute inset-x-0 bottom-[-1px] h-0.5 bg-accent transition-transform ${
                  tab === k ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          ))}
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className={`${fieldCls} max-w-xs`}
        />
      </div>

      <div className="mt-4">
        <Notice state={state} />
      </div>

      {empty ? (
        <p className="mt-6 border border-line bg-surface p-8 text-center text-[13px] text-mist">
          Nothing here yet.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-line border border-line bg-surface">
          {tab === "enq"
            ? enq.map((e) => {
                const open = openId === e.id;
                const handled = touched[e.id] ?? e.handled;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : e.id)}
                      className={rowCls}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-chalk">
                          {e.name}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {e.company ?? e.email ?? e.phone ?? "—"}
                        </span>
                      </span>
                      <span className="hidden text-[11px] uppercase tracking-[0.14em] text-mist sm:block">
                        {e.type.replace(/_/g, " ")}
                      </span>
                      <span className="hidden text-[11px] text-faint sm:block">
                        {when(e.created_at)}
                      </span>
                      <span className={badge(!handled)}>
                        {handled ? "Done" : "New"}
                      </span>
                    </button>

                    {open ? (
                      <div className="border-t border-line bg-deep px-4 py-6 sm:px-6">
                        <dl className="grid gap-5 sm:grid-cols-4">
                          <Detail label="Name" value={e.name} />
                          <Detail label="Company" value={e.company} />
                          <Detail
                            label="Email"
                            value={
                              e.email ? (
                                <a className="link-underline" href={`mailto:${e.email}`}>
                                  {e.email}
                                </a>
                              ) : null
                            }
                          />
                          <Detail
                            label="Phone"
                            value={
                              e.phone ? (
                                <a className="link-underline" href={`tel:${e.phone}`}>
                                  {e.phone}
                                </a>
                              ) : null
                            }
                          />
                          <div className="sm:col-span-4">
                            <Detail
                              label="Message"
                              value={
                                <span className="whitespace-pre-wrap">{e.message}</span>
                              }
                            />
                          </div>
                        </dl>
                        <div className="mt-6">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => mark("enquiries", e.id, !handled)}
                            className={btnGhost}
                          >
                            {handled ? "Mark as new" : "Mark as handled"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })
            : app.map((a) => {
                const open = openId === a.id;
                const seen = touched[a.id] ?? a.status === "shortlisted";
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : a.id)}
                      className={rowCls}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-chalk">
                          {a.name}
                        </span>
                        <span className="block truncate text-[11px] text-faint">
                          {a.phone ?? "—"}
                          {a.city ? ` · ${a.city}` : ""}
                        </span>
                      </span>
                      <span className="hidden truncate text-[12px] text-mist sm:block">
                        {a.position_applied ?? "—"}
                      </span>
                      <span className="hidden text-[11px] text-faint sm:block">
                        {when(a.created_at)}
                      </span>
                      <span className={badge(!seen)}>{seen ? "Seen" : "New"}</span>
                    </button>

                    {open ? (
                      <div className="border-t border-line bg-deep px-4 py-6 sm:px-6">
                        <dl className="grid gap-5 sm:grid-cols-4">
                          <Detail label="Post applied for" value={a.position_applied} />
                          <Detail
                            label="Experience"
                            value={
                              a.experience_years != null
                                ? `${a.experience_years} yr`
                                : null
                            }
                          />
                          <Detail label="City" value={a.city} />
                          <Detail
                            label="Phone"
                            value={
                              a.phone ? (
                                <a className="link-underline" href={`tel:${a.phone}`}>
                                  {a.phone}
                                </a>
                              ) : null
                            }
                          />
                          <div className="sm:col-span-4">
                            <Detail
                              label="Message"
                              value={
                                a.message ? (
                                  <span className="whitespace-pre-wrap">{a.message}</span>
                                ) : null
                              }
                            />
                          </div>
                        </dl>
                        <div className="mt-6">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => mark("job_applications", a.id, !seen)}
                            className={btnGhost}
                          >
                            {seen ? "Mark as new" : "Mark as seen"}
                          </button>
                        </div>
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
