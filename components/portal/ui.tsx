import type { ReactNode } from "react";

export const fieldCls =
  "w-full border border-line bg-white px-3 py-2.5 text-[13px] text-chalk outline-none transition-colors duration-200 placeholder:text-faint/70 focus:border-accent";
export const labelCls =
  "block text-[10px] font-semibold uppercase tracking-[0.16em] text-faint";
export const btnPrimary =
  "group relative inline-flex items-center gap-2 overflow-hidden bg-accent px-6 py-3 text-[13px] font-medium text-white transition-opacity duration-300 disabled:cursor-not-allowed disabled:opacity-60";
export const btnGhost =
  "border border-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-chalk transition-all duration-300 hover:border-accent hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required,
  span = 1,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
  span?: 1 | 2;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : undefined}>
      <label className={labelCls} htmlFor={name}>
        {label} {required ? <span className="text-accent">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className={`${fieldCls} mt-1.5`}
      />
    </div>
  );
}

export function Notice({
  state,
}: {
  state: { ok: boolean; message: string } | null;
}) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`border-l-2 py-2.5 pl-3 text-[12px] ${
        state.ok
          ? "border-brand bg-brand/10 text-chalk"
          : "border-accent bg-accent/10 text-accent-lit"
      }`}
    >
      {state.message}
    </p>
  );
}

export function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[9px] uppercase tracking-[0.18em] text-faint">{label}</dt>
      <dd className="mt-1 text-[13px] text-chalk">{value || "—"}</dd>
    </div>
  );
}
