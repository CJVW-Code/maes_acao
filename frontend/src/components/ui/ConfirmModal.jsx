import React from "react";
import { useConfirm } from "../../contexts/ConfirmContext";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle } from "lucide-react";

export const ConfirmModal = () => {
  const { confirmState, handleClose } = useConfirm();

  return (
    <AnimatePresence>
      {confirmState.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
          {/* Backdrop Escuro */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => handleClose(false)}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-surface border border-primary/30 p-6 rounded-2xl shadow-2xl max-w-md w-full space-y-4"
          >
            <div className="flex items-center gap-3 text-error">
              <div className="bg-error/20 p-3 rounded-full">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-bold text-error">
                {confirmState.title}
              </h3>
            </div>

            <p className="text-muted text-base leading-relaxed">
              {confirmState.message}
            </p>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleClose(false)}
                className="btn btn-ghost flex-1 border border-soft hover:bg-error/5"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleClose(true)}
                className="btn btn-primary flex-1 bg-primary hover:bg-error"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
