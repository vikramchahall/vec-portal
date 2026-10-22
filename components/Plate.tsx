"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import Link from "next/link";

/**
 * A hovering plate. Lifts on hover, tilts very slightly toward the cursor,
 * and carries a glare that follows the pointer.
 *
 * The tilt is deliberately small (max ~4deg). Anything stronger reads as a
 * gimmick and makes text hard to read mid-movement. Pointer tracking is
 * skipped entirely on coarse pointers and when reduced motion is requested.
 */
export default function Plate({
  children,
  href,
  className = "",
  tilt = true,
}: {
  children: ReactNode;
  href?: string;
  className?: string;
  tilt?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    ) {
      return;
    }

    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;

    el.style.setProperty("--mx", `${px * 100}%`);
    el.style.setProperty("--my", `${py * 100}%`);

    if (tilt) {
      const rx = (0.5 - py) * 8;
      const ry = (px - 0.5) * 8;
      el.style.transform = `translateY(-8px) perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };

  const classes = `plate ticks overflow-hidden border border-line bg-surface ${className}`;

  if (href) {
    return (
      <Link
        href={href}
        ref={ref as React.Ref<HTMLAnchorElement>}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className={`block ${classes}`}
      >
        {children}
      </Link>
    );
  }

  return (
    <article
      ref={ref as React.Ref<HTMLElement>}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={classes}
    >
      {children}
    </article>
  );
}
