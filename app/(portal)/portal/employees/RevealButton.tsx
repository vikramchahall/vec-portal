"use client";

import { useState, useTransition } from "react";
import { revealAction } from "./actions";
import { Icon } from "@/components/vec/Icon";

export default function RevealButton({ id, field, masked }: { id: number; field: "aadhaar" | "pan" | "account"; masked: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="row" style={{ gap: 12 }}>
      <span className="mono">{value ?? masked}</span>
      {value === null ? (
        <button type="button" className="btn sm" disabled={pending}
          onClick={() => start(async () => { const r = await revealAction(id, field); if (r.error) setErr(r.error); else setValue(r.value); })}>
          <Icon name="eye" size="sm" />Reveal (logged)
        </button>
      ) : (
        <button type="button" className="btn sm ghost" onClick={() => setValue(null)}>Hide</button>
      )}
      {err ? <span className="dim" style={{ fontSize: 12 }}>{err}</span> : null}
    </span>
  );
}
