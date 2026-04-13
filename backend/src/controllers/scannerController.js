import { prisma } from "../config/prisma.js";
import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import logger from "../utils/logger.js";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { Client } from "@upstash/qstash";

/**
 * Controller focado em receber documentos do aplicativo de scanner
 * ou da recepção de forma rápida e segura.
 */
export const scannerUpload = async (req, res) => {
  const { protocolo } = req.body;

  if (!protocolo) {
    return res.status(400).json({ error: "Protocolo não fornecido." });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: "Nenhum arquivo enviado." });
  }

  try {
    // 1. Verifica se o caso existe
    const caso = await prisma.casos.findUnique({
      where: { protocolo },
      include: { ia: true, partes: true },
    });

    if (!caso) {
      return res
        .status(404)
        .json({ error: "Caso não encontrado para este protocolo." });
    }

    const urls_documentos = [];
    const documentosCriados = [];

    // 2. Processa os uploads
    for (const file of req.files) {
      const safeOriginalName = path.basename(file.originalname);
      const filePath = `${protocolo}/${Date.now()}_${safeOriginalName}`;

      if (isSupabaseConfigured) {
        const fileStream = fsSync.createReadStream(file.path);
        const { error: uploadError } = await supabase.storage
          .from("documentos")
          .upload(filePath, fileStream, {
            contentType: file.mimetype,
            duplex: "half",
          });

        if (uploadError) {
          logger.error(
            `[Scanner] Erro upload Supabase: ${uploadError.message}`,
          );
          throw uploadError;
        }
        urls_documentos.push(filePath);
      } else {
        const localDir = path.resolve("uploads", "documentos", protocolo);
        await fs.mkdir(localDir, { recursive: true });
        await fs.copyFile(file.path, path.join(localDir, file.filename));
        urls_documentos.push(filePath);
      }

      // 3. Registra na tabela de documentos
      const docRecord = await prisma.documentos.create({
        data: {
          caso_id: caso.id,
          storage_path: filePath,
          nome_original: safeOriginalName,
          tipo: "outro", // Pode ser refinado depois pela IA
          tamanho_bytes: BigInt(file.size),
        },
      });
      documentosCriados.push(docRecord);
    }

    // 4. Atualiza status se necessário
    if (caso.status === "aguardando_documentos") {
      await prisma.casos.update({
        where: { id: caso.id },
        data: { status: "documentacao_completa" },
      });
      logger.info(
        `[Scanner] Caso ${protocolo} atualizado para 'documentacao_completa'.`,
      );
    }

    // 5. Opcional: Disparar reprocessamento se o caso estiver pendente ou com erro
    const qstashToken = process.env.QSTASH_TOKEN;
    const apiBaseUrl = process.env.API_BASE_URL;

    if (
      qstashToken &&
      apiBaseUrl &&
      (caso.status === "aguardando_documentos" ||
        caso.status === "erro_processamento")
    ) {
      const qstashClient = new Client({ token: qstashToken });
      try {
        await qstashClient.publishJSON({
          url: `${apiBaseUrl.replace(/\/$/, "")}/api/jobs/process`,
          body: {
            protocolo,
            // Re-enviar dados se necessário para o pipeline
          },
        });
        logger.info(
          `[QStash] Job de reprocessamento enviado para ${protocolo}`,
        );
      } catch (qstashError) {
        logger.error(`[QStash] Erro ao disparar job: ${qstashError.message}`);
      }
    }

    res.status(200).json({
      message: "Documentos recebidos com sucesso!",
      protocolo,
      total: documentosCriados.length,
    });
  } catch (error) {
    logger.error(`[Scanner] Erro ao processar upload: ${error.message}`);
    res.status(500).json({ error: "Falha ao processar documentos." });
  } finally {
    // Limpeza de temporários
    if (req.files) {
      for (const file of req.files) {
        try {
          await fs.unlink(file.path);
        } catch (e) {}
      }
    }
  }
};
