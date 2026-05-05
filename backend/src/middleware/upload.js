import multer from "multer";
import fs from "fs";


// Garante que o diretório de uploads temporários exista
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

export const sanitizeFilename = (rawName = "arquivo") => {
  const toUtf8 = Buffer.from(rawName, "latin1").toString("utf8");
  const trimmed = toUtf8.trim() || "arquivo";
  const sanitized = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized || "arquivo";
};

// Configura o armazenamento temporário no disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Garante um nome de arquivo único, normalizado e sem caracteres inválidos
    const normalizedName = sanitizeFilename(file.originalname);
    cb(null, `${Date.now()}-${normalizedName}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
