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
    // 2. Busca via Prisma para evitar erros de schema do Supabase legados
    const casos = await prisma.casos.findMany({
      where: {
        partes: { cpf_assistido: cpfLimpo }
      },
      select: {
        id: true,
        status: true,
        numero_processo: true,
        url_capa: true,
        protocolado_at: true,
        partes: {
          select: {
            nome_assistido: true,
            cpf_assistido: true
          }
        }
      }
    });

    if (!casos || casos.length === 0) {
      logger.warn(`Consulta falhou: CPF ${cpfLimpo} não encontrado.`);
      return res.status(404).json({ error: "CPF inválido ou sem casos vinculados." });
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

    // Mapeamento de status internos para os status públicos solicitados
    const statusPublicoMap = {
      aguardando_documentos: "documentos pendentes",
      documentacao_completa: "documentos entregues",
      processando_ia: "em triagem",
      pronto_para_analise: "em triagem",
      em_atendimento: "em triagem",
      liberado_para_protocolo: "em protocolo",
      em_protocolo: "em protocolo",
      protocolado: "finalizado",
      erro_processamento: "enviado",
    };

    const statusDescricaoMap = {
      aguardando_documentos: "Precisamos de documentos complementares. Verifique abaixo.",
      documentacao_completa: "Documentos recebidos. Aguarde nova análise.",
      processando_ia: "Estamos processando seus documentos.",
      pronto_para_analise: "Processamento concluído. Aguardando análise.",
      em_atendimento: "Estamos analisando suas informações. Por favor, aguarde.",
      liberado_para_protocolo: "Seu caso foi liberado para protocolo.",
      em_protocolo: "O defensor está realizando o protocolo do seu caso.",
      protocolado: "Caso finalizado no sistema Solar.",
      erro_processamento: "O caso foi submetido e está na fila para processamento.",
    };


    // 4. Se tudo estiver correto, retorna o status do caso ENCONTRADO
    // Mapeamos para as tags oficiais do dicionarioTags.js onde aplicável
    const partes = casoEncontrado.partes || {};

    res.status(200).json({
      id: casoEncontrado.id,
      status: statusPublicoMap[casoEncontrado.status] || "enviado",
      descricao:
        statusDescricaoMap[casoEncontrado.status] ||
        "Estamos analisando suas informações. Por favor, aguarde.",
      REPRESENTANTE_NOME: partes.nome_assistido, // Tag Oficial
      nome_representante: partes.nome_assistido, // Alias para o Front antigo
      nome_assistido: partes.nome_assistido,      // Compatibilidade
      numero_processo: casoEncontrado.numero_processo,
      url_capa: casoEncontrado.url_capa,
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

    const cpfLimpo = cpf.replace(/\D/g, "");
    logger.info(`Consultando casos para CPF: ${cpf} (Limpo: ${cpfLimpo})`);

    // Busca robusta: protocolo, partes (assistido/representante) ou IA tags
    const casosPrisma = await prisma.casos.findMany({
      where: {
        OR: [
          { protocolo: cpfLimpo },
          { protocolo: cpf },
          {
            partes: {
              OR: [
                { cpf_assistido: cpfLimpo },
                { cpf_assistido: cpf },
              ],
            },
          },
          {
            ia: {
              dados_extraidos: {
                path: ["representante_cpf"],
                equals: cpfLimpo,
              },
            },
          },
          {
            ia: {
              dados_extraidos: {
                path: ["representante_cpf"],
                equals: cpf,
              },
            },
          },
        ],
      },
      include: {
        partes: true,
        ia: true,
      },
      orderBy: { created_at: "desc" },
    });

    if (!casosPrisma || casosPrisma.length === 0) {
      logger.info(`Nenhum caso encontrado para CPF: ${cpfLimpo} ou ${cpf}`);
      return res.status(404).json({ error: "Nenhum caso encontrado para este CPF." });
    }

    casosFinal = casosPrisma;

    // Mapeamento de status
    const statusPublicoMap = {
      aguardando_documentos: "documentos pendentes",
      documentacao_completa: "documentos entregues",
      processando_ia: "em triagem",
      pronto_para_analise: "em triagem",
      em_atendimento: "em triagem",
      liberado_para_protocolo: "em protocolo",
      em_protocolo: "em protocolo",
      protocolado: "finalizado",
      erro_processamento: "erro",
    };

    const statusDescricaoMap = {
      aguardando_documentos: "Precisamos de documentos complementares.",
      documentacao_completa: "Documentos recebidos. Aguarde nova análise.",
      processando_ia: "Estamos processando seus documentos.",
      pronto_para_analise: "Processamento concluído. Aguardando análise.",
      em_atendimento: "Estamos analisando suas informações. Por favor, aguarde.",
      liberado_para_protocolo: "Seu caso foi liberado para protocolo.",
      em_protocolo: "O defensor está realizando o protocolo do seu caso.",
      protocolado: "Caso finalizado no sistema Solar.",
      erro_processamento: "Ocorreu um erro no processamento.",
    };

    const respostaCasos = casosFinal.map(caso => {
      const partes = caso.partes || {};
      const ia = caso.ia || {};
      const tags = ia.dados_extraidos || {};
      
      return {
        id: caso.id,
        status: statusPublicoMap[caso.status] || "enviado",
        descricao: statusDescricaoMap[caso.status] || "Estamos analisando suas informações.",
        REPRESENTANTE_NOME: partes.nome_assistido || tags.REPRESENTANTE_NOME,
        nome_representante: partes.nome_assistido || tags.REPRESENTANTE_NOME, // Alias
        nome_assistido: partes.nome_assistido,
        representante_cpf: partes.cpf_assistido || tags.representante_cpf,
        numero_processo: caso.numero_processo,
        descricao_pendencia: caso.descricao_pendencia,
        dados_representante: {
          REPRESENTANTE_NOME: tags.REPRESENTANTE_NOME || partes.nome_assistido,
          representante_cpf: tags.representante_cpf || partes.cpf_assistido,
          representante_rg: tags.representante_rg || partes.rg_assistido,
          requerente_endereco_residencial: tags.representante_endereco || partes.endereco_assistido,
          requerente_telefone: tags.representante_telefone || partes.telefone_assistido,
          requerente_email: tags.representante_email || partes.email_assistido,
          representante_estado_civil: tags.representante_estado_civil || partes.estado_civil,
          representante_ocupacao: tags.representante_ocupacao || partes.profissao,
          representante_nacionalidade: tags.nacionalidade || partes.nacionalidade,
          nome_mae_representante: tags.nome_mae_representante || partes.nome_mae_representante,
          nome_pai_representante: tags.nome_pai_representante || partes.nome_pai_representante,
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
