"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { submitEnquiry, submitApplication, type FormState } from "@/app/actions";

/* ------------------------------------------------------------------ */
/* Shared field styling                                                */
/* ------------------------------------------------------------------ */

const field =
  "w-full border border-line bg-deep px-4 py-3.5 text-sm text-chalk outline-none transition-colors duration-300 placeholder:text-faint/70 focus:border-accent";
const label =
  "block text-[10px] font-semibold uppercase tracking-[0.2em] text-faint";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="group relative inline-flex items-center gap-3 overflow-hidden bg-accent px-8 py-4 text-sm font-medium text-white transition-opacity duration-300 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
      <span className="relative z-10">{pending ? "Sending…" : children}</span>
      {!pending && (
        <span aria-hidden className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      )}
    </button>
  );
}

function Notice({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <p
      role="status"
      className={`border-l-2 py-3.5 pl-4 text-[13px] ${
        state.ok
          ? "border-brand-glow bg-brand/15 text-chalk"
          : "border-accent bg-accent/10 text-accent-lit"
      }`}
    >
      {state.message}
    </p>
  );
}

/** Hidden honeypot. Bots fill it; people never see it. */
function Honeypot() {
  return (
    <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
      <label htmlFor="company_website">Leave this field empty</label>
      <input id="company_website" name="company_website" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Enquiry                                                             */
/* ------------------------------------------------------------------ */

export function EnquiryForm() {
  const [state, action] = useActionState(submitEnquiry, null);

  return (
    <form action={action} className="relative space-y-6">
      <Honeypot />

      <div>
        <label className={label} htmlFor="type">
          What is this about
        </label>
        <select id="type" name="type" className={`${field} mt-2`} defaultValue="enquiry">
          <option value="enquiry">General enquiry</option>
          <option value="tender_invite">Tender invitation</option>
          <option value="vendor_registration">Vendor registration</option>
        </select>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">
            Your name <span className="text-accent">*</span>
          </label>
          <input id="name" name="name" required maxLength={120} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="company">
            Company
          </label>
          <input id="company" name="company" maxLength={120} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" maxLength={160} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" type="tel" maxLength={20} className={`${field} mt-2`} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="message">
          What do you need <span className="text-accent">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          maxLength={2000}
          className={`${field} mt-2 resize-y`}
          placeholder="Scope of work, site location, duration, and anything else that would help us respond properly."
        />
      </div>

      <Notice state={state} />
      <Submit>Send enquiry</Submit>
      <p className="text-[11px] leading-relaxed text-faint">
        We use your details only to reply to this enquiry. Either an email
        address or a phone number is enough.
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Job application                                                     */
/* ------------------------------------------------------------------ */

export function ApplicationForm() {
  const [state, action] = useActionState(submitApplication, null);

  return (
    <form action={action} className="relative space-y-6">
      <Honeypot />

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="a-name">
            Full name / पूरा नाम <span className="text-accent">*</span>
          </label>
          <input id="a-name" name="name" required maxLength={120} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="a-phone">
            Mobile / मोबाइल नंबर <span className="text-accent">*</span>
          </label>
          <input id="a-phone" name="phone" type="tel" required maxLength={20} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="a-position">
            Post applied for / पद <span className="text-accent">*</span>
          </label>
          <input
            id="a-position"
            name="position_applied"
            required
            maxLength={120}
            placeholder="Helper, Fitter, Field Operator…"
            className={`${field} mt-2`}
          />
        </div>
        <div>
          <label className={label} htmlFor="a-exp">
            Experience in years / अनुभव
          </label>
          <input
            id="a-exp"
            name="experience_years"
            type="number"
            min={0}
            max={60}
            step="0.5"
            className={`${field} mt-2`}
          />
        </div>
        <div>
          <label className={label} htmlFor="a-city">
            City / शहर
          </label>
          <input id="a-city" name="city" maxLength={120} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="a-email">
            Email
          </label>
          <input id="a-email" name="email" type="email" maxLength={160} className={`${field} mt-2`} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="a-message">
          Anything else / और कुछ
        </label>
        <textarea
          id="a-message"
          name="message"
          rows={4}
          maxLength={2000}
          className={`${field} mt-2 resize-y`}
          placeholder="Previous sites worked at, trade certificates, when you can join."
        />
      </div>

      <Notice state={state} />
      <Submit>Submit application</Submit>
      <p className="text-[11px] leading-relaxed text-faint">
        No fee is ever charged for a job at Vikram Engineering Co. If anyone
        asks you for money in our name, please tell us.
        <br />
        विक्रम इंजीनियरिंग में नौकरी के लिए कोई शुल्क नहीं लिया जाता।
      </p>
    </form>
  );
}
