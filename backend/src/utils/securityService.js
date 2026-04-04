import crypto from "crypto";

export const generateCredentials = (casoTipo) => {
  // Geração da Chave de Acesso: DPB-00000-0XXXXX
  const randomPart1 = crypto.randomBytes(3).readUIntBE(0, 3) % 100000;
  const randomPart2 = crypto.randomBytes(3).readUIntBE(0, 3) % 100000;
  const chaveAcesso = `DPB-${randomPart1
    .toString()
    .padStart(5, "0")}-0${randomPart2.toString().padStart(5, "0")}`;

  // Geração do Protocolo
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

  return { chaveAcesso, protocolo };
};

export const hashKeyWithSalt = (key) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(key + salt)
    .digest("hex");
  return `${salt}:${hash}`;
};
export const verifyKey = (key, storedHash);
