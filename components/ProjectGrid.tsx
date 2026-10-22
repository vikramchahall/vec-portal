"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { imgSrc, img } from "@/lib/images";
import type { Project } from "@/lib/content";
import Plate from "@/components/Plate";
import Carousel from "@/components/Carousel";

/**
 * Projects. The rail and its "View all" toggle come from <Carousel>; this
 * component supplies the cards and owns the detail panel.
 *
 * Each card's photograph is a button: clicking it opens the full detail
 * for that project instead of navigating away.
 */
export default function ProjectGrid({ projects }: { projects: Project[] }) {
  const [openRef, setOpenRef] = useState<string | null>(null);
  const selected = projects.find((p) => p.ref === openRef) ?? null;

  // Escape closes; the page behind must not scroll while the panel is open.
  useEffect(() => {
    if (!selected) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenRef(null);
    };

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [selected]);

  const card = (p: Project) => (
    <Plate className="h-full">
      <button
        type="button"
        onClick={() => setOpenRef(p.ref)}
        className="block w-full cursor-pointer text-left"
        aria-label={`More details: ${p.title}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-raised">
          <Image
            src={imgSrc(p.image)}
            alt={img(p.image).alt}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-brand/10 mix-blend-multiply" />
          {p.ongoing ? (
            <span className="absolute left-3 top-3 bg-accent px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white">
              Ongoing
            </span>
          ) : null}
          <span className="absolute bottom-3 right-3 bg-white/90 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-brand">
            Details +
          </span>
        </div>

        <div className="p-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-accent">
            {p.client.split(" — ")[0]}
          </p>
          <h3 className="mt-3 font-display text-base leading-snug text-chalk">
            {p.title}
          </h3>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-faint">
            {p.city} · {p.period}
          </p>
        </div>
      </button>
    </Plate>
  );

  return (
    <>
      <Carousel label="Projects">
        {projects.map((p) => (
          <div key={p.ref} className="h-full">
            {card(p)}
          </div>
        ))}
      </Carousel>

      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selected.title}
          className="fixed inset-0 z-[150] flex items-end justify-center bg-chalk/40 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setOpenRef(null)}
        >
          <div
            className="max-h-[88vh] w-full max-w-3xl overflow-y-auto border border-line bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-[21/9] bg-raised">
              <Image
                src={imgSrc(selected.image)}
                alt={img(selected.image).alt}
                fill
                sizes="768px"
                className="object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-brand/10 mix-blend-multiply" />
              <button
                type="button"
                onClick={() => setOpenRef(null)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center bg-white/90 text-lg leading-none text-chalk transition-colors hover:bg-accent hover:text-white"
              >
                ×
              </button>
              {img(selected.image).isStock ? (
                <span className="pointer-events-none absolute bottom-2 right-2 bg-white/75 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-chalk/50">
                  Representative
                </span>
              ) : null}
            </div>

            <div className="p-8 sm:p-10">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                {selected.ongoing ? "Ongoing" : "Completed"}
              </p>
              <h3 className="mt-4 font-display text-2xl leading-tight text-chalk sm:text-3xl">
                {selected.title}
              </h3>

              <dl className="mt-7 grid gap-5 border-y border-line py-6 sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-faint">
                    Client
                  </dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-chalk">
                    {selected.client}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-faint">
                    Location
                  </dt>
                  <dd className="mt-2 text-[13px] text-chalk">
                    {selected.city}, {selected.state}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.2em] text-faint">
                    Period
                  </dt>
                  <dd className="mt-2 text-[13px] text-chalk">{selected.period}</dd>
                </div>
              </dl>

              <p className="mt-7 text-[15px] leading-relaxed text-mist">
                {selected.description}
              </p>

              <a
                href="#contact"
                onClick={() => setOpenRef(null)}
                className="group relative mt-9 inline-flex items-center gap-3 overflow-hidden bg-accent px-7 py-3.5 text-sm font-medium text-white"
              >
                <span className="absolute inset-0 -translate-x-full bg-brand transition-transform duration-500 ease-out group-hover:translate-x-0" />
                <span className="relative z-10">Ask about work like this</span>
                <span className="relative z-10" aria-hidden>→</span>
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
