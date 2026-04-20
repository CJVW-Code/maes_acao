import crypto from "crypto";
import bcrypt from "bcrypt";

/**
 * Gera apenas o Protocolo do caso.
 * A Chave de Acesso foi removida conforme solicitação.
 */
export const generateCredentials = (casoTipo) => {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = (now.getMonth() + 1).toString().padStart(2, "0");
  const dia = now.getDate().toString().padStart(2, "0");

  const idCasoMap = {
    familia: "0",
    consumidor: "1",
    saude: "2",
    criminal: "3",
    outro: "4",
  };
  const idCaso = idCasoMap[casoTipo] || "4";

  const numeroUnico = Date.now().toString().slice(-6);
  const protocolo = `${ano}${mes}${dia}${idCaso}${numeroUnico}`;

  return { protocolo };
};

export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

