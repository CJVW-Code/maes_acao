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
        "id, status, numero_processo, url_capa, protocolado_at, casos_partes(nome_assistido)"
      )
      .eq("partes(cpf_assistido)", cpfLimpo);

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
    const partes = Array.isArray(casoEncontrado.casos_partes) ? casoEncontrado.casos_partes[0] : casoEncontrado.partes || {};

    res.status(200).json({
      id: casoEncontrado.id,
      status: statusPublicoMap[casoEncontrado.status] || "enviado",
      descricao:
        statusDescricaoMap[casoEncontrado.status] ||
        "Estamos analisando suas informações. Por favor, aguarde.",
      nome_assistido: partes.nome_assistido,
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

    if (isSupabaseConfigured) {
      // Usar a syntax OR do Supabase para buscar no cpf_assistido OU na coluna json dados_formulario->>representante_cpf
      const { data: casos, error } = await supabase
        .from("casos")
        .select(`
          id, status, numero_processo, url_capa, protocolado_at,
          casos_partes!inner(nome_assistido, nome_representante, cpf_assistido)
        `)
        .eq("casos_partes.cpf_assistido", cpfLimpo)
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
          partes: { cpf_assistido: cpfLimpo }
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
      // Trata array de ref do supabase (casos_partes é array por conta do FK genérico, mas é 1:1)
      const partes = Array.isArray(caso.casos_partes) ? caso.casos_partes[0] || {} : caso.casos_partes || caso.partes || {};
      const form = caso.dados_formulario || {};
      
      return {
        id: caso.id,
        status: statusPublicoMap[caso.status] || "enviado",
        descricao: statusDescricaoMap[caso.status] || "Estamos analisando suas informações.",
        nome_assistido: partes.nome_assistido,
        nome_representante: partes.nome_representante || null,
        numero_processo: caso.numero_processo,
        descricao_pendencia: caso.descricao_pendencia,
        dados_representante: {
          representanteNome: form.representanteNome || form.representante_nome || partes.nome_representante,
          representanteCpf: form.representanteCpf || form.representante_cpf || partes.cpf_representante,
          representanteDataNascimento: form.representanteDataNascimento || form.representante_data_nascimento || form.dataNascimentoRepresentante,
          representanteTelefone: form.representanteTelefone || form.representante_telefone || form.telefone_representante,
          representanteEmail: form.representanteEmail || form.representante_email || form.email_representante,
          representanteEnderecoResidencial: form.representanteEnderecoResidencial || form.representante_endereco_residencial || form.endereco_representante,
          representanteEnderecoProfissional: form.representanteEnderecoProfissional || form.representante_endereco_profissional,
          representanteEstadoCivil: form.representanteEstadoCivil || form.representante_estado_civil,
          representanteNacionalidade: form.representanteNacionalidade || form.representante_nacionalidade,
          representanteOcupacao: form.representanteOcupacao || form.representante_ocupacao || form.representante_profissao,
          representanteRgNumero: form.representanteRgNumero || form.representante_rg_numero || form.representante_rg,
          representanteRgOrgao: form.representanteRgOrgao || form.representante_rg_orgao,
          representanteNomeMae: form.representanteNomeMae || form.representante_nome_mae || form.nome_mae_representante || partes.nome_mae_representante,
          representanteNomePai: form.representanteNomePai || form.representante_nome_pai || form.nome_pai_representante || partes.nome_pai_representante,
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
