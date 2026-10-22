import Link from "next/link";
import { Container } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="relative">
      <div className="grid-field absolute inset-0 opacity-40" />
      <Container className="relative flex min-h-screen flex-col justify-center py-32">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
          404
        </p>
        <h1 className="mt-5 font-display text-4xl text-chalk sm:text-6xl">
          Nothing here.
        </h1>
        <p className="mt-5 max-w-sm text-[15px] text-mist">
          The page may have moved, or the link may be wrong.
        </p>
        <Link
          href="/"
          className="group relative mt-10 inline-flex w-fit items-center gap-3 overflow-hidden bg-accent px-8 py-4 text-sm font-medium text-white"
        >
          <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
          <span className="relative z-10">Back to home</span>
          <span className="relative z-10" aria-hidden>→</span>
        </Link>
      </Container>
    </div>
  );
}
