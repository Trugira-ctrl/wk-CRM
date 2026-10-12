"use client";

import { useEffect } from "react";

/** Arms scroll reveals after hydration. Content is visible without JS. */
export function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const vh = window.innerHeight;
    els.forEach((el) => { if (el.getBoundingClientRect().top < vh * 0.95) el.classList.add("is-in"); });
    root.classList.add("waka-motion");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    els.forEach((el) => { if (!el.classList.contains("is-in")) io.observe(el); });
    const mo = new MutationObserver(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in)").forEach((el) => io.observe(el));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); root.classList.remove("waka-motion"); };
  }, []);
  return null;
}
