import Image from "next/image";
import { company, navigation } from "@/lib/content";
import { Container } from "@/components/ui";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-line bg-deep">
      <div className="grid-field absolute inset-0 opacity-40" />
      <Container className="relative py-20">
        <div className="grid gap-14 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image src="/logo.svg" alt="" width={72} height={72} />
              <span className="font-display text-lg text-chalk">
                Vikram Engineering Co.
              </span>
            </div>
            <p className="mt-6 max-w-xs text-[13px] leading-relaxed text-mist">
              Plant O&amp;M, skilled manpower and mechanical contracting for
              refineries and process plants.
            </p>
            <address className="mt-6 not-italic text-[13px] leading-relaxed text-faint">
              {company.addressLines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ))}
            </address>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
              Sections
            </h3>
            <ul className="mt-6 space-y-3">
              {navigation.map((n) => (
                <li key={n.href}>
                  <a
                    href={n.href}
                    className="link-underline text-[13px] text-mist hover:text-chalk"
                  >
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-accent">
              Contact
            </h3>
            <ul className="mt-6 space-y-3 text-[13px]">
              <li>
                <a
                  href={`mailto:${company.email}`}
                  className="link-underline break-all text-mist hover:text-chalk"
                >
                  {company.email}
                </a>
              </li>
              {company.phones.map((p) => (
                <li key={p}>
                  <a
                    href={`tel:${p.replace(/\s/g, "")}`}
                    className="link-underline text-mist hover:text-chalk"
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-8 text-[11px] text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} Vikram Engineering Co. · GSTIN
            03ANIPS5337H1ZW
          </p>
          <p>Photographs are representative stock images.</p>
        </div>
      </Container>
    </footer>
  );
}
