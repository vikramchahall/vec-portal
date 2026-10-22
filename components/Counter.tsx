"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` when it first scrolls into view.
 *
 * The final value is rendered immediately on the server and restored if the
 * observer never fires, so the real number is never hidden behind an
 * animation that failed to run.
 */
export default function Counter({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let started = false;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting || started) return;
        started = true;
        observer.disconnect();

        const duration = 1300;
        const start = performance.now();

        const step = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          // easeOutExpo
          const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
          setDisplay(Math.round(eased * value));
          if (t < 1) frame = requestAnimationFrame(step);
        };

        setDisplay(0);
        frame = requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      setDisplay(value);
    };
  }, [value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}
