"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";

const field =
  "w-full border border-line bg-white px-4 py-3.5 text-sm text-chalk outline-none transition-colors duration-300 placeholder:text-faint/70 focus:border-accent";
const label =
  "block text-[10px] font-semibold uppercase tracking-[0.2em] text-faint";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative w-full overflow-hidden bg-accent px-8 py-4 text-sm font-medium text-white transition-opacity duration-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
      <span className="relative z-10">{pending ? "Signing in…" : "Sign in"}</span>
    </button>
  );
}

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<LoginState, FormData>(signIn, null);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <div>
        <label className={label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          maxLength={160}
          className={`${field} mt-2`}
        />
      </div>

      <div>
        <label className={label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          maxLength={200}
          className={`${field} mt-2`}
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[13px] text-accent-lit"
        >
          {state.error}
        </p>
      ) : null}

      <Submit />
    </form>
  );
}
