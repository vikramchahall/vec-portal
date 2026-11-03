"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deletePunchFile } from "./actions";
import { Icon } from "@/components/vec/Icon";

export default function DeleteFile({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button className="btn ghost sm" title="Remove this file and its punches" disabled={pending}
      onClick={() => {
        if (!confirm(`Remove "${name}" and all punches stored from it?`)) return;
        start(async () => { await deletePunchFile(id); router.refresh(); });
      }}>
      <Icon name="x" size="sm" />
    </button>
  );
}
