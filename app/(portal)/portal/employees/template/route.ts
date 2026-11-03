import { currentUser } from "@/lib/auth";
import { templateWorkbook } from "@/lib/import";

/** Blank "VEC Employees" import template (for STP, HZL and anyone not in a salary workbook). */
export async function GET() {
  if (!(await currentUser())) return new Response("Sign in first", { status: 401 });
  return new Response(new Uint8Array(templateWorkbook()), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": 'attachment; filename="VEC_Employees_Template.xlsx"' },
  });
}
