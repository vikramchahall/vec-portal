"use client";

import { Icon } from "./Icon";

/** Sidebar collapse and light / dark switch. The choice is remembered in this browser. */
export function CollapseButton() {
  return (
    <button className="collapse-btn" title="Collapse sidebar" type="button"
      onClick={() => {
        const s = document.querySelector(".vec-app .shell");
        if (!s) return;
        if (window.innerWidth <= 720) s.classList.toggle("mobile-nav");
        else s.classList.toggle("collapsed");
      }}>
      <Icon name="sidebar" />
    </button>
  );
}

export function ThemeButton() {
  return (
    <button className="icon-btn" title="Switch light / dark" type="button"
      onClick={() => {
        const el = document.getElementById("vec-app");
        if (!el) return;
        el.dataset.theme = el.dataset.theme === "dark" ? "light" : "dark";
        try { localStorage.setItem("vec-theme", el.dataset.theme); } catch {}
      }}>
      <Icon name="moon" />
    </button>
  );
}
