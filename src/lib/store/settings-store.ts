import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  caixa: string;
  nfceSerie: number;
  nfeSerie: number;
  nfeAmbiente: "homologacao" | "producao";
  margemPadrao: number;
  setSettings: (partial: Partial<SettingsState>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      caixa: "Caixa 01",
      nfceSerie: 1,
      nfeSerie: 1,
      nfeAmbiente: "homologacao",
      margemPadrao: 0.3,
      setSettings: (partial) => set(partial),
    }),
    { name: "erp-settings" }
  )
);

export function useSettings() {
  return useSettingsStore();
}