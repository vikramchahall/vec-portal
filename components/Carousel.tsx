"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Horizontal card rail with a "View all" toggle.
 *
 * Collapsed: three cards at a time on desktop, two on tablet, one on phone,
 * with arrows over the left and right edges of the rail. Expanded: the same
 * cards as a plain grid.
 *
 * The arrows are centred on the card IMAGE rather than the whole card — the
 * text block under it makes the true centre sit awkwardly low. The image
 * height is measured, not guessed, so it holds at every breakpoint.
 *
 * Built on a real scroll container, so touch swipe and trackpad work
 * natively and it degrades to a scrollable row without JS.
 */
export default function Carousel({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const anim = useRef<number | null>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [mediaCentre, setMediaCentre] = useState(120);

  const items = Children.toArray(children);
  const count = items.length;
  const scrollable = count > 3;

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    // 2px of slack: sub-pixel scroll widths never report exactly "at end".
    setAtStart(el.scrollLeft <= 2);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
  }, []);

  // Measure the first card's image so the arrows line up with it.
  useEffect(() => {
    const el = rail.current;
    if (!el) return;

    const measure = () => {
      const media = el.querySelector("img")?.parentElement;
      if (media instanceof HTMLElement && media.offsetHeight > 0) {
        setMediaCentre(media.offsetHeight / 2);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showAll]);

  useEffect(() => {
    sync();
    const el = rail.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      el.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [sync, showAll]);

  useEffect(
    () => () => {
      if (anim.current) cancelAnimationFrame(anim.current);
    },
    [],
  );

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;

    if (anim.current) cancelAnimationFrame(anim.current);

    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + 20 : el.clientWidth * 0.8;
    const max = el.scrollWidth - el.clientWidth;
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(max, from + step * dir));

    if (Math.abs(to - from) < 1) return;

    // Native `behavior: "smooth"` is silently ignored on this container in
    // some browsers (an `auto` scroll to the same value works), so the
    // easing runs here. Reduced motion jumps straight there.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = to;
      return;
    }

    const distance = to - from;
    const duration = 620;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeInOutCubic — eases in and out, so no jolt at either end.
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      el.scrollLeft = from + distance * eased;
      anim.current = t < 1 ? requestAnimationFrame(tick) : null;
    };

    anim.current = requestAnimationFrame(tick);
  };

  // Square, not round — the round buttons sat oddly against a site built
  // out of diamonds and right angles.
  const arrow =
    "absolute z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-line bg-white/95 text-lg text-chalk shadow-[0_6px_20px_-8px_rgba(10,21,64,0.45)] backdrop-blur-sm transition-all duration-300 hover:border-accent hover:bg-accent hover:text-white disabled:pointer-events-none disabled:opacity-0";

  return (
    <div>
      {scrollable ? (
        <div className="mb-7 flex justify-end">
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="border border-line px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-chalk transition-all duration-300 hover:border-accent hover:bg-accent hover:text-white"
          >
            {showAll ? "Show fewer" : `View all ${count}`}
          </button>
        </div>
      ) : null}

      {showAll ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((child, i) => (
            <div key={i}>{child}</div>
          ))}
        </div>
      ) : (
        <div className="relative">
          <div
            ref={rail}
            role="region"
            aria-label={label}
            className="rail -mx-6 flex gap-5 overflow-x-auto px-6 pb-2 lg:-mx-2 lg:px-2"
          >
            {items.map((child, i) => (
              <div
                key={i}
                className="w-[86%] shrink-0 snap-start sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
              >
                {child}
              </div>
            ))}
          </div>

          {scrollable ? (
            <>
              <button
                type="button"
                onClick={() => nudge(-1)}
                disabled={atStart}
                aria-label="Previous"
                style={{ top: mediaCentre }}
                className={`${arrow} left-0 lg:-left-5`}
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => nudge(1)}
                disabled={atEnd}
                aria-label="Next"
                style={{ top: mediaCentre }}
                className={`${arrow} right-0 lg:-right-5`}
              >
                →
              </button>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
