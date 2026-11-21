"use client";
/** Krátka hláška dole na obrazovke. Volaj odkiaľkoľvek z klienta. */
export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent("kuk:toast", { detail: msg }));
}
