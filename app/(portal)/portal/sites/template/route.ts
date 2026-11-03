import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function GET(req: Request) {
  await requireUser();
  const id = Number(new URL(req.url).searchParams.get("unit"));
  const [t] = await db().select().from(schema.excelTemplates).where(eq(schema.excelTemplates.unitId, id));
  if (!t) return new Response("No template for this unit", { status: 404 });
  return new Response(new Uint8Array(t.file), { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="${t.fileName.replace(/[^\w.\- &]/g, "_")}"`,
  } });
}
