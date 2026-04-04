import crypto from "crypto";
import bcrypt from "bcrypt";
// Adicione 'export' aqui
export const generateCredentials = (casoTipo) => {
  const randomPart1 = crypto.randomBytes(3).readUIntBE(0, 3) % 100000;
  const randomPart2 = crypto.randomBytes(3).readUIntBE(0, 3) % 100000;
  const chaveAcesso = `DPB-${randomPart1
    .toString()
    .padStart(5, "0")}-0${randomPart2.toString().padStart(5, "0")}`;

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

// E adicione 'export' aqui também
export const hashKeyWithSalt = (key) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(key + salt)
    .digest("hex");
  return `${salt}:${hash}`;
};
export const verifyKey = (key, storedHash) => {
  // O storedHash está no formato "salt:hash"
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) {
    return false;
  }
  // Recria o hash usando a chave fornecida e o salt do banco
  const computedHash = crypto
    .createHash("sha256")
    .update(key + salt)
    .digest("hex");
  // Compara se o hash recriado é igual ao hash que estava no banco
  return hash === computedHash;
};
export const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
