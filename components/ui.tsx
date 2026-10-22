import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { img, imgSrc } from "@/lib/images";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-6 lg:px-10 ${className}`}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`relative py-24 sm:py-32 ${className}`}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
      <span className="h-px w-8 bg-accent" />
      {children}
    </p>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  center = false,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  center?: boolean;
}) {
  return (
    <div
      className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}
      data-reveal
    >
      {eyebrow ? (
        <div className={center ? "flex justify-center" : ""}>
          <Eyebrow>{eyebrow}</Eyebrow>
        </div>
      ) : null}
      <h2 className="mt-5 font-display text-3xl leading-[1.1] text-chalk sm:text-5xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-5 text-[15px] leading-relaxed text-mist">{lead}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo — stock images stay marked as stock                           */
/* ------------------------------------------------------------------ */

export function Photo({
  slug,
  className = "",
  sizes = "(max-width: 768px) 100vw, 50vw",
  priority = false,
  mark = true,
}: {
  slug: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  mark?: boolean;
}) {
  const meta = img(slug);
  return (
    <div className={`relative overflow-hidden bg-raised ${className}`}>
      <Image
        src={imgSrc(slug)}
        alt={meta.alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
      {/* Light blue wash keeps every photograph inside the logo palette. */}
      <div className="pointer-events-none absolute inset-0 bg-brand/10 mix-blend-multiply" />
      {meta.isStock && mark ? (
        <span className="pointer-events-none absolute bottom-2 right-2 bg-white/75 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-chalk/50">
          Representative
        </span>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

export function Button({
  href,
  children,
  variant = "solid",
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "outline";
}) {
  const base =
    "group relative inline-flex items-center gap-3 overflow-hidden px-8 py-4 text-sm font-medium tracking-wide transition-colors duration-300";

  if (variant === "solid") {
    return (
      <Link href={href} className={`${base} bg-accent text-white`}>
        <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
        <span className="relative z-10">{children}</span>
        <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
          →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`${base} border border-line-strong text-chalk hover:border-accent`}
    >
      <span className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-500 ease-out group-hover:translate-x-0" />
      <span className="relative z-10">{children}</span>
      <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">
        →
      </span>
    </Link>
  );
}
