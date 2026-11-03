"use client";

import { Icon } from "@/components/vec/Icon";

export default function PrintButton() {
  return <button className="btn primary" type="button" onClick={() => window.print()}><Icon name="printer" size="sm" />Print / Save as PDF</button>;
}
