import express from "express";
import { processJob } from "../controllers/jobController.js";
import { Receiver } from "@upstash/qstash";
import logger from "../utils/logger.js";

const router = express.Router();

const qstashReceiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
});

const qstashVerifyMiddleware = async (req, res, next) => {
  try {
    const signature = req.headers["upstash-signature"];

    // 1. Verificamos se o server.js capturou o corpo bruto
    // Se isso for undefined, algo deu errado no server.js ou o corpo veio vazio
    if (!req.rawBody) {
      logger.warn("QStash: Corpo bruto (rawBody) não capturado.");
      return res.status(400).send("Empty or unparsed body");
    }

    // 2. Validamos a assinatura usando o rawBody EXATO que salvamos
    const isValid = await qstashReceiver.verify({
      signature,
      body: req.rawBody,
    });

    if (!isValid) {
      logger.warn("QStash: Assinatura inválida.");
      return res.status(401).send("Invalid signature");
    }

    // O req.body JÁ ESTÁ populado pelo express.json() do server.js
    // Não precisamos fazer JSON.parse aqui.
    next();
  } catch (error) {
    logger.error("Erro na verificação do QStash:", error);
    res.status(500).send("Internal Server Error");
  }
};

router.post("/process", qstashVerifyMiddleware, processJob);

export default router;
