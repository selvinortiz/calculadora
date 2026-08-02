"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function NavigationFeedback() {
  const pathname = usePathname();
  const [pending, setPending] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPending(false));
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function beginNavigation(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;

      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname && destination.search === window.location.search) return;
      if (destination.hash && destination.pathname === window.location.pathname && destination.search === window.location.search) return;

      setPending(true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setPending(false), 45_000);
    }

    document.addEventListener("click", beginNavigation, true);
    return () => {
      document.removeEventListener("click", beginNavigation, true);
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="navigationFeedback" data-visible={pending} role="status" aria-live="polite" aria-atomic="true">
      <span aria-hidden="true" />
      {pending ? "Abriendo…" : ""}
    </div>
  );
}
