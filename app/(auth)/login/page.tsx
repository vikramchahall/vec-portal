import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Staff login",
  description: "Vikram Engineering Co. staff portal.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; e?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <div className="grid-field absolute inset-0 opacity-50" />

      <div className="relative w-full max-w-sm">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/mark.svg" alt="" width={36} height={36} priority />
          <span className="font-display text-[15px] font-semibold text-chalk">
            Vikram Engineering Co.
          </span>
        </Link>

        <h1 className="mt-10 font-display text-3xl text-chalk">Staff login</h1>
        <p className="mt-3 text-[13px] leading-relaxed text-mist">
          For office use. Accounts are created by the administrator — there is
          no public sign-up.
        </p>

        {params.e === "unconfigured" ? (
          <p className="mt-6 border-l-2 border-accent bg-accent/10 py-3 pl-4 text-[13px] text-accent-lit">
            The portal is not connected to Supabase yet.
          </p>
        ) : null}

        <div className="mt-8">
          <LoginForm next={params.next ?? "/portal"} />
        </div>

        <Link
          href="/"
          className="link-underline mt-10 inline-block text-[12px] text-faint hover:text-chalk"
        >
          ← Back to the website
        </Link>
      </div>
    </div>
  );
}
