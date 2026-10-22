"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Employee } from "@/lib/types";
import { parseDate } from "@/lib/dates";

export type ActionState = { ok: boolean; message: string } | null;

const text = (v: FormDataEntryValue | null, max = 200) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** Empty string -> null, so optional columns stay NULL rather than ''. */
const orNull = (v: string) => (v === "" ? null : v);

/* ------------------------------------------------------------------ */
/* Sites                                                               */
/* ------------------------------------------------------------------ */

export async function addSite(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = text(formData.get("code"), 40).toUpperCase();
  const name = text(formData.get("name"), 160);

  if (!code || !name) {
    return { ok: false, message: "A site code and name are both required." };
  }
  if (!/^[A-Z0-9-]+$/.test(code)) {
    return { ok: false, message: "Site code: capitals, numbers and hyphens only." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert({
    code,
    name,
    client_name: orNull(text(formData.get("client_name"), 160)),
    principal_employer: orNull(text(formData.get("principal_employer"), 160)),
    city: orNull(text(formData.get("city"), 80)),
    state: orNull(text(formData.get("state"), 80)),
    started_on: parseDate(formData.get("started_on")),
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: `Site code "${code}" already exists.` };
    }
    console.error("addSite:", error.message);
    return { ok: false, message: "Could not save the site." };
  }

  revalidatePath("/portal");
  return { ok: true, message: `${name} added.` };
}

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export async function saveEmployee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = text(formData.get("id"), 40);
  const siteId = text(formData.get("site_id"), 40);
  const fullName = text(formData.get("full_name"), 160);

  if (!siteId) return { ok: false, message: "Missing site." };
  if (!fullName) return { ok: false, message: "Employee name is required." };

  const aadhaar = text(formData.get("aadhaar_last4"), 4);
  if (aadhaar && !/^\d{4}$/.test(aadhaar)) {
    return { ok: false, message: "Aadhaar: enter only the last 4 digits." };
  }

  const uan = text(formData.get("uan"), 12);
  if (uan && !/^\d{12}$/.test(uan)) {
    return { ok: false, message: "UAN must be 12 digits." };
  }

  const ifsc = text(formData.get("ifsc"), 11).toUpperCase();
  if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
    return { ok: false, message: "IFSC does not look right (e.g. HDFC0001234)." };
  }

  const row = {
    site_id: siteId,
    emp_code: orNull(text(formData.get("emp_code"), 40)),
    full_name: fullName,
    father_name: orNull(text(formData.get("father_name"), 160)),
    gender: orNull(text(formData.get("gender"), 20)),
    dob: parseDate(formData.get("dob")),
    mobile: orNull(text(formData.get("mobile"), 20)),
    email: orNull(text(formData.get("email"), 160)),
    address: orNull(text(formData.get("address"), 400)),
    designation: orNull(text(formData.get("designation"), 120)),
    category: orNull(text(formData.get("category"), 20)) as Employee["category"],
    doj: parseDate(formData.get("doj")),
    dol: parseDate(formData.get("dol")),
    status: (text(formData.get("status"), 20) || "active") as Employee["status"],
    aadhaar_last4: orNull(aadhaar),
    uan: orNull(uan),
    pf_account_no: orNull(text(formData.get("pf_account_no"), 40)),
    esi_number: orNull(text(formData.get("esi_number"), 20)),
    pf_applicable: formData.get("pf_applicable") === "on",
    esi_applicable: formData.get("esi_applicable") === "on",
    bank_name: orNull(text(formData.get("bank_name"), 120)),
    bank_account_no: orNull(text(formData.get("bank_account_no"), 40)),
    ifsc: orNull(ifsc),
    notes: orNull(text(formData.get("notes"), 1000)),
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("employees").update(row).eq("id", id)
    : await supabase.from("employees").insert(row);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, message: "That employee code already exists on this site." };
    }
    console.error("saveEmployee:", error.message);
    return { ok: false, message: "Could not save. Check the fields and try again." };
  }

  revalidatePath(`/portal/sites/${siteId}`);
  return { ok: true, message: id ? "Saved." : `${fullName} added.` };
}

/* ------------------------------------------------------------------ */
/* Excel import                                                        */
/* ------------------------------------------------------------------ */

export type ImportRow = Record<string, string | null>;

export async function importEmployees(
  siteId: string,
  rows: ImportRow[],
): Promise<ActionState> {
  if (!siteId) return { ok: false, message: "Missing site." };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, message: "No rows selected." };
  }
  if (rows.length > 500) {
    return { ok: false, message: "Import at most 500 rows at a time." };
  }

  const prepared = rows
    .map((r) => ({
      site_id: siteId,
      emp_code: r.emp_code || null,
      full_name: (r.full_name || "").trim().slice(0, 160),
      father_name: r.father_name || null,
      dob: parseDate(r.dob),
      doj: parseDate(r.doj),
      designation: r.designation || null,
      category: (r.category || null) as Employee["category"],
      mobile: r.mobile || null,
      uan: r.uan || null,
      esi_number: r.esi_number || null,
      bank_name: r.bank_name || null,
      bank_account_no: r.bank_account_no || null,
      ifsc: r.ifsc ? r.ifsc.toUpperCase() : null,
    }))
    .filter((r) => r.full_name.length > 0);

  if (prepared.length === 0) {
    return { ok: false, message: "No rows had a name. Check the column mapping." };
  }

  const supabase = await createClient();

  // upsert on (site_id, emp_code) so re-importing an updated sheet
  // refreshes people rather than duplicating them. Rows without a code
  // cannot be matched, so they are inserted plainly.
  const withCode = prepared.filter((r) => r.emp_code);
  const withoutCode = prepared.filter((r) => !r.emp_code);

  let saved = 0;

  if (withCode.length) {
    const { error, count } = await supabase
      .from("employees")
      .upsert(withCode, { onConflict: "site_id,emp_code", count: "exact" });
    if (error) {
      console.error("importEmployees upsert:", error.message);
      return { ok: false, message: `Import failed: ${error.message}` };
    }
    saved += count ?? withCode.length;
  }

  if (withoutCode.length) {
    const { error, count } = await supabase
      .from("employees")
      .insert(withoutCode, { count: "exact" });
    if (error) {
      console.error("importEmployees insert:", error.message);
      return { ok: false, message: `Import failed: ${error.message}` };
    }
    saved += count ?? withoutCode.length;
  }

  revalidatePath(`/portal/sites/${siteId}`);
  return {
    ok: true,
    message: `${saved} employee${saved === 1 ? "" : "s"} imported.`,
  };
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

/** Short-lived signed URL. The bucket is private; never link it directly. */
export async function getDocumentUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from("employee-docs")
    .createSignedUrl(path, 60);

  if (error) {
    console.error("getDocumentUrl:", error.message);
    return null;
  }
  return data.signedUrl;
}

export async function deleteDocument(
  id: string,
  path: string,
  siteId: string,
): Promise<ActionState> {
  const supabase = await createClient();

  const { error: sErr } = await supabase.storage
    .from("employee-docs")
    .remove([path]);
  if (sErr) console.error("deleteDocument storage:", sErr.message);

  const { error } = await supabase.from("employee_documents").delete().eq("id", id);
  if (error) {
    console.error("deleteDocument row:", error.message);
    return { ok: false, message: "Could not remove the document." };
  }

  revalidatePath(`/portal/sites/${siteId}`);
  return { ok: true, message: "Document removed." };
}

export async function recordDocument(input: {
  employeeId: string;
  siteId: string;
  type: string;
  label: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
}): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("employee_documents").insert({
    employee_id: input.employeeId,
    type: input.type,
    label: input.label || null,
    file_path: input.filePath,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    uploaded_by: user?.id ?? null,
  });

  if (error) {
    console.error("recordDocument:", error.message);
    return { ok: false, message: "Uploaded, but the record could not be saved." };
  }

  revalidatePath(`/portal/sites/${input.siteId}`);
  return { ok: true, message: "Document uploaded." };
}
