"use client";

import { useEffect } from "react";

/**
 * Adds `.is-visible` to every [data-reveal] element as it scrolls into view.
 * One observer for the whole page, re-scanned on route change.
 *
 * The `js` class on <html> is what arms the CSS — without JS the content is
 * visible by default rather than stuck at opacity 0.
 */
export default function Reveal() {
  useEffect(() => {
    document.documentElement.classList.add("js");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const scan = () => {
      document
        .querySelectorAll("[data-reveal]:not(.is-visible)")
        .forEach((el) => observer.observe(el));
    };

    scan();
    const mutation = new MutationObserver(scan);
    mutation.observe(document.body, { childList: true, subtree: true });

    /**
     * Safety net. The animation is a nicety; the content is not. If the
     * observer never fires — an offscreen render, a print, a screenshot, a
     * browser that throttles callbacks — everything reveals anyway after a
     * short delay rather than staying permanently invisible.
     */
    const failsafe = window.setTimeout(() => {
      document
        .querySelectorAll("[data-reveal]:not(.is-visible)")
        .forEach((el) => el.classList.add("is-visible"));
    }, 2500);

    const revealAll = () =>
      document
        .querySelectorAll("[data-reveal]:not(.is-visible)")
        .forEach((el) => el.classList.add("is-visible"));

    window.addEventListener("beforeprint", revealAll);

    return () => {
      observer.disconnect();
      mutation.disconnect();
      window.clearTimeout(failsafe);
      window.removeEventListener("beforeprint", revealAll);
    };
  }, []);

  return null;
}
