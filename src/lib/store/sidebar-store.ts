import { useSyncExternalStore } from "react";

const KEY_COLLAPSED = "erp.sidebar.collapsed";
const KEY_SECTIONS = "erp.sidebar.sections";

let collapsed = false;
let collapsedSections: Record<string, boolean> = {};

if (typeof window !== "undefined") {
  try {
    collapsed = localStorage.getItem(KEY_COLLAPSED) === "1";
  } catch {
    // localStorage indisponível (SSR/privado)
  }
  try {
    const raw = localStorage.getItem(KEY_SECTIONS);
    if (raw) collapsedSections = JSON.parse(raw);
  } catch {
    // JSON inválido
  }
}

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function toggleSidebar() {
  collapsed = !collapsed;
  try {
    localStorage.setItem(KEY_COLLAPSED, collapsed ? "1" : "0");
  } catch {
    // ignora
  }
  emit();
}

export function useSidebarCollapsed() {
  return useSyncExternalStore(
    subscribe,
    () => collapsed,
    () => false
  );
}

/** Alterna o estado de colapso de uma seção específica. */
export function toggleSection(label: string) {
  collapsedSections = { ...collapsedSections, [label]: !collapsedSections[label] };
  try {
    localStorage.setItem(KEY_SECTIONS, JSON.stringify(collapsedSections));
  } catch {
    // ignora
  }
  emit();
}

/** Expande uma seção (força aberta). */
export function expandSection(label: string) {
  if (!collapsedSections[label]) return;
  collapsedSections = { ...collapsedSections, [label]: false };
  try {
    localStorage.setItem(KEY_SECTIONS, JSON.stringify(collapsedSections));
  } catch {
    // ignora
  }
  emit();
}

/** Hook que retorna o estado de colapso de uma seção. */
export function useSectionCollapsed(label: string) {
  return useSyncExternalStore(
    subscribe,
    () => collapsedSections[label] ?? false,
    () => false
  );
}