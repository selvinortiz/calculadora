"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function ModalDialog({
  backdropClassName,
  busy = false,
  children,
  dialogClassName,
  labelledBy,
  onClose,
}: {
  backdropClassName: string;
  busy?: boolean;
  children: ReactNode;
  dialogClassName: string;
  labelledBy: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  const [previouslyFocused] = useState<HTMLElement | null>(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const root = dialog?.parentElement;
    if (!dialog || !root) return;

    const siblings = [...document.body.children].filter((element) => element !== root);
    const previousInert = siblings.map((element) => element.hasAttribute("inert"));
    siblings.forEach((element) => element.setAttribute("inert", ""));
    const focusable = getFocusable(dialog);
    (focusable[0] || dialog).focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const currentFocusable = getFocusable(dialog!);
      if (currentFocusable.length === 0) {
        event.preventDefault();
        dialog!.focus();
        return;
      }
      const first = currentFocusable[0];
      const last = currentFocusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      siblings.forEach((element, index) => {
        if (!previousInert[index]) element.removeAttribute("inert");
      });
      previouslyFocused?.focus();
    };
  }, [previouslyFocused]);

  return createPortal(
    <div
      className={backdropClassName}
      data-modal-root
      role="presentation"
      onMouseDown={(event) => {
        if (!busy && event.currentTarget === event.target) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}

function getFocusable(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute("hidden"));
}
