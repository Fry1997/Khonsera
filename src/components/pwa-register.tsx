"use client";

import { useEffect } from "react";

// Registers the service worker (public/sw.js) once the page has loaded, so the
// app shell + last-known day are cached for no-signal use at the barrier. Inert
// where service workers aren't available (older browsers / non-secure contexts).
export function PwaRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works online regardless */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
