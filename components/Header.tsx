"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { navigation } from "@/lib/content";

// Website and portal are one site on the Lightsail server.
const PORTAL_LOGIN = "/login";

/**
 * Single-page navigation. Every item is an in-page anchor, so a click is a
 * scroll rather than a page load — there is no route to compile or fetch,
 * which is what made the old tabs feel slow.
 *
 * The active item is whichever section has most recently passed under the
 * header.
 */
export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("top");

  useEffect(() => {
    const ids = navigation.map((n) => n.href.replace("#", ""));

    const onScroll = () => {
      setScrolled(window.scrollY > 40);

      let current = "top";
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-full px-5 py-2.5 transition-all duration-500 ${
          scrolled || open
            ? "glass shadow-[0_10px_30px_-18px_rgba(10,21,64,0.4)]"
            : "border border-transparent"
        }`}
      >
        <a href="#top" className="group flex items-center gap-3">
          <Image
            src="/mark.svg"
            alt=""
            width={32}
            height={32}
            priority
            className="shrink-0 transition-transform duration-500 group-hover:rotate-90"
          />
          <span className="font-display text-[15px] font-semibold leading-none text-chalk">
            Vikram Engineering Co.
          </span>
        </a>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {navigation.map((item) => {
            const isActive = active === item.href.replace("#", "");
            return (
              <a
                key={item.href}
                href={item.href}
                className={`relative rounded-full px-3.5 py-2 text-[13px] transition-colors duration-300 ${
                  isActive ? "text-chalk" : "text-mist hover:text-chalk"
                }`}
              >
                {isActive ? (
                  <span className="absolute inset-0 rounded-full border border-line bg-raised" />
                ) : null}
                <span className="relative">{item.label}</span>
              </a>
            );
          })}

          <Link
            href={PORTAL_LOGIN}
            className="group relative ml-3 overflow-hidden rounded-full border border-line-strong px-5 py-2.5 text-[13px] font-medium text-chalk"
          >
            <span className="absolute inset-0 -translate-x-full bg-accent transition-transform duration-500 ease-out group-hover:translate-x-0" />
            <span className="relative transition-colors duration-300 group-hover:text-white">
              Login
            </span>
          </Link>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="p-1 text-chalk lg:hidden"
        >
          <span
            className="block h-px w-6 bg-current transition-transform duration-300"
            style={{ transform: open ? "translateY(3.5px) rotate(45deg)" : undefined }}
          />
          <span
            className="mt-1.5 block h-px w-6 bg-current transition-transform duration-300"
            style={{ transform: open ? "translateY(-3.5px) rotate(-45deg)" : undefined }}
          />
        </button>
      </div>

      {open ? (
        <nav className="glass mx-auto mt-2 max-w-6xl rounded-2xl px-5 py-3 lg:hidden">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`block border-b border-line py-3.5 text-sm last:border-0 ${
                active === item.href.replace("#", "") ? "text-chalk" : "text-mist"
              }`}
            >
              {item.label}
            </a>
          ))}
          <Link
            href={PORTAL_LOGIN}
            onClick={() => setOpen(false)}
            className="mt-3 block bg-accent px-5 py-3 text-center text-sm font-medium text-white"
          >
            Login
          </Link>
        </nav>
      ) : null}
    </header>
  );
}
