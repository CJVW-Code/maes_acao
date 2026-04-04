import React from "react";
import { useToast } from "../../contexts/ToastContext";
import {
  X,
  CheckCircle,
  AlertTriangle,
  Info,
  AlertOctagon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const icons = {
  success: <CheckCircle size={20} />,
  error: <AlertOctagon size={20} />,
  warning: <AlertTriangle size={20} />,
  info: <Info size={20} />,
};

const styles = {
  success: "bg-green-500/10 border-green-500/30 text-green-900",
  error: "bg-red-500/10 border-red-500/30 text-red-400",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  info: "bg-blue-500/10 border-blue-500/30 text-blue-400",
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            layout
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-lg min-w-[300px] max-w-md ${
              styles[t.type] || styles.info
            }`}
          >
            <div className="shrink-0">{icons[t.type]}</div>
            <p className="text-sm font-medium flex-1 text-black/90">
              {t.message}
            </p>
            <button
              onClick={() => removeToast(t.id)}
              className="p-1 hover:bg-white/10 rounded-full transition-colors text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
