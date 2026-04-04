import { useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const saved = window.localStorage.getItem("theme");
  return saved === "dark" || saved === "light" ? (saved as Theme) : null;
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  // Sempre seta um valor explícito para ignorar prefers-color-scheme
  root.setAttribute("data-theme", theme);
  // Opcional: informa ao navegador para pintar scrollbars condizentes
  try {
    (root as HTMLElement).style.colorScheme = theme;
  } catch {}
}

export function useTheme() {
  const initial = useMemo<Theme>(() => {
    const stored = readStoredTheme();
    if (stored) return stored;
    return getSystemPrefersDark() ? "dark" : "light";
  }, []);

  const [theme, setTheme] = useState<Theme>(initial);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem("theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, setTheme, toggleTheme };
}
