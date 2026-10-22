import Image from "next/image";
import Link from "next/link";
import { signOut } from "@/app/(auth)/login/actions";

export default function Shell({
  children,
  crumb,
}: {
  children: React.ReactNode;
  crumb?: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="flex items-center gap-3">
            <Image src="/mark.svg" alt="" width={30} height={30} />
            <span className="font-display text-[15px] font-semibold text-chalk">
              Vikram Engineering Co.
            </span>
          </Link>
          {crumb ? (
            <>
              <span className="text-faint">/</span>
              <Link
                href={crumb.href}
                className="link-underline text-[13px] text-mist hover:text-chalk"
              >
                {crumb.label}
              </Link>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/portal/inbox"
            className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-chalk"
          >
            Inbox
          </Link>
          <Link
            href="/"
            className="text-[11px] uppercase tracking-[0.14em] text-faint hover:text-chalk"
          >
            View website
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="border border-line px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-chalk transition-all duration-300 hover:border-accent hover:bg-accent hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {children}
    </div>
  );
}
