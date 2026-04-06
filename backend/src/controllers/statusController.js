import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import { prisma } from "../config/prisma.js";
import { verifyKey } from "../services/securityService.js";
import logger from "../utils/logger.js";

export const consultarStatus = async (req, res) => {
  // 1. Pega o CPF e a chave da URL (query parameters)
  const { cpf } = req.query;

  if (!cpf || !chave) {
    logger.warn(`Tentativa de consulta de caso sem credenciais completas.`);
    return res
      .status(400)
      .json({ error: "CPF é obrigatório para consulta." });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, "");

  logger.debug(`Consultando status para CPF: ${cpfLimpo}`);

  try {
    // 2. Busca no Supabase TODOS os casos com o CPF informado
    // REMOVIDO: .single() -> Agora aceitamos múltiplos resultados (array)
    const { data: casos, error } = await supabase
      .from("casos")
      .select(
        "id, status, nome_assistido, numero_processo, numero_solar, url_capa_processual, url_documento_gerado, agendamento_data, agendamento_link, agendamento_status, descricao_pendencia",
      )
      .eq("cpf_assistido", cpfLimpo);

    // Se der erro ou array vazio (nenhum caso encontrado)
    if (error || !casos || casos.length === 0) {
      logger.warn(
        `Consulta falhou: CPF ${cpfLimpo} não encontrado ou erro no banco.`,
      );
      return res
        .status(404)
        .json({ error: "CPF inválido." });
    }

    // 3. LÓGICA DE MULTI-CASOS: Itera sobre os casos para encontrar qual chave abre qual porta
    let casoEncontrado = null;
{/* //nao deve ser necessario pois nao tem mais a chave de acesso
    for (const caso of casos) {
      const valida = verifyKey(chave, caso.chave_acesso_hash);
      if (valida) {
        casoEncontrado = caso;
        break; // Achamos o caso correto, paramos de procurar
      }
    }
*/}

    // Se rodou todos os casos do CPF e nenhuma chave bateu
    if (!casoEncontrado) {
      logger.warn(
        `Consulta falhou: Chave inválida para todos os casos do CPF ${cpfLimpo}.`,
      );
      return res
        .status(401)
        .json({ error: "CPF ou chave de acesso inválidos." });
    }

    logger.info(
      `Status consultado com sucesso para CPF ${cpfLimpo}. Status: ${casoEncontrado.status}`,
    );

    // Mapeamento de status internos para os 4 status públicos solicitados
    const statusPublicoMap = {
      recebido: "enviado",
      processando: "em triagem",
      processado: "em triagem",
      em_analise: "em triagem",
      aguardando_docs: "documentos pendente",
      documentos_entregues: "documentos entregues",
      finalizado: "encaminhamento solar",
      erro: "enviado",
    };

    const statusDescricaoMap = {
      recebido: "O caso foi submetido e está na fila para processamento.",
      processando: "Estamos processando seus documentos.",
      processado: "Processamento concluído. Aguardando análise.",
      em_analise: "Estamos analisando suas informações. Por favor, aguarde.",
      aguardando_docs:
        "Precisamos de documentos complementares. Verifique abaixo.",
      documentos_entregues: "Documentos recebidos. Aguarde nova análise.",
      finalizado: "Caso concluído.",
      erro: "Ocorreu um erro no processamento.",
    };


    // 4. Se tudo estiver correto, retorna o status do caso ENCONTRADO
    res.status(200).json({
      id: casoEncontrado.id,
      status: statusPublicoMap[casoEncontrado.status] || "enviado",
      descricao:
        statusDescricaoMap[casoEncontrado.status] ||
        "Estamos analisando suas informações. Por favor, aguarde.",
      nome_assistido: casoEncontrado.nome_assistido,
      numero_processo: casoEncontrado.numero_processo,
      numero_solar: casoEncontrado.numero_solar,
      url_capa_processual: casoEncontrado.url_capa_processual,
      url_documento_gerado: casoEncontrado.url_documento_gerado,
      agendamento_data: casoEncontrado.agendamento_data,
      agendamento_data_formatada: agendamentoFormatado,
      agendamento_link: casoEncontrado.agendamento_link,
      agendamento_status: casoEncontrado.agendamento_status,
      descricao_pendencia: casoEncontrado.descricao_pendencia,
    });
  } catch (err) {
    logger.error(`Erro crítico ao consultar status: ${err.message}`, {
      stack: err.stack,
    });
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

export const consultarPorCpf = async (req, res) => {
  const { cpf } = req.params;

  if (!cpf) {
    logger.warn(`Tentativa de consulta por CPF sem CPF informado.`);
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, "");

  if (cpfLimpo.length !== 11) {
    return res.status(400).json({ error: "CPF inválido." });
  }

  logger.debug(`Consultando casos para CPF: ${cpfLimpo}`);

  try {
    // Buscar casos com join em casos_partes para obter nome_representante
    let casosFinal = [];

    if (isSupabaseConfigured) {
      // Usar a syntax OR do Supabase para buscar no cpf_assistido OU na coluna json dados_formulario->>representante_cpf
      const { data: casos, error } = await supabase
        .from("casos")
        .select(`
          id, status, nome_assistido, numero_processo, numero_solar, agendamento_data, descricao_pendencia, dados_formulario,
          casos_partes(nome_representante, inteiro_teor_representante)
        `)
        .or(`cpf_assistido.eq.${cpfLimpo},dados_formulario->>representante_cpf.eq.${cpfLimpo}`)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error(`Erro ao consultar casos via Supabase: ${error.message}`);
        return res.status(500).json({ error: "Erro interno do servidor." });
      }

      if (!casos || casos.length === 0) {
        logger.info(`Nenhum caso encontrado para CPF: ${cpfLimpo}`);
        return res.status(404).json({ error: "Nenhum caso encontrado para este CPF." });
      }

      casosFinal = casos;
    } else {
      const casosPrisma = await prisma.casos.findMany({
        where: {
          OR: [
            { partes: { cpf_assistido: cpfLimpo } },
            { dados_formulario: { path: ['representante_cpf'], equals: cpfLimpo } }
          ]
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          partes: true,
        },
      });

      if (!casosPrisma || casosPrisma.length === 0) {
        logger.info(`Nenhum caso encontrado para CPF: ${cpfLimpo}`);
        return res.status(404).json({ error: "Nenhum caso encontrado para este CPF." });
      }

      casosFinal = casosPrisma;
    }

    // Mapeamento de status
    const statusPublicoMap = {
      recebido: "enviado",
      processando: "em triagem",
      processado: "em triagem",
      em_analise: "em triagem",
      aguardando_docs: "documentos pendentes",
      documentos_entregues: "documentos entregues",
      finalizado: "encaminhado solar",
      erro: "erro",
    };

    const statusDescricaoMap = {
      recebido: "O caso foi submetido e está na fila para processamento.",
      processando: "Estamos processando seus documentos.",
      processado: "Processamento concluído. Aguardando análise.",
      em_analise: "Estamos analisando suas informações. Por favor, aguarde.",
      aguardando_docs: "Precisamos de documentos complementares.",
      documentos_entregues: "Documentos recebidos. Aguarde nova análise.",
      finalizado: "Caso concluído.",
      erro: "Ocorreu um erro no processamento.",
    };

    const respostaCasos = casosFinal.map(caso => {
      // Trata array de ref do supabase (casos_partes é array por conta do FK genérico, mas é 1:1)
      const partes = Array.isArray(caso.casos_partes) ? caso.casos_partes[0] || {} : caso.casos_partes || caso.partes || {};
      const form = caso.dados_formulario || {};
      
      return {
        id: caso.id,
        status: statusPublicoMap[caso.status] || "enviado",
        descricao: statusDescricaoMap[caso.status] || "Estamos analisando suas informações.",
        nome_assistido: caso.nome_assistido || partes.nome_assistido,
        nome_representante: form.representante_nome || partes.nome_representante || null,
        inteiro_teor_representante: partes.inteiro_teor_representante || null,
        numero_processo: caso.numero_processo,
        agendamento_data: caso.agendamento_data,
        descricao_pendencia: caso.descricao_pendencia,
        dados_representante: {
          representante_nome: form.representante_nome,
          representante_cpf: form.representante_cpf,
          representante_telefone: form.representante_telefone,
          representante_email: form.representante_email,
          representante_endereco_residencial: form.representante_endereco_residencial,
          representante_estado_civil: form.representante_estado_civil,
          representante_nacionalidade: form.representante_nacionalidade,
          representante_ocupacao: form.representante_ocupacao,
          representante_rg_numero: form.representante_rg_numero,
          representante_rg_orgao: form.representante_rg_orgao
        }
      };
    });

    logger.info(`Total de ${respostaCasos.length} caso(s) encontrado(s) para CPF ${cpfLimpo}`);

    res.status(200).json(respostaCasos);
  } catch (err) {
    logger.error(`Erro crítico ao consultar por CPF: ${err.message}`, {
      stack: err.stack,
    });
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};
