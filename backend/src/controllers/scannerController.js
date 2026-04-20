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

    const { tipos: tiposRaw } = req.body;
    // Normaliza tipos para array, tratando caso de formulário com um único campo
    const tiposArray = Array.isArray(tiposRaw) ? tiposRaw : [tiposRaw];

    const urls_documentos = [];
    const documentosCriados = [];

    // 2. Processa os uploads
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const tipoArquivo = tiposArray[i] || "outro";
      
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

      // 3. Registra na tabela de documentos com o tipo correto
      const docRecord = await prisma.documentos.create({
        data: {
          caso_id: caso.id,
          storage_path: filePath,
          nome_original: safeOriginalName,
          tipo: tipoArquivo,
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

    // 5. Disparar reprocessamento se o caso estiver pendente ou com erro
    const qstashToken = process.env.QSTASH_TOKEN;
    const apiBaseUrl = process.env.API_BASE_URL;

    if (qstashToken && apiBaseUrl) {
      const qstashClient = new Client({ token: qstashToken });
      try {
        const jobUrl = `${apiBaseUrl.replace(/\/$/, "")}/api/jobs/process`;
        logger.info(`[QStash] Tentando disparar job para ${protocolo} em ${jobUrl}`);

        await qstashClient.publishJSON({
          url: jobUrl,
          body: { protocolo },
        });

        logger.info(`[QStash] ✅ Job de reprocessamento enviado com sucesso para ${protocolo}`);
      } catch (qstashError) {
        logger.error(`[QStash] ❌ Erro ao disparar job para ${protocolo}: ${qstashError.message}`);
      }
    } else {
      logger.warn(
        `[Scanner Fallback] QStash não configurado (Falta TOKEN ou URL). Disparando processamento local para ${protocolo}. URL: ${apiBaseUrl ? "OK" : "MISSING"}, Token: ${qstashToken ? "OK" : "MISSING"}`,
      );

      const { processarCasoEmBackground } = await import("./casosController.js");

      const dados_extraidos =
        typeof caso.ia?.dados_extraidos === "string"
          ? JSON.parse(caso.ia.dados_extraidos)
          : caso.ia?.dados_extraidos || {};

      setImmediate(async () => {
        try {
          await processarCasoEmBackground(protocolo, dados_extraidos, urls_documentos, null, null);
        } catch (e) {
          logger.error(`[Scanner Fallback Local] Erro fatal no processamento: ${e.message}`);
        }
      });
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
        } catch (e) {
          // Ignora erro na limpeza de temporários
        }

      }
    }
  }
};
