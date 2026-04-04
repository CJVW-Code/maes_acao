import React, { createContext, useContext, useState, useCallback } from "react";

const ConfirmContext = createContext();

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context)
    throw new Error("useConfirm deve ser usado dentro de um ConfirmProvider");
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    message: "",
    title: "Confirmação",
    resolve: null,
  });

  const confirm = useCallback((message, title = "Tem certeza?") => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title,
        resolve,
      });
    });
  }, []);

  const handleClose = (result) => {
    if (confirmState.resolve) {
      confirmState.resolve(result);
    }
    setConfirmState((prev) => ({ ...prev, isOpen: false, resolve: null }));
  };

  return (
    <ConfirmContext.Provider value={{ confirm, confirmState, handleClose }}>
      {children}
    </ConfirmContext.Provider>
  );
};
