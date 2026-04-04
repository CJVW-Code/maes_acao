import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/useTheme";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      type="button"
      className="p-2 rounded-lg bg-surface border border-soft hover:border-primary/50 transition-colors shadow-sm flex items-center justify-center overflow-hidden"
      onClick={toggleTheme}
      aria-pressed={isDark}
      title={isDark ? "Alternar para tema claro" : "Alternar para tema escuro"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "dark" : "light"}
          initial={{ y: 20, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: -20, rotate: 90, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}

