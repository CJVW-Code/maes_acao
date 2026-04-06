import logger from "../utils/logger.js";
import { processarCasoEmBackground } from "./casosController.js";
import { supabase } from "../config/supabase.js";

export const processJob = async (req, res) => {
  try {
    // Sanitização de logs para evitar vazamento de PII (LGPD)
    const isBodyObject = req.body !== null && typeof req.body === "object";
    const logBody = isBodyObject ? { ...req.body } : { bodyType: typeof req.body };

    if (logBody.dados_formulario) logBody.dados_formulario = "[REDACTED - PII]";
    if (logBody.urls_documentos)
      logBody.urls_documentos = `[${logBody.urls_documentos?.length || 0} files]`;

    // Redação de cabeçalhos sensíveis
    const logHeaders = { ...req.headers };
    if (logHeaders.authorization) logHeaders.authorization = "[REDACTED]";
    if (logHeaders.cookie) logHeaders.cookie = "[REDACTED]";
    if (logHeaders["x-api-key"]) logHeaders["x-api-key"] = "[REDACTED]";

    logger.info("📩 Job recebido do QStash:", {
      body: logBody,
      headers: logHeaders,
    });

    // Validação do payload
    if (!isBodyObject || !req.body?.protocolo) {
      logger.warn(
        "⚠️ Payload inválido: corpo da requisição não é um objeto ou protocolo está ausente",
        { body: logBody },
      );
      return res.status(400).json({
        error:
          "Payload inválido: o corpo da requisição deve ser um objeto JSON com a propriedade 'protocolo'.",
        success: false,
      });
    }

    const { protocolo } = req.body;

    // Verificar se o caso existe no banco de dados
    const { data: caso, error: fetchError } = await supabase
      .from("casos")
      .select("*")
      .eq("protocolo", protocolo)
      .single();

    if (fetchError || !caso) {
      logger.warn(`⚠️ Caso não encontrado: ${protocolo}`);
      return res.status(404).json({
        error: "Caso não encontrado",
        protocolo,
        success: false,
      });
    }

    // Verificar status atual do caso
    if (caso.status === "pronto_para_analise") {
      logger.info(`✅ Caso já processado: ${protocolo}`);
      return res.status(200).json({
        message: "Caso já processado",
        protocolo,
        status: caso.status,
        success: true,
      });
    }

    if (caso.status === "processando_ia") {
      logger.info(`⏳ Caso já em processamento: ${protocolo}`);
      return res.status(200).json({
        message: "Caso já em processamento",
        protocolo,
        status: caso.status,
        success: true,
      });
    }

    // Atualizar status para processando_ia
    await supabase
      .from("casos")
      .update({
        status: "processando_ia",
        processing_started_at: new Date(),
      })
      .eq("protocolo", protocolo);

    logger.info(
      `🔄 Iniciando processamento do caso ${protocolo} via QStash (Background)`,
    );

    // Responde IMEDIATAMENTE ao QStash para evitar timeout (Erro 500)
    res.status(200).json({
      message: "Job recebido. Processamento iniciado em background.",
      protocolo,
      success: true,
    });

    // Executa o processamento pesado sem bloquear a resposta HTTP
    setImmediate(async () => {
      const startTime = Date.now();
      logger.info(
        `🚀 [Background] Iniciando processamento pesado para o caso ${protocolo}...`,
      );
      try {
        await processarCasoEmBackground(
          protocolo,
          caso.dados_formulario,
          caso.urls_documentos || [],
          caso.url_audio,
          caso.url_peticao,
        );
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.info(
          `✅ [Background] Processamento concluído com sucesso para ${protocolo} em ${duration}s`,
        );
      } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.error(
          `❌ [Background] Erro crítico após ${duration}s no caso ${protocolo}: ${err.message}`,
        );
      }
    });
  } catch (error) {
    logger.error(`❌ Erro ao processar job QStash: ${error.message}`, {
      stack: error.stack,
      body: req.body,
    });

    // Tentar atualizar o status para erro se o caso existir
    if (req.body?.protocolo) {
      try {
        await supabase
          .from("casos")
          .update({
            status: "erro_processamento",
            erro_processamento: error.message,
          })
          .eq("protocolo", req.body.protocolo);
      } catch (updateError) {
        logger.error(
          `❌ Falha ao atualizar status de erro: ${updateError.message}`,
        );
      }
    }

    res.status(500).json({
      error: "Erro ao processar job",
      details: error.message,
      success: false,
    });
  }
};
