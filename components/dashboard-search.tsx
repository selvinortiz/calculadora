"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { DocumentTextIcon, MagnifyingGlassIcon, UserIcon } from "@heroicons/react/24/outline";
import styles from "./dashboard-search.module.css";

export type DashboardSearchItem = {
  href: string;
  kind: "customer" | "loan";
  title: string;
  subtitle: string;
  searchText: string;
};

export function DashboardSearch({ items }: { items: DashboardSearchItem[] }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const matches = useMemo(() => {
    const needle = normalize(query);
    if (!needle) return [];
    return items.filter((item) => normalize(item.searchText).includes(needle)).slice(0, 6);
  }, [items, query]);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    function closeSearch(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setQuery("");
    }
    window.addEventListener("keydown", focusSearch);
    document.addEventListener("mousedown", closeSearch);
    return () => {
      window.removeEventListener("keydown", focusSearch);
      document.removeEventListener("mousedown", closeSearch);
    };
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (matches[activeIndex]) router.push(matches[activeIndex].href);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && matches.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % matches.length);
    } else if (event.key === "ArrowUp" && matches.length > 0) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + matches.length) % matches.length);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
    }
  }

  return <div className={styles.searchArea} ref={rootRef}>
    <form className={styles.search} role="search" onSubmit={submit}>
      <MagnifyingGlassIcon aria-hidden="true" />
      <label className={styles.srOnly} htmlFor="dashboard-search">Buscar</label>
      <input ref={inputRef} id="dashboard-search" role="combobox" aria-autocomplete="list" aria-expanded={Boolean(query.trim())} aria-controls="dashboard-search-results" aria-activedescendant={matches[activeIndex] ? `dashboard-search-option-${activeIndex}` : undefined} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={handleKeyDown} placeholder="Buscar cliente, lote o documento…" autoComplete="off" />
      <kbd>⌘ K</kbd>
    </form>
    {query.trim() && <div className={styles.results} id="dashboard-search-results" role="listbox" aria-label="Resultados de búsqueda" aria-live="polite">
      {matches.length > 0 ? matches.map((item, index) => <Link id={`dashboard-search-option-${index}`} role="option" aria-selected={index === activeIndex} href={item.href} key={`${item.kind}-${item.href}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => setQuery("")}>
        <span className={styles.resultIcon} aria-hidden="true">{item.kind === "customer" ? <UserIcon /> : <DocumentTextIcon />}</span>
        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      </Link>) : <p>No encontramos coincidencias.</p>}
    </div>}
  </div>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-GT");
}
