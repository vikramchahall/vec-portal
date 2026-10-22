"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSite, type ActionState } from "@/app/(portal)/portal/actions";
import { Field, Notice, btnGhost, btnPrimary } from "./ui";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btnPrimary}>
      <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
      <span className="relative z-10">{pending ? "Saving…" : "Add site"}</span>
    </button>
  );
}

export default function AddSite() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<ActionState, FormData>(addSite, null);

  // Close on success, but keep the confirmation visible.
  if (state?.ok && open) setTimeout(() => setOpen(false), 900);

  if (!open) {
    return (
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => setOpen(true)} className={btnGhost}>
          + Add site
        </button>
        <Notice state={state} />
      </div>
    );
  }

  return (
    <div className="border border-line bg-surface p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base text-chalk">New site</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-accent"
        >
          Cancel
        </button>
      </div>

      <form action={action} className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Site code"
            name="code"
            required
            placeholder="HZL-DEBARI"
          />
          <Field
            label="Site name"
            name="name"
            required
            placeholder="RO-DM Plant — Zinc Smelter"
          />
          <Field label="Client" name="client_name" placeholder="Hindustan Zinc Ltd" />
          <Field
            label="Principal employer"
            name="principal_employer"
            placeholder="Leave blank if direct"
          />
          <Field label="City" name="city" placeholder="Udaipur" />
          <Field label="State" name="state" placeholder="Rajasthan" />
          <Field label="Started on" name="started_on" type="date" />
        </div>

        <Notice state={state} />
        <Submit />
      </form>
    </div>
  );
}
