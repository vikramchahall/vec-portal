import { audit, currentUser } from "@/lib/auth";
import { decryptBytes } from "@/lib/crypto";
import { documentFile } from "@/lib/documents";

export const dynamic = "force-dynamic";

/** Opens one document in the browser (decrypted on the server); every view is logged. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; doc: string }> }) {
  const user = await currentUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const { id, doc } = await params;
  const d = await documentFile(Number(id), Number(doc));
  if (!d) return new Response("Not found", { status: 404 });
  await audit(user.email, "view", "employee_document", d.employeeId, { kind: d.kind, fileName: d.fileName });
  return new Response(new Uint8Array(decryptBytes(d.data)), { headers: {
    "Content-Type": d.mime, "Content-Disposition": `inline; filename="${d.fileName.replace(/[^\w.\- ]/g, "_")}"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
