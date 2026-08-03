"use client";

import { useEffect } from "react";

type PwaRegisterProps = {
  version: string;
};

// Register the offline worker against the current deployment version. A new
// Vercel commit therefore produces a new worker URL, and an already-installed
// PWA reloads once when that worker takes control instead of continuing to run
// an older JavaScript/CSS bundle indefinitely.
export function PwaRegister({ version }: PwaRegisterProps) {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let reloadStarted = false;
    const hadController = Boolean(navigator.serviceWorker.controller);

    const reloadForNewWorker = () => {
      if (!hadController || reloadStarted || disposed) return;
      reloadStarted = true;
      window.location.reload();
    };

    const activateWaitingWorker = () => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
    };

    const watchInstallingWorker = () => {
      const worker = registration?.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") activateWaitingWorker();
      });
    };

    const updateRegistration = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {
          /* update checks are best-effort */
        });
      }
    };

    const register = async () => {
      try {
        const workerUrl = `/sw.js?v=${encodeURIComponent(version)}`;
        registration = await navigator.serviceWorker.register(workerUrl, {
          updateViaCache: "none",
        });

        registration.addEventListener("updatefound", watchInstallingWorker);
        activateWaitingWorker();
        await registration.update();
      } catch {
        /* registration is best-effort; the online app still works */
      }
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      reloadForNewWorker,
    );
    document.addEventListener("visibilitychange", updateRegistration);
    window.addEventListener("focus", updateRegistration);

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      disposed = true;
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        reloadForNewWorker,
      );
      document.removeEventListener("visibilitychange", updateRegistration);
      window.removeEventListener("focus", updateRegistration);
      window.removeEventListener("load", register);
      registration?.removeEventListener("updatefound", watchInstallingWorker);
    };
  }, [version]);

  return null;
}
