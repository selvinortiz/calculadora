"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
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
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (matches[0]) router.push(matches[0].href);
  }

  return <div className={styles.searchArea}>
    <form className={styles.search} role="search" onSubmit={submit}>
      <MagnifyingGlassIcon aria-hidden="true" />
      <label className={styles.srOnly} htmlFor="dashboard-search">Buscar</label>
      <input ref={inputRef} id="dashboard-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente, lote o documento…" autoComplete="off" />
      <kbd>⌘ K</kbd>
    </form>
    {query.trim() && <div className={styles.results} aria-live="polite">
      {matches.length > 0 ? matches.map((item) => <Link href={item.href} key={`${item.kind}-${item.href}`}>
        <span className={styles.resultIcon} aria-hidden="true">{item.kind === "customer" ? <UserIcon /> : <DocumentTextIcon />}</span>
        <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
      </Link>) : <p>No encontramos coincidencias.</p>}
    </div>}
  </div>;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-GT");
}
