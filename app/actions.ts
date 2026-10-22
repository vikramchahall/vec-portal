"use server";

import { getPublicClient } from "@/lib/supabase";

export type FormState = { ok: boolean; message: string } | null;

const MAX = { name: 120, email: 160, phone: 20, text: 2000 };

function clean(v: FormDataEntryValue | null, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function validEmail(v: string) {
  return v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function validPhone(v: string) {
  return v === "" || /^[\d\s+()-]{7,20}$/.test(v);
}

/* ------------------------------------------------------------------ */
/* Enquiry form                                                        */
/* ------------------------------------------------------------------ */

export async function submitEnquiry(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // Honeypot: a real person never fills this hidden field.
  if (clean(formData.get("company_website"), 100)) {
    return { ok: true, message: "Thank you — we will be in touch." };
  }

  const name = clean(formData.get("name"), MAX.name);
  const email = clean(formData.get("email"), MAX.email);
  const phone = clean(formData.get("phone"), MAX.phone);
  const company = clean(formData.get("company"), MAX.name);
  const message = clean(formData.get("message"), MAX.text);
  const type = clean(formData.get("type"), 40) || "enquiry";

  if (!name) return { ok: false, message: "Please enter your name." };
  if (!email && !phone)
    return { ok: false, message: "Please give us either an email or a phone number." };
  if (!validEmail(email))
    return { ok: false, message: "That email address does not look right." };
  if (!validPhone(phone))
    return { ok: false, message: "That phone number does not look right." };
  if (!message)
    return { ok: false, message: "Please tell us briefly what you need." };

  const allowedTypes = ["enquiry", "tender_invite", "vendor_registration"];
  const safeType = allowedTypes.includes(type) ? type : "enquiry";

  const supabase = getPublicClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        "The enquiry form is not connected yet. Please email us directly at vikramengineeringco@gmail.com.",
    };
  }

  const { error } = await supabase
    .from("enquiries")
    .insert({ name, email: email || null, phone: phone || null, company: company || null, message, type: safeType });

  if (error) {
    console.error("enquiry insert failed:", error.message);
    return {
      ok: false,
      message:
        "Something went wrong saving your enquiry. Please email vikramengineeringco@gmail.com instead.",
    };
  }

  return {
    ok: true,
    message: "Thank you — your enquiry has reached us. We will respond shortly.",
  };
}

/* ------------------------------------------------------------------ */
/* Job application form                                                */
/* ------------------------------------------------------------------ */

export async function submitApplication(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (clean(formData.get("company_website"), 100)) {
    return { ok: true, message: "Thank you — your application has been received." };
  }

  const name = clean(formData.get("name"), MAX.name);
  const phone = clean(formData.get("phone"), MAX.phone);
  const email = clean(formData.get("email"), MAX.email);
  const city = clean(formData.get("city"), MAX.name);
  const position = clean(formData.get("position_applied"), MAX.name);
  const experience = clean(formData.get("experience_years"), 6);
  const message = clean(formData.get("message"), MAX.text);

  if (!name) return { ok: false, message: "Please enter your name." };
  if (!phone) return { ok: false, message: "Please enter a phone number so we can call you." };
  if (!validPhone(phone))
    return { ok: false, message: "That phone number does not look right." };
  if (!validEmail(email))
    return { ok: false, message: "That email address does not look right." };
  if (!position) return { ok: false, message: "Please tell us which post you are applying for." };

  const years = experience ? Number(experience) : null;
  if (years !== null && (Number.isNaN(years) || years < 0 || years > 60))
    return { ok: false, message: "Please enter your experience in years." };

  const supabase = getPublicClient();
  if (!supabase) {
    return {
      ok: false,
      message:
        "The application form is not connected yet. Please WhatsApp or call +91 94174 85423.",
    };
  }

  const { error } = await supabase.from("job_applications").insert({
    name,
    phone,
    email: email || null,
    city: city || null,
    position_applied: position,
    experience_years: years,
    message: message || null,
  });

  if (error) {
    console.error("application insert failed:", error.message);
    return {
      ok: false,
      message:
        "Something went wrong. Please call or WhatsApp +91 94174 85423 instead.",
    };
  }

  return {
    ok: true,
    message:
      "Thank you — your application has been received. If there is a suitable opening we will call you.",
  };
}
