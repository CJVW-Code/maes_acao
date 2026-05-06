/* eslint-disable no-unused-vars */
// @ts-nocheck
import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import { prisma } from "../config/prisma.js";
import path from "path";
import { generateCredentials } from "../services/securityService.js";
import archiver from "archiver";

import fs from "fs/promises";
import fsSync from "fs";
import { extractTextFromImage } from "../services/documentService.js";
import { visionOCR } from "../services/aiService.js";
import { registrarLog } from "../services/loggerService.js";
import jwt from "jsonwebtoken";

/**
 * Função utilitária para converter recursivamente todos os BigInts em Strings.
 * Essencial para evitar o erro "Illegal constructor" no React 19/SWR ao lidar com dados complexos.
 */
const stringifyBigInts = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj; // Preserva datas para o JSON.stringify padrão
  if (typeof obj === "bigint") return obj.toString();
  if (Array.isArray(obj)) return obj.map(stringifyBigInts);
  if (typeof obj === "object") {
    const fresh = {};
    for (const key in obj) {
      fresh[key] = stringifyBigInts(obj[key]);
    }
    return fresh;
  }
  return obj;
};
import {
  generateDocx,
  generateTermoDeclaracao,
  generateMultiplosDocx,
} from "../services/documentGenerationService.js";
import { generateDosFatos } from "../services/geminiService.js";
import { getVaraByTipoAcao } from "../config/varasMapping.js";
import logger from "../utils/logger.js";
import { Client } from "@upstash/qstash";
import { TAGS_OFICIAIS } from "../config/dicionarioTags.js";
import { safeFormData } from "../utils/helpers.js";
import { validateTransition } from "../utils/stateMachine.js";
import { sanitizeFilename } from "../middleware/upload.js";

// Colunas físicas da tabela casos_ia que podem ser atualizadas diretamente
const DIRECT_COLUMN_KEYS = new Set(["url_peticao", "url_peticao_penhora", "url_peticao_prisao"]);

// --- UTILS DE NORMALIZAÇÃO ---
const mapCasoRelations = (caso) => {
  if (!caso) return caso;

  // Força ID como string para evitar problemas de BigInt no SWR/React 19
  if (caso.id && typeof caso.id !== "string") {
    caso.id = String(caso.id);
  }

  const resolveRel = (rel) => (Array.isArray(rel) ? rel[0] : rel);

  // Trata array de relações de forma segura (Resolve arrays aninhados do Supabase)
  const partes = resolveRel(caso.casos_partes || caso.partes);
  const ia = resolveRel(caso.casos_ia || caso.ia);
  const juridico = resolveRel(caso.casos_juridico || caso.juridico);

  const enriched = { ...caso };

  // Como `dados_formulario` foi descontinuado no Prisma, precisamos recuperar o formulário bruto da IA
  const parseIaDados = () => {
    if (ia?.dados_extraidos) {
      return typeof ia.dados_extraidos === "string"
        ? JSON.parse(ia.dados_extraidos)
        : ia.dados_extraidos;
    }
    return {};
  };

  const rawFormFallback =
    typeof caso.dados_formulario === "object" && caso.dados_formulario
      ? caso.dados_formulario
      : parseIaDados();
  const dadosFormulario = rawFormFallback || {};

  enriched.assistido_eh_incapaz =
    partes?.assistido_eh_incapaz || dadosFormulario.assistido_eh_incapaz || "não";

  if (partes) {
    enriched.nome_assistido = partes.nome_assistido;
    enriched.cpf_assistido = partes.cpf_assistido;
    enriched.telefone_assistido =
      partes.telefone_assistido ||
      dadosFormulario.telefone_assistido ||
      dadosFormulario.telefone ||
      "";
    enriched.email_assistido =
      partes.email_assistido || dadosFormulario.email_assistido || dadosFormulario.email || "";
    enriched.endereco_assistido =
      partes.endereco_assistido ||
      dadosFormulario.endereco_assistido ||
      dadosFormulario.requerente_endereco_residencial ||
      "";

    enriched.assistido_data_nascimento =
      partes.data_nascimento_assistido ||
      dadosFormulario.data_nascimento_assistido ||
      dadosFormulario.assistido_data_nascimento ||
      dadosFormulario.nascimento ||
      "";

    // Garante que o array de filhos e outros dados do formulário estejam na raiz para o gerador de documentos
    enriched.outros_filhos_detalhes =
      partes?.exequentes || dadosFormulario.outros_filhos_detalhes || [];
    enriched.dados_formulario = dadosFormulario;

    enriched.assistido_rg_numero = partes.rg_assistido;
    enriched.assistido_rg_orgao = partes.emissor_rg_assistido;
    enriched.assistido_nacionalidade =
      partes.nacionalidade || dadosFormulario.assistido_nacionalidade || "brasileiro(a)";
    enriched.assistido_estado_civil =
      partes.estado_civil || dadosFormulario.assistido_estado_civil || "solteiro(a)";
    enriched.assistido_ocupacao = partes.profissao || dadosFormulario.assistido_ocupacao || "";

    // Mapeamento para tags oficiais do dicionarioTags.js
    enriched.REPRESENTANTE_NOME = partes.nome_representante;
    enriched.nome_representante = partes.nome_representante; // Alias compatibilidade
    enriched.representante_cpf = partes.cpf_representante;
    enriched.representante_data_nascimento =
      partes.data_nascimento_representante || dadosFormulario.representante_data_nascimento || "";
    enriched.representante_nacionalidade =
      partes.nacionalidade_representante ||
      dadosFormulario.representante_nacionalidade ||
      "brasileira";
    enriched.representante_estado_civil =
      partes.estado_civil_representante || dadosFormulario.representante_estado_civil || "solteira";
    enriched.representante_ocupacao =
      partes.profissao_representante || dadosFormulario.representante_ocupacao || "";
    enriched.representante_rg_numero = partes.rg_representante;
    enriched.representante_rg_orgao = partes.emissor_rg_representante;
    enriched.emissor_rg_exequente = partes.emissor_rg_representante;
    enriched.nome_mae_representante = partes.nome_mae_representante;
    enriched.nome_pai_representante = partes.nome_pai_representante;
    enriched.nome_mae_assistido = partes.nome_mae_assistido;
    enriched.nome_pai_assistido = partes.nome_pai_assistido;

    enriched.REQUERIDO_NOME = partes.nome_requerido;
    enriched.nome_requerido = partes.nome_requerido;
    enriched.cpf_requerido = partes.cpf_requerido;
    enriched.executado_cpf = partes.cpf_requerido;
    enriched.rg_executado = partes.rg_requerido;
    enriched.emissor_rg_executado = partes.emissor_rg_requerido;
    enriched.executado_nacionalidade =
      partes.nacionalidade_requerido || dadosFormulario.executado_nacionalidade || "brasileiro(a)";
    enriched.executado_estado_civil =
      partes.estado_civil_requerido || dadosFormulario.executado_estado_civil || "solteiro(a)";
    enriched.executado_ocupacao =
      partes.profissao_requerido || dadosFormulario.executado_ocupacao || "";
    enriched.nome_mae_executado = partes.nome_mae_requerido;
    enriched.nome_pai_executado = partes.nome_pai_requerido;
    enriched.endereco_requerido = partes.endereco_requerido;
    enriched.executado_endereco_residencial =
      partes.endereco_requerido || dadosFormulario.executado_endereco_residencial;
    enriched.telefone_requerido = partes.telefone_requerido;
    enriched.executado_telefone = partes.telefone_requerido;
    enriched.email_requerido = partes.email_requerido;
    enriched.executado_email = partes.email_requerido;

    // Tags exatas para o Word (Compatibilidade Direta)
    enriched.NOME = partes.nome_assistido;
    enriched.nome = partes.nome_assistido;
    enriched.cpf = partes.cpf_assistido;
    enriched.nascimento =
      enriched.assistido_data_nascimento || formatDateBr(partes.data_nascimento_assistido) || "";
    enriched.assistido_rg = partes.rg_assistido;
    enriched.representante_rg = partes.rg_representante;
    enriched.requerente_telefone = partes.telefone_assistido;
    enriched.requerente_email = partes.email_assistido;
    enriched.requerente_endereco_residencial = partes.endereco_assistido;

    // Alias para consultas Supabase style
    enriched.casos_partes = [partes];
    enriched.partes = partes;
  }

  if (juridico) {
    enriched.numero_processo_originario =
      juridico.numero_processo_titulo ||
      dadosFormulario.numero_processo_originario ||
      dadosFormulario.processoOrigemNumero ||
      "";
    enriched.processoOrigemNumero =
      juridico.numero_processo_titulo ||
      dadosFormulario.processoOrigemNumero ||
      dadosFormulario.numero_processo_originario ||
      "";
    enriched.percentual_salario_minimo =
      juridico.percentual_salario || dadosFormulario.percentual_salario_minimo || "";
    enriched.dia_pagamento_fixado =
      juridico.vencimento_dia ||
      dadosFormulario.dia_pagamento_fixado ||
      dadosFormulario.dia_pagamento ||
      "";
    enriched.dia_pagamento =
      juridico.vencimento_dia ||
      dadosFormulario.dia_pagamento ||
      dadosFormulario.dia_pagamento_fixado ||
      "";
    enriched.tipo_decisao = juridico.tipo_decisao || dadosFormulario.tipo_decisao || "";
    enriched.vara_originaria =
      juridico.vara_originaria ||
      dadosFormulario.vara_originaria ||
      dadosFormulario.varaOriginaria ||
      "";
    enriched.varaOriginaria =
      juridico.vara_originaria ||
      dadosFormulario.varaOriginaria ||
      dadosFormulario.vara_originaria ||
      "";
    enriched.cidade_originaria =
      juridico.cidade_originaria ||
      dadosFormulario.cidade_originaria ||
      dadosFormulario.cidadeOriginaria ||
      "";
    enriched.cidadeOriginaria =
      juridico.cidade_originaria ||
      dadosFormulario.cidadeOriginaria ||
      dadosFormulario.cidade_originaria ||
      "";
    enriched.periodo_meses_ano =
      juridico.periodo_inadimplencia ||
      dadosFormulario.periodo_meses_ano ||
      dadosFormulario.periodo_debito ||
      "";
    enriched.periodo_debito_execucao =
      juridico.periodo_inadimplencia ||
      dadosFormulario.periodo_debito_execucao ||
      dadosFormulario.periodo_debito ||
      "";
    enriched.valor_debito =
      juridico.debito_valor ||
      dadosFormulario.valor_debito ||
      dadosFormulario.valor_total_debito_execucao ||
      "";
    enriched.valor_mensal_pensao =
      juridico.debito_valor ||
      dadosFormulario.valor_mensal_pensao ||
      dadosFormulario.valor_pensao ||
      "";
    enriched.valor_pensao = enriched.valor_mensal_pensao;
    enriched.valor_debito_extenso =
      juridico.debito_extenso || dadosFormulario.valor_debito_extenso || "";
    enriched.valor_debito_penhora =
      juridico.debito_penhora_valor ||
      dadosFormulario.debito_penhora_valor ||
      dadosFormulario.valor_debito_penhora ||
      "";
    enriched.valor_debito_penhora_extenso =
      juridico.debito_penhora_extenso ||
      dadosFormulario.debito_penhora_extenso ||
      dadosFormulario.valor_debito_penhora_extenso ||
      "";
    enriched.valor_debito_prisao =
      juridico.debito_prisao_valor ||
      dadosFormulario.debito_prisao_valor ||
      dadosFormulario.valor_debito_prisao ||
      "";
    enriched.valor_debito_prisao_extenso =
      juridico.debito_prisao_extenso ||
      dadosFormulario.debito_prisao_extenso ||
      dadosFormulario.valor_debito_prisao_extenso ||
      "";
    // Dados Bancários: Reconstrói a string para o template a partir das colunas separadas
    const banco = juridico.conta_banco || "";
    const agencia = juridico.conta_agencia || "";
    const operacao = juridico.conta_operacao || "";
    const numero = juridico.conta_numero || "";
    const bancariosConcatenados = [banco, agencia, operacao, numero].filter(Boolean).join(" / ");

    enriched.dados_bancarios_deposito =
      juridico.dados_bancarios_deposito ||
      bancariosConcatenados ||
      dadosFormulario.dados_bancarios_deposito ||
      dadosFormulario.dados_bancarios_exequente ||
      dadosFormulario.chave_pix_deposito ||
      "";
    enriched.dados_bancarios_exequente = enriched.dados_bancarios_deposito;

    // Preserva campos individuais para o formulário
    enriched.banco_deposito = banco;
    enriched.agencia_deposito = agencia;
    enriched.conta_operacao = operacao;
    enriched.conta_deposito = numero;

    // Novos campos de Fixação
    enriched.opcao_guarda = juridico?.opcao_guarda || dadosFormulario?.opcao_guarda || "";
    enriched.guarda =
      juridico.descricao_guarda || dadosFormulario.guarda || dadosFormulario.descricao_guarda || "";
    enriched.descricao_guarda = enriched.guarda;
    enriched.bens_partilha = juridico.bens_partilha || dadosFormulario.bens_partilha || "";
    enriched.situacao_financeira =
      juridico.situacao_financeira_genitora ||
      dadosFormulario.situacao_financeira ||
      dadosFormulario.situacao_financeira_genitora ||
      "";
    enriched.situacao_financeira_genitora = enriched.situacao_financeira;

    // Empregador: Pega do Jurídico, se não, cai pro formulário.
    enriched.empregador_nome =
      juridico.empregador_nome ||
      dadosFormulario.empregador_nome ||
      dadosFormulario.empregador_requerido_nome ||
      "";
    enriched.empregador_requerido_nome = enriched.empregador_nome;
    enriched.empregador_endereco =
      juridico.empregador_endereco ||
      dadosFormulario.empregador_endereco ||
      dadosFormulario.empregador_requerido_endereco ||
      "";
    enriched.empregador_requerido_endereco = enriched.empregador_endereco;
    enriched.empregador_email =
      juridico.empregador_email ||
      dadosFormulario.empregador_email ||
      dadosFormulario.empregador_requerido_email ||
      "";
    enriched.empregador_requerido_email = enriched.empregador_email;

    enriched.juridico = juridico;
  }

  // [FIX] Cidade Assinatura Fallback (Task ID 01)
  enriched.CIDADEASSINATURA =
    juridico?.cidade_assinatura ||
    dadosFormulario.CIDADEASSINATURA ||
    dadosFormulario.cidade_assinatura ||
    caso.unidade?.comarca ||
    "";
  enriched.cidade_assinatura = enriched.CIDADEASSINATURA;

  if (ia) {
    const extras = safeJsonParse(ia.dados_extraidos, {});
    enriched.relato_texto = ia.relato_texto;
    enriched.dos_fatos_gerado = ia.dos_fatos_gerado;
    enriched.resumo_ia = ia.resumo_ia || extras.resumo_ia || null;
    enriched.url_peticao = ia.url_peticao || extras?.url_peticao || null;
    enriched.url_documento_gerado = enriched.url_peticao; // Alias para compatibilidade
    enriched.peticao_inicial_rascunho =
      ia.peticao_inicial_rascunho || extras.peticao_inicial_rascunho || null;
    enriched.peticao_completa_texto = ia.peticao_completa_texto;
    enriched.url_peticao_penhora =
      extras.url_peticao_execucao_penhora ||
      ia.url_peticao_penhora ||
      extras.url_peticao_penhora ||
      null;
    enriched.url_peticao_prisao =
      extras.url_peticao_execucao_prisao ||
      ia.url_peticao_prisao ||
      extras.url_peticao_prisao ||
      null;
    enriched.url_peticao_cumulado =
      extras.url_peticao_execucao_cumulado || extras.url_peticao_cumulado || null;
    enriched.url_peticao_execucao_cumulado = extras.url_peticao_execucao_cumulado || null;
    enriched.url_peticao_execucao_penhora = extras.url_peticao_execucao_penhora || null;
    enriched.url_peticao_execucao_prisao = extras.url_peticao_execucao_prisao || null;
    enriched.url_peticao_cumprimento_cumulado = extras.url_peticao_cumprimento_cumulado || null;
    enriched.url_peticao_cumprimento_penhora = extras.url_peticao_cumprimento_penhora || null;
    enriched.url_peticao_cumprimento_prisao = extras.url_peticao_cumprimento_prisao || null;
    enriched.url_termo_declaracao = ia.url_termo_declaracao || extras?.url_termo_declaracao || null;

    // Alias para attachSignedUrls
    enriched.casos_ia = ia;
    enriched.ia = ia;
    // [FIX] O dados_formulario agora abraça o próprio payload JSONB extraído com integridade
    enriched.dados_formulario = {
      ...buildDadosFormularioFallback(enriched),
      ...extras,
    };
  } else {
    enriched.dados_formulario = buildDadosFormularioFallback(enriched);
  }

  // Populate urls_documentos for attachSignedUrls
  if (caso.documentos && Array.isArray(caso.documentos)) {
    enriched.documentos_originais = caso.documentos.map((doc) => ({
      storage_path: doc.storage_path,
      tipo: doc.tipo,
      nome_original: doc.nome_original,
      tamanho_bytes: doc.tamanho_bytes ? String(doc.tamanho_bytes) : null,
    }));
    enriched.urls_documentos = caso.documentos.map((doc) => doc.storage_path);
  } else if (!enriched.urls_documentos) {
    enriched.urls_documentos = [];
    enriched.documentos_originais = [];
  }

  // Adiciona sistema de peticionamento dinâmico
  enriched.sistema_peticionamento = caso.unidade?.sistema || "solar";

  return enriched;
};

class HttpError extends Error {
  constructor(statusCode, message, payload = {}) {
    super(message);
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

const carregarCasoDetalhado = async (id, reqUser) => {
  let data;

  if (isSupabaseConfigured) {
    const result = await supabase
      .from("casos")
      .select(
        `
        *,
        ia:casos_ia(*),
        partes:casos_partes(*),
        juridico:casos_juridico(*),
        documentos(*),
        defensor:defensores!casos_defensor_id_fkey(nome),
        servidor:defensores!casos_servidor_id_fkey(nome),
        unidade:unidades(sistema),
        assistencia_casos:assistencia_casos(
          status,
          destinatario_id,
          remetente:defensores!remetente_id(nome),
          destinatario:defensores!destinatario_id(nome)
        )
      `,
      )
      .eq("id", id)
      .single();

    if (result.error) {
      logger.error(
        `[Supabase Detail] Erro query para ID ${id}: ${result.error.message}`,
        result.error,
      );
      if (result.error.code === "PGRST116") {
        throw new HttpError(404, "Caso não encontrado.");
      }
      throw result.error;
    }

    data = result.data;
  } else {
    const dataRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: {
        partes: true,
        ia: true,
        juridico: true,
        documentos: true,
        defensor: { select: { nome: true } },
        servidor: { select: { nome: true } },
        unidade: { select: { sistema: true } },
        assistencia_casos: {
          where: {
            OR: [{ destinatario_id: reqUser.id }, { remetente_id: reqUser.id }],
            status: "aceito",
          },
          include: {
            destinatario: { select: { nome: true } },
            remetente: { select: { nome: true } },
          },
        },
      },
    });

    if (!dataRaw) {
      throw new HttpError(404, "Caso não encontrado.");
    }

    data = dataRaw;
  }

  data = mapCasoRelations(data);

  const isPowerUser = ["admin", "gestor"].includes(reqUser.cargo.toLowerCase());
  const isOwner =
    String(data.defensor_id) === String(reqUser.id) ||
    String(data.servidor_id) === String(reqUser.id);
  const isShared = (data.assistencia_casos || []).length > 0;

  if (!isPowerUser && !isOwner && !isShared && (data.defensor_id || data.servidor_id)) {
    const holderName = data.defensor?.nome || data.servidor?.nome || "outro usuário";
    throw new HttpError(423, "Caso bloqueado", {
      message: `Este caso já está vinculado ao defensor(a) ${holderName}. Apenas o administrador pode liberar este caso.`,
      holder: holderName,
    });
  }

  // [READ-ONLY] carregarCasoDetalhado não realiza nenhuma mutação de estado.
  // A lógica de vínculo automático (auto-vinculação) foi movida exclusivamente
  // para obterDetalhesCaso, que inclui o check de unidade_id obrigatório.

  if (!data.dados_formulario) {
    data.dados_formulario = {};
  }
  if (!data.dados_formulario.document_names) {
    data.dados_formulario.document_names = {};
  }
  if (!data.dados_formulario.documentNames) {
    data.dados_formulario.documentNames = data.dados_formulario.document_names;
  }

  return data;
};

const normalizeAcaoKey = (acaoRaw = "") => {
  const normalized = String(acaoRaw || "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!normalized) return normalized;

  const aliases = {
    exec_cumulado: "execucao_alimentos",
    exec_penhora: "execucao_alimentos",
    exec_prisao: "execucao_alimentos",
    execucao_cumulado: "execucao_alimentos",
    execucao_penhora: "execucao_alimentos",
    execucao_prisao: "execucao_alimentos",
    def_cumulado: "execucao_alimentos",
    def_penhora: "execucao_alimentos",
    def_prisao: "execucao_alimentos",
    cumprimento_cumulado: "execucao_alimentos",
    cumprimento_penhora: "execucao_alimentos",
    cumprimento_prisao: "execucao_alimentos",
    fixacao_de_pensao_alimenticia: "fixacao_alimentos",
    fixacao_de_alimentos: "fixacao_alimentos",
  };

  if (aliases[normalized]) return aliases[normalized];

  // Compatibilidade para casos legados onde o texto da acao veio "sujo" do PDF.
  if (
    normalized.includes("execucao") &&
    (normalized.includes("penhora") || normalized.includes("prisao"))
  ) {
    return "execucao_alimentos";
  }

  if (
    normalized.includes("fixacao") &&
    (normalized.includes("alimento") || normalized.includes("pensao"))
  ) {
    return "fixacao_alimentos";
  }

  return normalized;
};

const DOC_URL_KEY_BY_TIPO = {
  fixacao_alimentos: "url_peticao",
  exec_penhora: "url_peticao_execucao_penhora",
  exec_prisao: "url_peticao_execucao_prisao",
  exec_cumulado: "url_peticao_execucao_cumulado",
  execucao_cumulado: "url_peticao_execucao_cumulado",
  execucao_penhora: "url_peticao_execucao_penhora",
  execucao_prisao: "url_peticao_execucao_prisao",
  cumprimento_cumulado: "url_peticao_cumprimento_cumulado",
  cumprimento_penhora: "url_peticao_cumprimento_penhora",
  cumprimento_prisao: "url_peticao_cumprimento_prisao",
  // Aliases para chaves simplificadas
  cumulado: "url_peticao_execucao_cumulado",
  penhora: "url_peticao_execucao_penhora",
  prisao: "url_peticao_execucao_prisao",
  termo: "url_termo_declaracao",
};

// Colunas diretas de casos_ia que podem ser substituídas por upload manual.
// Chaves JSONB (dados_extraidos) são espelhadas automaticamente.
const ALLOWED_MINUTA_KEYS = new Set([
  "url_peticao",
  "url_peticao_penhora",
  "url_peticao_prisao",
  "url_termo_declaracao",
  "url_peticao_execucao_cumulado",
  "url_peticao_execucao_penhora",
  "url_peticao_execucao_prisao",
  "url_peticao_cumprimento_cumulado",
  "url_peticao_cumprimento_penhora",
  "url_peticao_cumprimento_prisao",
]);

const URL_KEYS_DOCUMENTOS_GERADOS = [
  "url_peticao_execucao_cumulado",
  "url_peticao_execucao_penhora",
  "url_peticao_execucao_prisao",
  "url_peticao_cumprimento_cumulado",
  "url_peticao_cumprimento_penhora",
  "url_peticao_cumprimento_prisao",
];

const buildDadosFormularioFallback = (caso = {}) => {
  // Converte as propriedades do objeto 'enriched' (caso) no formato esperado pelo buildDocxTemplatePayload
  const lookup = { ...caso };

  return {
    ...safeJsonParse(caso.ia?.dados_extraidos, {}), // Usa o da IA como base inicial mas as colunas do banco sobrescrevem
    tipoAcao: lookup.tipo_acao || lookup.tipoAcao || "",
    acaoEspecifica:
      lookup.acao_especifica ||
      lookup.acaoEspecifica ||
      (String(lookup.tipo_acao || lookup.tipoAcao || "").split(" - ")[1] || "").trim(),
    protocolo: lookup.protocolo,
    nome: lookup.nome_assistido || lookup.nome || "",
    nome_assistido: lookup.nome_assistido || lookup.nome || "",
    cpf: lookup.cpf_assistido || lookup.cpf || "",
    cpf_assistido: lookup.cpf_assistido || lookup.cpf || "",
    telefone: lookup.telefone_assistido || lookup.telefone || "",
    email_assistido: lookup.email_assistido || lookup.email || "",
    endereco_assistido: lookup.endereco_assistido || lookup.requerente_endereco_residencial || "",
    assistido_data_nascimento: formatDateBr(lookup.assistido_data_nascimento),
    assistido_nacionalidade: lookup.assistido_nacionalidade || "brasileiro(a)",
    assistido_estado_civil: lookup.assistido_estado_civil || "solteiro(a)",
    assistido_ocupacao: lookup.assistido_ocupacao || "",
    assistido_rg_numero: lookup.assistido_rg_numero || "",
    assistido_rg_orgao: lookup.assistido_rg_orgao || "",
    NOME: lookup.nome_assistido || lookup.nome || "",
    REPRESENTANTE_NOME:
      lookup.REPRESENTANTE_NOME || lookup.nome_representante || lookup.nome_assistido || "",
    representante_nome: lookup.nome_representante || lookup.nome_assistido || "",
    representante_cpf: lookup.representante_cpf || "",
    representante_nacionalidade: lookup.representante_nacionalidade || "brasileira",
    representante_estado_civil: lookup.representante_estado_civil || "solteira",
    representante_rg: lookup.representante_rg || "",
    representante_rg_numero: lookup.representante_rg || "",
    representante_rg_orgao: lookup.emissor_rg_exequente || "",
    nome_mae_representante: lookup.nome_mae_representante || "",
    nome_pai_representante: lookup.nome_pai_representante || "",
    requerente_telefone: lookup.telefone_assistido || "",
    requerente_email: lookup.email_assistido || "",
    requerente_endereco_residencial: lookup.endereco_assistido || "",
    REQUERIDO_NOME: lookup.REQUERIDO_NOME || lookup.nome_requerido || "",
    nome_requerido: lookup.nome_requerido || "",
    cpf_requerido: lookup.cpf_requerido || lookup.executado_cpf || "",
    executado_cpf: lookup.executado_cpf || lookup.cpf_requerido || "",
    executado_nacionalidade: lookup.executado_nacionalidade || "brasileiro(a)",
    executado_estado_civil: lookup.executado_estado_civil || "solteiro(a)",
    executado_ocupacao: lookup.executado_ocupacao || "",
    rg_executado: lookup.rg_executado || "",
    endereco_requerido: lookup.endereco_requerido || lookup.executado_endereco_residencial || "",
    executado_endereco_residencial:
      lookup.executado_endereco_residencial || lookup.endereco_requerido || "",
    valor_pensao: formatCurrencyBr(lookup.valor_mensal_pensao || lookup.valor_pensao) || "",
    valor_mensal_pensao: lookup.valor_mensal_pensao || lookup.valor_pensao || "",
    percentual_salario_minimo: lookup.percentual_salario_minimo || "",
    dia_pagamento: lookup.dia_pagamento || lookup.dia_pagamento_fixado || "",
    valor_debito: lookup.valor_debito || "",
    valor_debito_penhora: lookup.valor_debito_penhora || "",
    valor_debito_prisao: lookup.valor_debito_prisao || "",
    valor_causa: lookup.valor_causa || "",
    valor_causa_extenso: lookup.valor_causa_extenso || "",
    numero_processo_originario: lookup.numero_processo_originario || "",
    vara_originaria: lookup.vara_originaria || "",
    cidade_originaria: lookup.cidade_originaria || "",
    dados_bancarios_deposito: lookup.dados_bancarios_deposito || "",
    dados_bancarios_exequente: lookup.dados_bancarios_deposito || "",
    vara: lookup.vara_originaria || lookup.unidade?.comarca || "",
    CIDADEASSINATURA: lookup.unidade?.comarca || "",
    guarda: lookup.guarda || lookup.descricao_guarda || "",
    descricao_guarda: lookup.descricao_guarda || lookup.guarda || "",
    descricaoGuarda: lookup.descricao_guarda || lookup.guarda || "",
    opcao_guarda: lookup.opcao_guarda || "",
    opcaoGuarda: lookup.opcao_guarda || "",
    bens_partilha: lookup.bens_partilha || "",
    situacao_financeira: lookup.situacao_financeira || lookup.situacao_financeira_genitora || "",
    situacao_financeira_genitora:
      lookup.situacao_financeira_genitora || lookup.situacao_financeira || "",
    empregador_nome: lookup.empregador_nome || lookup.empregador_requerido_nome || "",
    empregador_endereco: lookup.empregador_endereco || lookup.empregador_requerido_endereco || "",
    empregador_email: lookup.empregador_email || lookup.empregador_requerido_email || "",
  };
};

// Tempo de expiração (em segundos) para URLs assinadas do Supabase
const signedExpires = Number.parseInt(process.env.SIGNED_URL_EXPIRES || "3600", 10);

const storageBuckets = {
  documentos: process.env.SUPABASE_DOCUMENTOS_BUCKET || "documentos",
  peticoes: process.env.SUPABASE_PETICOES_BUCKET || "peticoes",
  audios: process.env.SUPABASE_AUDIOS_BUCKET || "audios",
};

const salarioMinimoAtual = Number.parseFloat(process.env.SALARIO_MINIMO_ATUAL || "1621");

// --- VALIDAÇÃO DE CPF ---
const validarCPF = (cpf) => {
  if (!cpf) return false;
  const strCPF = String(cpf).replace(/[^\d]/g, "");
  if (strCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(strCPF)) return false;
  let soma = 0,
    resto;
  for (let i = 1; i <= 9; i++) soma += parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(strCPF.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++) soma += parseInt(strCPF.substring(i - 1, i)) * (12 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  return resto === parseInt(strCPF.substring(10, 11));
};

// --- UTILS DE PARSE SEGURO ---
const safeJsonParse = (jsonString, fallback = null) => {
  if (typeof jsonString === "object" && jsonString !== null) {
    return jsonString; // Já é um objeto, retorna diretamente
  }
  if (typeof jsonString !== "string" || !jsonString) {
    return fallback;
  }
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    logger.warn(
      `Falha ao analisar JSON: ${e.message}. Tamanho da string: ${jsonString?.length || 0}`,
    );
    return fallback;
  }
};

// --- UTILS DE FORMATAÇÃO E PARSE ---
const parseCurrencyToNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const normalized = String(value)
    .trim()
    .replace(/[^\d.,-]/g, "");
  if (!normalized) return 0;
  const hasComma = normalized.includes(",");
  const parsedString = hasComma ? normalized.replace(/\./g, "").replace(",", ".") : normalized;
  const result = Number(parsedString);
  return Number.isNaN(result) ? 0 : result;
};

const _calcularValorCausa = (valorMensal) => {
  const valorNumerico = parseCurrencyToNumber(valorMensal);
  if (!valorNumerico) return 0;
  return valorNumerico * 12;
};

const numeroParaExtenso = (valor) => {
  const unidades = [
    "zero",
    "um",
    "dois",
    "três",
    "quatro",
    "cinco",
    "seis",
    "sete",
    "oito",
    "nove",
  ];
  const especiais = [
    "dez",
    "onze",
    "doze",
    "treze",
    "quatorze",
    "quinze",
    "dezesseis",
    "dezessete",
    "dezoito",
    "dezenove",
  ];
  const dezenas = [
    "",
    "dez",
    "vinte",
    "trinta",
    "quarenta",
    "cinquenta",
    "sessenta",
    "setenta",
    "oitenta",
    "noventa",
  ];
  const centenas = [
    "",
    "cento",
    "duzentos",
    "trezentos",
    "quatrocentos",
    "quinhentos",
    "seiscentos",
    "setecentos",
    "oitocentos",
    "novecentos",
  ];
  const qualificadores = [
    { singular: "", plural: "" },
    { singular: "mil", plural: "mil" },
    { singular: "milhão", plural: "milhões" },
    { singular: "bilhão", plural: "bilhões" },
  ];

  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);

  if (inteiro === 0 && centavos === 0) return "zero real";

  const numeroParaTextoAte999 = (numero) => {
    if (numero === 0) return "";
    if (numero === 100) return "cem";
    const c = Math.floor(numero / 100);
    const d = Math.floor((numero % 100) / 10);
    const u = numero % 10;
    const partes = [];
    if (c) partes.push(centenas[c]);
    if (d === 1) {
      partes.push(especiais[u]);
    } else {
      if (d) partes.push(dezenas[d]);
      if (u) partes.push(unidades[u]);
    }
    return partes.join(" e ");
  };

  const grupos = [];
  let numeroRestante = inteiro;
  while (numeroRestante > 0) {
    grupos.push(numeroRestante % 1000);
    numeroRestante = Math.floor(numeroRestante / 1000);
  }

  const partesInteiras = grupos
    .map((grupo, index) => {
      if (!grupo) return null;
      const texto = numeroParaTextoAte999(grupo);
      if (!texto) return null;
      const qualificador = qualificadores[index];
      const ehSingular = grupo === 1 && index > 0;
      const sufixo =
        index === 0 ? "" : ` ${ehSingular ? qualificador.singular : qualificador.plural}`;
      return `${texto}${sufixo}`;
    })
    .filter(Boolean)
    .reverse();

  const inteiroExtenso = partesInteiras.join(" e ") || "zero";
  const rotuloInteiro = inteiro === 1 ? "real" : "reais";

  let resultado = `${inteiroExtenso} ${rotuloInteiro}`;
  if (centavos > 0) {
    const centavosExtenso = numeroParaTextoAte999(centavos) || "zero";
    const rotuloCentavos = centavos === 1 ? "centavo" : "centavos";
    resultado += ` e ${centavosExtenso} ${rotuloCentavos}`;
  }
  return resultado;
};

const calcularPercentualSalarioMinimo = (valorMensalPensao) => {
  if (!valorMensalPensao) return "";
  const valorNumerico = parseCurrencyToNumber(valorMensalPensao);
  logger.info(
    `[Cálculo Percentual] Valor Pensão: ${valorMensalPensao} -> Numérico: ${valorNumerico} | Salário Mínimo: ${salarioMinimoAtual}`,
  );
  if (!salarioMinimoAtual || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
    return "";
  }
  const percentual = (valorNumerico / salarioMinimoAtual) * 100;
  logger.info(`[Cálculo Percentual] Resultado: ${percentual}%`);
  const percentualLimpo = Number(percentual.toFixed(2));
  if (Number.isNaN(percentualLimpo)) return "";
  if (Number.isInteger(percentualLimpo)) return String(percentualLimpo);
  return percentualLimpo.toFixed(2).replace(".", ",");
};

const extractObjectPath = (storedValue) => {
  if (!storedValue) return null;
  if (!storedValue.startsWith("http")) return storedValue.replace(/^\/+/, "");
  try {
    const signedUrl = new URL(storedValue);
    const decodedPath = decodeURIComponent(signedUrl.pathname);
    const match = decodedPath.match(/\/object\/(?:sign|public)\/[^/]+\/(.+)/);
    return match?.[1] || null;
  } catch (err) {
    logger.warn(`Não foi possível interpretar URL armazenada: ${err?.message}`);
    return null;
  }
};

const buildSignedUrl = async (bucket, storedValue) => {
  const objectPath = extractObjectPath(storedValue);
  if (!objectPath) return null;

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, signedExpires);
    if (error) {
      if (error.message && error.message.includes("Object not found")) {
        logger.warn(`[Storage] Arquivo ausente (Link órfão no Banco): ${objectPath}`);
      } else {
        logger.error(`[Storage] Erro ao gerar URL para ${objectPath}:`, {
          error,
        });
      }
      return null;
    }
    return data?.signedUrl || null;
  } else {
    // Local storage fallback: aponta para a rota estática do backend
    // No Docker, o backend expõe a pasta uploads em /api/files
    const baseUrl = process.env.API_BASE_URL
      ? process.env.API_BASE_URL.replace(/\/api$/, "")
      : "http://localhost:8001";
    return `${baseUrl}/api/files/${bucket}/${objectPath}`;
  }
};

const attachSignedUrls = async (caso) => {
  if (!caso) return caso;
  const enriched = { ...caso };

  // Busca unificada para o Prisma e Supabase fallback garantindo que as urls são mapeadas
  const ia = Array.isArray(caso.casos_ia) ? caso.casos_ia[0] : caso.casos_ia || caso.ia;
  const iaPenhoraUrl =
    caso.url_peticao_penhora ||
    ia?.url_peticao_penhora ||
    ia?.dados_extraidos?.url_peticao_penhora ||
    null;
  const iaPrisaoUrl =
    caso.url_peticao_prisao ||
    ia?.url_peticao_prisao ||
    ia?.dados_extraidos?.url_peticao_prisao ||
    null;
  const iaCumuladoUrl =
    caso.url_peticao_cumulado || ia?.dados_extraidos?.url_peticao_cumulado || null;
  const docKeysExtras = URL_KEYS_DOCUMENTOS_GERADOS.map((key) => ({
    key,
    value: caso[key] || ia?.dados_extraidos?.[key] || null,
  }));

  const [
    docGerado,
    audio,
    peticao,
    termoDeclaracao,
    docPenhora,
    docPrisao,
    docCumulado,
    ...docsExtras
  ] = await Promise.all([
    buildSignedUrl(storageBuckets.peticoes, caso.url_documento_gerado),
    buildSignedUrl(storageBuckets.audios, caso.url_audio),
    buildSignedUrl(storageBuckets.peticoes, caso.url_peticao),
    buildSignedUrl(storageBuckets.peticoes, caso.url_termo_declaracao),
    buildSignedUrl(storageBuckets.peticoes, iaPenhoraUrl),
    buildSignedUrl(storageBuckets.peticoes, iaPrisaoUrl),
    buildSignedUrl(storageBuckets.peticoes, iaCumuladoUrl),
    ...docKeysExtras.map((entry) => buildSignedUrl(storageBuckets.peticoes, entry.value)),
  ]);
  enriched.url_documento_gerado = docGerado;
  enriched.url_audio = audio;
  enriched.url_peticao = peticao;
  enriched.url_termo_declaracao = termoDeclaracao;
  if (docPenhora) enriched.url_peticao_penhora = docPenhora;
  if (docPrisao) enriched.url_peticao_prisao = docPrisao;
  if (docCumulado) enriched.url_peticao_cumulado = docCumulado;
  docKeysExtras.forEach((entry, index) => {
    if (docsExtras[index]) enriched[entry.key] = docsExtras[index];
  });
  // --- NORMALIZAÇÃO DE DOCUMENTOS ---
  // Se os documentos não vieram no 'include' do Prisma/Supabase, buscamos agora
  let docsBase = caso.documentos || caso.documentos_originais || [];

  if (docsBase.length === 0 && caso.id) {
    try {
      docsBase = await prisma.documentos.findMany({
        where: { caso_id: BigInt(caso.id) },
      });
    } catch (err) {
      logger.warn(
        `[attachSignedUrls] Erro ao buscar documentos p/ caso ${caso.id}: ${err.message}`,
      );
    }
  }

  if (Array.isArray(docsBase) && docsBase.length > 0) {
    const signedDocs = await Promise.all(
      docsBase.map(async (doc) => {
        const url = await buildSignedUrl(storageBuckets.documentos, doc.storage_path);
        return url ? { ...doc, url } : null;
      }),
    );
    const validDocs = signedDocs.filter(Boolean);
    enriched.documentos_detalhes = validDocs;
    // Mantém compatibilidade com legado para o frontend
    enriched.urls_documentos = validDocs.map((d) => d.url);
  } else {
    // Fallback para urls_documentos legado se ainda existir no objeto (raro após normalização)
    if (Array.isArray(caso.urls_documentos) && caso.urls_documentos.length > 0) {
      const signedLegacy = await Promise.all(
        caso.urls_documentos.map((path) => buildSignedUrl(storageBuckets.documentos, path)),
      );
      enriched.urls_documentos = signedLegacy.filter(Boolean);
      enriched.documentos_detalhes = enriched.urls_documentos.map((url) => ({ url }));
    } else {
      enriched.documentos_detalhes = [];
      enriched.urls_documentos = [];
    }
  }

  return enriched;
};

const ensureText = (val, fallback = "") => {
  if (val === undefined || val === null || String(val).toLowerCase() === "undefined")
    return fallback;
  const text = String(val).trim();
  return text.length ? text : fallback;
};

const sanitizeInlineText = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  return text
    .replace(/\s*\n+\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
};

const _ensureInlineValue = (value) => {
  const ensured = ensureText(value);
  return ensured;
};

const sanitizeCaseDataInlineFields = (data = {}) => {
  const sanitized = { ...data };
  const inlineFields = [
    "dados_adicionais_requerente",
    "representante_nacionalidade",
    "representante_estado_civil",
  ];
  inlineFields.forEach((field) => {
    if (sanitized[field] !== undefined && sanitized[field] !== null) {
      sanitized[field] = sanitizeInlineText(sanitized[field]);
    }
  });
  return sanitized;
};

const formatDateBr = (value) => {
  if (!value) return value;
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  if (!year || year.length !== 4) return value;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

const formatCurrencyBr = (value) => {
  if (value === null || value === undefined || value === "") return value;
  const number = Number(value);
  if (Number.isNaN(number)) return value;
  return number
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    .replace(/\u00A0/g, " ");
};

/**
 * Helper para extrair componentes de endereço da string formatada pelo EnderecoInput.jsx
 */
const parseEnderecoParaSolar = (enderecoStr) => {
  const emptyEndereco = {
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    uf: "BA",
    tipo_area: "urbana",
    tipo_endereco: "residencial",
  };
  if (!enderecoStr || typeof enderecoStr !== "string") return emptyEndereco;

  const regexMap = {
    rua: /Rua: ([^,]*)/,
    numero: /Número: ([^,]*)/,
    complemento: /Complemento: ([^,]*)/,
    bairro: /Bairro: ([^,]*)/,
    cidade: /Cidade: ([^,]*)/,
    cep: /CEP: ([^,]*)/,
  };

  const addr = {};
  Object.keys(regexMap).forEach((key) => {
    const match = enderecoStr.match(regexMap[key]);
    if (match) addr[key] = match[1].trim();
  });

  // Retorna estrutura compatível com o SOLAR conforme atendimento.json
  return {
    cep: (addr.cep || "").replace(/\D/g, ""),
    logradouro: addr.rua || "",
    numero: addr.numero || "",
    complemento: addr.complemento || "",
    bairro: addr.bairro || "",
    municipio: addr.cidade || "",
    uf: "BA", // Padrão Defensoria Bahia
    tipo_area: "urbana",
    tipo_endereco: "residencial",
  };
};

const buildSolarExportPayload = (caso = {}) => {
  const dados = caso.dados_formulario || {};

  // No mutirão Mães em Ação, o alvo principal da qualificação SOLAR é a MÃE (Representante)
  // sempre que o assistido direto é um filho incapaz.
  const incapazFlag = String(
    caso.assistido_eh_incapaz ?? dados.assistido_eh_incapaz ?? dados.assistidoEhIncapaz ?? "",
  )
    .toLowerCase()
    .trim();
  const isIncapaz = incapazFlag === "sim";

  // Define os alvos com base na capacidade
  const targetCpf = isIncapaz
    ? caso.representante_cpf || dados.representante_cpf
    : caso.cpf_assistido || caso.cpf || dados.cpf;

  const targetNome = isIncapaz
    ? caso.nome_representante ||
      caso.REPRESENTANTE_NOME ||
      dados.nome_representante ||
      dados.REPRESENTANTE_NOME
    : caso.nome_assistido || caso.nome || dados.NOME || dados.nome;

  const targetNascimento = isIncapaz
    ? caso.representante_data_nascimento || dados.representante_data_nascimento
    : caso.assistido_data_nascimento || caso.nascimento || dados.nascimento;

  const targetNomeMae = isIncapaz
    ? caso.nome_mae_representante || dados.nome_mae_representante
    : caso.nome_mae_assistido || caso.nome_mae_representante || dados.nome_mae_assistido;

  const targetNomePai = isIncapaz
    ? caso.nome_pai_representante || dados.nome_pai_representante
    : caso.nome_pai_assistido || caso.nome_pai_representante || dados.nome_pai_assistido;

  const targetRg = isIncapaz
    ? caso.representante_rg_numero || dados.representante_rg_numero || caso.assistido_rg_numero
    : caso.assistido_rg_numero || dados.assistido_rg_numero || caso.representante_rg_numero;

  const targetEmissor = isIncapaz
    ? caso.representante_rg_orgao || dados.representante_rg_orgao || caso.emissor_rg_exequente
    : caso.assistido_rg_orgao || dados.assistido_rg_orgao || caso.emissor_rg_exequente;

  const targetOcupacao = isIncapaz
    ? caso.representante_ocupacao || dados.representante_ocupacao
    : caso.assistido_ocupacao || dados.assistido_ocupacao;

  const targetNacionalidade = isIncapaz
    ? caso.representante_nacionalidade || dados.representante_nacionalidade || "brasileira"
    : caso.assistido_nacionalidade || dados.assistido_nacionalidade || "brasileiro(a)";

  const targetEstadoCivil = isIncapaz
    ? caso.representante_estado_civil || dados.representante_estado_civil || "solteira"
    : caso.assistido_estado_civil || dados.assistido_estado_civil || "solteiro(a)";

  return {
    cpf: (targetCpf || "").replace(/\D/g, ""),
    NOME: (targetNome || "").toUpperCase(),
    nome_mae_representante: targetNomeMae || "",
    nascimento: formatDateBr(targetNascimento) || "",
    data_nascimento_assistido: formatDateBr(targetNascimento) || "",
    nome_mae_assistido: targetNomeMae || "",
    nome_pai_assistido: targetNomePai || "",
    filiacao: [
      targetNomeMae ? `Mãe: ${targetNomeMae}` : null,
      targetNomePai ? `Pai: ${targetNomePai}` : null,
    ]
      .filter(Boolean)
      .join(", "),
    representante_estado_civil: targetEstadoCivil || "",
    requerente_telefone:
      caso.telefone_assistido || caso.requerente_telefone || dados.requerente_telefone || "",
    requerente_email: caso.email_assistido || caso.requerente_email || dados.requerente_email || "",
    genero: dados.genero || dados.sexo || "",
    rg_executado: targetRg || "",
    emissor_rg_executado: targetEmissor || "",
    rg_data_expedicao: dados.rg_data_expedicao || "",
    certidao_tipo: dados.certidao_tipo || "",
    certidao_numero: dados.certidao_numero || "",
    raca: dados.raca || "",
    naturalidade: dados.naturalidade || "",
    naturalidade_estado: dados.naturalidade_estado || "",
    nacionalidade: targetNacionalidade || "",
    naturalidade_pais: dados.naturalidade_pais || "",
    escolaridade: dados.escolaridade || "",
    tipo_trabalho: dados.tipo_trabalho || "",
    representante_ocupacao: targetOcupacao || "",
    qtd_estado: dados.qtd_estado || "",
    moradia_tipo: dados.moradia_tipo || "",
    moradia_num_comodos: dados.moradia_num_comodos || "",
    renda_numero_membros: dados.renda_numero_membros || "",
    renda_numero_membros_economicamente_ativos:
      dados.renda_numero_membros_economicamente_ativos || "",
    renda_individual: dados.renda_individual || "",
    renda_familiar: dados.renda_familiar || "",
    tem_plano_saude: dados.tem_plano_saude || "",
    isento_ir: dados.isento_ir || "",
    previdencia: dados.previdencia || "",
    endereco: parseEnderecoParaSolar(
      caso.endereco_assistido ||
        dados.endereco_assistido ||
        dados.requerente_endereco_residencial ||
        "",
    ),
  };
};

const formatVara = (val) => {
  let v = String(val || "")
    .trim()
    .toUpperCase();
  if (!v || v === "______") return "______";
  // Se começar com número e não tiver o símbolo ordinal (ª ou º), adiciona ª
  if (/^\d+/.test(v) && !/^\d+[ªº]/.test(v)) {
    v = v.replace(/^(\d+)/, "$1ª");
  }
  return v;
};

// --- UTILS DE LÓGICA DE NEGÓCIO (Extraídos) ---
const calcularIdade = (dataNascString) => {
  if (!dataNascString) return null;
  let nascimento;
  if (dataNascString.includes("/")) {
    const [dia, mes, ano] = dataNascString.split("/");
    nascimento = new Date(`${ano}-${mes}-${dia}T00:00:00`);
  } else if (dataNascString.includes("-")) {
    nascimento = new Date(`${dataNascString}T00:00:00`);
  } else {
    return null;
  }
  if (isNaN(nascimento.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};

const normalizeGenderTerm = (val) => {
  if (!val || typeof val !== "string") return val;
  const lower = val.toLowerCase().trim();
  if (lower.includes("brasileir")) return "brasileiro(a)";
  return val;
};

const buildFallbackDosFatos = (caseData = {}) => {
  const safe = (value) => (typeof value === "string" ? value.trim() : (value ?? ""));
  const paragraphs = [];

  // --- LÓGICA MULTI-FILHOS ---
  const outrosFilhos = safeJsonParse(caseData.outros_filhos_detalhes, []);

  const assistidoPrincipal =
    safe(caseData.nome_assistido) || safe(caseData.requerente_nome) || safe(caseData.nome) || "";
  const nomesAssistidos = [assistidoPrincipal];
  if (Array.isArray(outrosFilhos)) {
    outrosFilhos.forEach((f) => {
      if (f.nome) nomesAssistidos.push(safe(f.nome));
    });
  }
  const assistidoNome = nomesAssistidos.filter(Boolean).join(", ");
  const isPlural = nomesAssistidos.filter(Boolean).length > 1;

  const representanteNome = safe(caseData.representante_nome);
  const requeridoNome =
    safe(caseData.nome_requerido) ||
    safe(caseData.requerido_nome) ||
    safe(caseData.requerido) ||
    "";

  if (assistidoNome || representanteNome) {
    const sujeito =
      caseData.assistido_eh_incapaz === "sim" && representanteNome
        ? `${representanteNome}, na qualidade de representante legal de ${
            assistidoNome || "seu dependente"
          }`
        : assistidoNome || representanteNome;
    const complemento = requeridoNome
      ? `relata que ${requeridoNome} não contribui de forma regular para o custeio das despesas básicas`
      : "relata a ausência de contribuição regular da outra parte para o custeio das despesas básicas";
    paragraphs.push(
      `${sujeito} ${complemento}, razão pela qual busca a tutela jurisdicional para garantir a subsistência da${isPlural ? "s crianças" : " criança"}.`,
    );
  }
  if (safe(caseData.descricao_guarda)) {
    paragraphs.push(
      `A guarda fática atualmente é descrita da seguinte forma: ${safe(
        caseData.descricao_guarda,
      )}.`,
    );
  }
  const situacaoAssistido = [
    caseData.situacao_financeira_genitora,
    caseData.dados_adicionais_requerente,
  ]
    .map(safe)
    .filter(Boolean)
    .join(" ");
  if (situacaoAssistido) {
    paragraphs.push(
      `Sobre a realidade econômica de quem assume as despesas, informa-se que ${situacaoAssistido}.`,
    );
  }
  if (safe(caseData.dados_adicionais_requerido)) {
    paragraphs.push(
      `Quanto ao requerido, destacam-se os seguintes elementos: ${safe(
        caseData.dados_adicionais_requerido,
      )}.`,
    );
  }
  const valorPretendido =
    safe(caseData.valor_pensao) || safe(formatCurrencyBr(caseData.valor_mensal_pensao));
  const diaPagamento =
    safe(caseData.dia_pagamento_requerido) || safe(caseData.dia_pagamento_fixado);
  if (valorPretendido || diaPagamento) {
    paragraphs.push(
      `Diante desse contexto, requer-se a fixação de alimentos no valor de ${
        valorPretendido || "[valor a ser definido]"
      }` + (diaPagamento ? `, com vencimento no dia ${diaPagamento} de cada mês.` : "."),
    );
  }
  if (safe(caseData.relato_texto)) {
    paragraphs.push(`Relato do assistido: ${safe(caseData.relato_texto)}.`);
  }
  const documentosInformados = Array.isArray(caseData.documentos_informados)
    ? caseData.documentos_informados.map((doc) => safe(doc)).filter(Boolean)
    : [];
  if (documentosInformados.length) {
    const resumoDocs = documentosInformados.slice(0, 3).join("; ");
    paragraphs.push(
      `Os fatos narrados encontram respaldo nos documentos informados no formulário, tais como ${resumoDocs}${
        documentosInformados.length > 3 ? ", entre outros" : ""
      }.`,
    );
  } else {
    paragraphs.push(
      "A narrativa será complementada com a documentação que acompanha o formulário e eventuais provas a serem juntadas posteriormente.",
    );
  }
  return paragraphs.filter(Boolean).join("\n\n");
};

const processarDadosFilhosParaPeticao = (baseData = {}, normalizedData = {}) => {
  const outrosFilhosRaw = safeJsonParse(baseData.outros_filhos_detalhes, []);
  const outrosFilhosSafe = Array.isArray(outrosFilhosRaw)
    ? outrosFilhosRaw
    : outrosFilhosRaw
      ? [outrosFilhosRaw]
      : [];

  const filhoPrincipal = {
    nome: ensureText(
      baseData.NOME || baseData.nome || baseData.nome_assistido || normalizedData.requerente_nome,
    ),
    cpf: ensureText(
      baseData.cpf ||
        baseData.cpf_assistido ||
        baseData.representante_cpf ||
        normalizedData.requerente_cpf,
    ),
    nascimento: ensureText(
      baseData.nascimento ||
        baseData.assistido_data_nascimento ||
        formatDateBr(baseData.data_nascimento_assistido) ||
        formatDateBr(baseData.dataNascimentoAssistido) ||
        formatDateBr(baseData.dados_formulario?.assistido_data_nascimento) ||
        formatDateBr(baseData.dados_formulario?.data_nascimento_assistido),
    ),
    rg: ensureText(
      baseData.assistido_rg || baseData.assistido_rg_numero
        ? `${baseData.assistido_rg || baseData.assistido_rg_numero} ${baseData.assistido_rg_orgao || ""}`
        : "",
    ),
    nacionalidade: ensureText(
      normalizeGenderTerm(baseData.assistido_nacionalidade || "brasileiro(a)"),
    ),
  };

  const irmaos = outrosFilhosSafe.map((f) => ({
    nome: ensureText(f.nome),
    cpf: ensureText(f.cpf),
    nascimento: ensureText(formatDateBr(f.dataNascimento)),
    rg: ensureText(f.rgNumero ? `${f.rgNumero} ${f.rgOrgao}` : ""),
    nacionalidade: ensureText(normalizeGenderTerm(f.nacionalidade)),
  }));

  const lista_filhos_raw = [filhoPrincipal, ...irmaos].filter(
    (f) => f.nome && f.nome !== "[PREENCHER]",
  );

  const idades = lista_filhos_raw
    .map((f) => calcularIdade(f.nascimento))
    .filter((age) => age !== null);
  const isPlural = lista_filhos_raw.length > 1;
  const temMenorDe16 = idades.some((idade) => idade < 16);
  const temEntre16e18 = idades.some((idade) => idade >= 16 && idade < 18);

  const lista_filhos = lista_filhos_raw.map((f, index) => {
    const ehUltimo = index === lista_filhos_raw.length - 1;
    return {
      NOME: (f.nome || "").toUpperCase(), // Etiqueta exata do modelo
      nome: (f.nome || "").toUpperCase(),
      qualificacao_incapacidade: "incapaz",
      nacionalidade: f.nacionalidade || "brasileiro(a)",
      nascimento: f.nascimento || "[PREENCHER]",
      " nascimento ": f.nascimento || "[PREENCHER]", // Etiqueta com espaços
      cpf: f.cpf || "não inscrito(a)",
      rg: f.rg || "não informado(a)",
      separador: ehUltimo ? "" : "; ",
    };
  });

  const rotulo_qualificacao = isPlural ? "filhos(as)" : "filho(a)";

  let termo_representacao = "";
  if (baseData.assistido_eh_incapaz === "sim" || temMenorDe16 || temEntre16e18) {
    if (isPlural) {
      if (temMenorDe16 && temEntre16e18)
        termo_representacao = "neste ato representados e assistidos";
      else if (temEntre16e18) termo_representacao = "neste ato assistidos";
      else termo_representacao = "neste ato representados";
    } else {
      // Se for apenas 1 filho ou n filhos de 1 idade só
      const isMenor = idades.length > 0 ? idades[0] < 16 : true;
      termo_representacao = isMenor ? "neste ato representado(a)" : "neste ato assistido(a)";
    }
  }

  // Prevenção para vírgulas duplicadas na geração caso esteja vazio
  if (termo_representacao) {
    termo_representacao = ` ${termo_representacao}`;
  }

  const _assistidoCpf =
    lista_filhos.length > 0
      ? lista_filhos[0].cpf
      : baseData.cpf_assistido || baseData.cpf || normalizedData.requerente_cpf;
  const _dataNascimentoAssistidoBr =
    lista_filhos.length > 0
      ? lista_filhos[0].nascimento
      : formatDateBr(
          baseData.assistido_data_nascimento || normalizedData.requerente?.dataNascimento,
        );

  return {
    lista_filhos,
    rotulo_qualificacao,
    termo_representacao,
  };
};

const buildDocxTemplatePayload = (normalizedData, dosFatosTexto, baseData = {}, acaoKey = "") => {
  const { lista_filhos, rotulo_qualificacao, termo_representacao } =
    processarDadosFilhosParaPeticao(baseData, normalizedData);

  // [CORREÇÃO] Definição de variáveis que estavam faltando e causando erro no background
  const valorMensalParaFixacao = parseCurrencyToNumber(
    baseData.valor_mensal_pensao || baseData.valor_pensao || "0",
  );

  // Se o percentual estiver vazio no baseData, tentamos calcular agora para garantir preenchimento
  let pctSeguro = baseData.percentual_salario_minimo || "";
  if (!pctSeguro && valorMensalParaFixacao > 0) {
    pctSeguro = calcularPercentualSalarioMinimo(valorMensalParaFixacao);
  }

  const hoje = new Date();
  const mesesExtenso = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const dataAtualTexto = `${hoje.getDate()} de ${mesesExtenso[hoje.getMonth()]} de ${hoje.getFullYear()}`;

  const debitoPenhoraCalculado = parseCurrencyToNumber(
    baseData.valor_debito_penhora || baseData.debito_penhora_valor || "0",
  );
  const debitoPrisaoCalculado = parseCurrencyToNumber(
    baseData.valor_debito_prisao || baseData.debito_prisao_valor || "0",
  );

  const debitoPenhoraExtenso =
    debitoPenhoraCalculado > 0 ? numeroParaExtenso(debitoPenhoraCalculado) : "";
  const debitoPrisaoExtenso =
    debitoPrisaoCalculado > 0 ? numeroParaExtenso(debitoPrisaoCalculado) : "";

  // Lógica de Detecção do Débito Total baseada na Minuta Gerada
  // Se for uma minuta específica (penhora ou prisão), o valor_debito deve ser o valor específico.
  // Se for cumulada ou a principal, tentamos usar o valor_debito total ou a soma.
  let debitoCalculado = parseCurrencyToNumber(baseData.valor_debito || "0");

  if (acaoKey.includes("penhora")) {
    debitoCalculado = debitoPenhoraCalculado;
  } else if (acaoKey.includes("prisao")) {
    debitoCalculado = debitoPrisaoCalculado;
  } else if (
    acaoKey.includes("cumulado") ||
    (acaoKey === "execucao_alimentos" && debitoPenhoraCalculado > 0 && debitoPrisaoCalculado > 0)
  ) {
    if (!debitoCalculado) {
      debitoCalculado = debitoPenhoraCalculado + debitoPrisaoCalculado;
    }
  }

  logger.info(
    `[Cálculo Débito] Ação: ${acaoKey} | Débito Final: ${debitoCalculado} (Penhora: ${debitoPenhoraCalculado}, Prisão: ${debitoPrisaoCalculado})`,
  );

  const debitoCalculadoExtenso = debitoCalculado > 0 ? numeroParaExtenso(debitoCalculado) : "";

  // Cálculo do Valor da Causa (Prioriza 12x para fixação, soma de débitos para execução)
  let valorCausaCalculado;

  if (acaoKey === "fixacao_alimentos" || acaoKey === "alimentos_gravidicos") {
    valorCausaCalculado = valorMensalParaFixacao * 12;
    logger.info(
      `[Cálculo Valor Causa] Fixação/Gravídicos: ${valorMensalParaFixacao} * 12 = ${valorCausaCalculado}`,
    );
  } else {
    // Para execuções e outros, soma penhora e prisão se existirem
    valorCausaCalculado = debitoPenhoraCalculado + debitoPrisaoCalculado;
    logger.info(
      `[Cálculo Valor Causa] Execução (Soma): ${debitoPenhoraCalculado} (Penhora) + ${debitoPrisaoCalculado} (Prisão) = ${valorCausaCalculado}`,
    );
    // Se ainda for zero, tenta pegar o valor_debito genérico
    if (valorCausaCalculado <= 0) {
      valorCausaCalculado = parseCurrencyToNumber(baseData.valor_debito || "0");
      logger.info(`[Cálculo Valor Causa] Fallback Valor Débito: ${valorCausaCalculado}`);
    }
  }

  const valorCausaExtenso = valorCausaCalculado > 0 ? numeroParaExtenso(valorCausaCalculado) : "";

  // ────────────────────────────────────────────────────────────────────────────
  // TAGS EXCLUSIVAS DE FIXAÇÃO DE ALIMENTOS
  // valor_causa_fixacao = pensão mensal × 12 (regra obrigatória)
  // valor_mensal_pensao = valor bruto da pensão mensal formatado
  // guarda_convivencia  = texto livre sobre a guarda dos filhos (tag do Word)
  // bens_partilha       = bens a partilhar (tag do Word)
  // situacao_financeira_genitora = situação financeira da genitora (tag do Word)
  // ────────────────────────────────────────────────────────────────────────────
  const isFixacaoOuGravidicos =
    acaoKey === "fixacao_alimentos" || acaoKey === "alimentos_gravidicos";

  // Valor mensal da pensão formatado para o template
  const valorMensalPensaoFormatado =
    valorMensalParaFixacao > 0 ? formatCurrencyBr(valorMensalParaFixacao) : "______";

  // valor_causa_fixacao: SEMPRE calculado pelo backend para fixação (ignora o que vem do banco)
  const valorCausaFixacaoCalculado = isFixacaoOuGravidicos ? valorMensalParaFixacao * 12 : 0;
  const valorCausaFixacaoFormatado =
    valorCausaFixacaoCalculado > 0 ? formatCurrencyBr(valorCausaFixacaoCalculado) : "______";
  const valorCausaFixacaoExtenso =
    valorCausaFixacaoCalculado > 0 ? numeroParaExtenso(valorCausaFixacaoCalculado) : "______";

  // Leitura dos campos de guarda, bens e situação financeira:
  // Prioridade: tabela casos_juridico (atualizada pelo defensor) > dados_formulario (triagem)
  const descricaoGuardaTexto = baseData.descricao_guarda || baseData.descricaoGuarda || "";
  const temPedidoGuarda =
    baseData.opcaoGuarda === "regularizar" ||
    (descricaoGuardaTexto && descricaoGuardaTexto.trim().length > 0);

  const bensPartilhaTexto = baseData.bens_partilha || baseData.bensPartilha || "";
  const situacaoFinanceiraTexto =
    baseData.situacao_financeira_genitora || baseData.situacaoFinanceiraGenitora || "";

  // ── Seção Jurídica Condicional de Guarda ──────────────
  // O texto jurídico agora deve ser colocado diretamente no Word envolto em {#HAS_GUARDA} ... {/HAS_GUARDA}
  // para preservar a formatação (negritos, parágrafos, etc).
  const HAS_GUARDA = temPedidoGuarda;

  // ── Injeção de cláusula de Guarda e Convivência no dos_fatos ──────────────
  // Se o campo descricaoGuarda estiver preenchido, acrescenta ao final dos
  // fatos um parágrafo jurídico padrão para não precisar alterar o .docx.
  // A tag {dos_fatos} no Word absorve todo o texto.
  let dosFatosComGuarda = dosFatosTexto || "[DESCREVER OS FATOS]";
  if (isFixacaoOuGravidicos && descricaoGuardaTexto && descricaoGuardaTexto.trim()) {
    const clausulaGuarda = `\n\nSobre a guarda e convivência: ${descricaoGuardaTexto.trim()}`;
    // Evita duplicar o parágrafo se já estiver presente (reprocessamento)
    if (!dosFatosComGuarda.includes("Sobre a guarda e convivência:")) {
      dosFatosComGuarda = dosFatosComGuarda + clausulaGuarda;
    }
  }

  // 1:1 Mapeamento Total focado estritamente no TAGS_OFICIAIS.js
  const payload = {};

  // 1. Inicializa todas as tags oficiais com valor do banco ou fallback
  TAGS_OFICIAIS.forEach((tag) => {
    payload[tag] = baseData[tag] ?? "______";
  });

  // 2. Aplica Sobrescritas (Overrides) com lógica específica de formatação
  const specificOverrides = {
    protocolo: baseData.protocolo || normalizedData.triagemNumero || normalizedData.protocolo || "",
    triagemNumero:
      baseData.protocolo || normalizedData.triagemNumero || normalizedData.protocolo || "",

    // Globais
    VARA: formatVara(baseData.VARA || baseData.varaOriginaria || "______"),
    vara: formatVara(baseData.VARA || baseData.varaOriginaria || "______"),
    CIDADEASSINATURA: String(
      baseData.CIDADEASSINATURA || baseData.cidade_assinatura || "Não informada",
    ).toUpperCase(),
    comarca: String(
      baseData.CIDADEASSINATURA || baseData.cidade_assinatura || "Não informada",
    ).toUpperCase(),
    tipo_decisao: baseData.tipo_decisao || "Sentença/Acordo",
    processoOrigemNumero: baseData.processoOrigemNumero || "Não informado",
    varaOriginaria: formatVara(baseData.varaOriginaria || "______"),
    cidadeOriginaria: baseData.cidadeOriginaria || "Não informada",
    data_atual: baseData.data_atual || dataAtualTexto,
    DATA_ATUAL: baseData.data_atual || dataAtualTexto,
    cidade_data_assinatura:
      baseData.cidadeDataAssinatura ||
      baseData.cidade_assinatura ||
      `${String(baseData.CIDADEASSINATURA || baseData.cidade_assinatura || "______").toUpperCase()}, ${dataAtualTexto}`,
    defensoraNome: baseData.defensoraNome || "DEFENSOR(A) PÚBLICO(A)",

    // Título Dinâmico da Ação (Multi-tag para evitar undefined no Word)
    tipo_acao: (() => {
      if (isFixacaoOuGravidicos) {
        let titulo = "AÇÃO DE FIXAÇÃO DE ALIMENTOS COM PEDIDO DE ALIMENTOS PROVISÓRIOS";
        if (temPedidoGuarda) {
          titulo += " E FIXAÇÃO DE GUARDA C/C DIREITO DE CONVIVÊNCIA";
        }
        return titulo.toUpperCase();
      }

      const mapaAmigavel = {
        exec_penhora: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PENHORA",
        exec_prisao: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PRISÃO",
        exec_cumulado: "EXECUÇÃO DE ALIMENTOS (RITOS DA PRISÃO E PENHORA)",
        def_penhora: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PENHORA",
        def_prisao: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PRISÃO",
        def_cumulado: "CUMPRIMENTO DE SENTENÇA (RITOS DA PRISÃO E PENHORA)",
      };

      const baseAcao = (
        baseData.tipo_acao ||
        baseData.acao_especifica ||
        baseData.tipoAcao ||
        ""
      ).toLowerCase();
      return (mapaAmigavel[baseAcao] || baseAcao || "PETIÇÃO INICIAL").toUpperCase();
    })(),
    TIPO_ACAO: (() => {
      if (isFixacaoOuGravidicos) {
        let titulo = "AÇÃO DE FIXAÇÃO DE ALIMENTOS COM PEDIDO DE ALIMENTOS PROVISÓRIOS";
        if (temPedidoGuarda) {
          titulo += " E FIXAÇÃO DE GUARDA C/C DIREITO DE CONVIVÊNCIA";
        }
        return titulo.toUpperCase();
      }

      const mapaAmigavel = {
        exec_penhora: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PENHORA",
        exec_prisao: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PRISÃO",
        exec_cumulado: "EXECUÇÃO DE ALIMENTOS (RITOS DA PRISÃO E PENHORA)",
        def_penhora: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PENHORA",
        def_prisao: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PRISÃO",
        def_cumulado: "CUMPRIMENTO DE SENTENÇA (RITOS DA PRISÃO E PENHORA)",
      };

      const baseAcao = (
        baseData.tipo_acao ||
        baseData.acao_especifica ||
        baseData.tipoAcao ||
        ""
      ).toLowerCase();
      return (mapaAmigavel[baseAcao] || baseAcao || "PETIÇÃO INICIAL").toUpperCase();
    })(),
    tipoAcao: (() => {
      if (isFixacaoOuGravidicos) {
        let titulo = "AÇÃO DE FIXAÇÃO DE ALIMENTOS COM PEDIDO DE ALIMENTOS PROVISÓRIOS";
        if (temPedidoGuarda) {
          titulo += " E FIXAÇÃO DE GUARDA C/C DIREITO DE CONVIVÊNCIA";
        }
        return titulo.toUpperCase();
      }

      const mapaAmigavel = {
        exec_penhora: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PENHORA",
        exec_prisao: "EXECUÇÃO DE ALIMENTOS PELO RITO DA PRISÃO",
        exec_cumulado: "EXECUÇÃO DE ALIMENTOS (RITOS DA PRISÃO E PENHORA)",
        def_penhora: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PENHORA",
        def_prisao: "CUMPRIMENTO DE SENTENÇA PELO RITO DA PRISÃO",
        def_cumulado: "CUMPRIMENTO DE SENTENÇA (RITOS DA PRISÃO E PENHORA)",
      };

      const baseAcao = (
        baseData.tipo_acao ||
        baseData.acao_especifica ||
        baseData.tipoAcao ||
        ""
      ).toLowerCase();
      return (mapaAmigavel[baseAcao] || baseAcao || "PETIÇÃO INICIAL").toUpperCase();
    })(),

    HAS_GUARDA,
    termo_representacao,
    // dos_fatos já inclui a cláusula de guarda se aplicável (ver lógica acima)
    dos_fatos: ensureText(dosFatosComGuarda, "[DESCREVER OS FATOS]"),

    // Representante (Genitora) / Requerente
    // Requerente (Assistido/Criança)
    requerente_nome: String(
      baseData.nome_assistido || baseData.NOME || baseData.nome || "______",
    ).toUpperCase(),
    requerente_data_nascimento: baseData.assistido_data_nascimento || "______",
    requerente_cpf: baseData.cpf_assistido || "Não inscrito(a)",
    dados_adicionais_requerente:
      baseData.dados_adicionais_requerente || "Nenhuma informação adicional",

    // Representante (Genitora)
    REPRESENTANTE_NOME: String(baseData.REPRESENTANTE_NOME || "______").toUpperCase(),
    representante_nome: String(
      baseData.REPRESENTANTE_NOME || baseData.nome_representante || "______",
    ).toUpperCase(),
    representante_nacionalidade: baseData.representante_nacionalidade || "brasileira",
    representante_estado_civil: baseData.representante_estado_civil || "solteira",
    representante_ocupacao: baseData.representante_ocupacao || "Não informada",
    representante_rg:
      baseData.representante_rg || baseData.representante_rg_numero || "Não informado",
    representante_rg_numero:
      baseData.representante_rg_numero || baseData.representante_rg || "Não informado",
    emissor_rg_exequente:
      baseData.emissor_rg_exequente || baseData.representante_rg_orgao || "Não informado",
    representante_rg_orgao:
      baseData.representante_rg_orgao || baseData.emissor_rg_exequente || "Não informado",
    representante_cpf: baseData.representante_cpf || "Não informado",
    nome_mae_representante: baseData.nome_mae_representante || "Não informado",
    nome_pai_representante: baseData.nome_pai_representante || "Não informado",
    requerente_endereco_residencial:
      baseData.requerente_endereco_residencial || baseData.endereco_assistido || "Não informado",
    representante_endereco_profissional:
      baseData.representante_endereco_profissional || "Não informado",
    requerente_telefone: baseData.requerente_telefone || "Não informado",
    representante_telefone:
      baseData.representante_telefone || baseData.telefone_assistido || "Não informado",
    requerente_email: baseData.requerente_email || "Não informado",
    dados_bancarios_exequente:
      baseData.dados_bancarios_exequente || baseData.dados_bancarios_deposito || "Não informados",
    dados_bancarios_requerente:
      baseData.dados_bancarios_exequente || baseData.dados_bancarios_deposito || "Não informados",

    // Requerido (Pai)
    REQUERIDO_NOME: String(baseData.REQUERIDO_NOME || "______").toUpperCase(),
    requerido_nome: String(
      baseData.REQUERIDO_NOME || baseData.nome_requerido || "______",
    ).toUpperCase(),
    executado_nacionalidade: baseData.executado_nacionalidade || "brasileiro(a)",
    executado_estado_civil: baseData.executado_estado_civil || "solteiro(a)",
    executado_ocupacao: baseData.executado_ocupacao || "Não informada",
    nome_mae_executado: baseData.nome_mae_executado || "Não informado",
    nome_pai_executado: baseData.nome_pai_executado || "Não informado",
    rg_executado: baseData.rg_executado || baseData.requerido_rg_numero || "Não informado",
    requerido_rg_numero: baseData.requerido_rg_numero || baseData.rg_executado || "Não informado",
    emissor_rg_executado:
      baseData.emissor_rg_executado || baseData.requerido_rg_orgao || "Não informado",
    requerido_rg_orgao:
      baseData.requerido_rg_orgao || baseData.emissor_rg_exequente || "Não informado",
    executado_cpf: baseData.executado_cpf || baseData.cpf_requerido || "Não informado",
    cpf_requerido: baseData.cpf_requerido || baseData.executado_cpf || "Não informado",
    executado_endereco_residencial: baseData.executado_endereco_residencial || "Não informado",
    requerido_endereco_residencial:
      baseData.endereco_requerido || baseData.executado_endereco_residencial || "Não informado",
    executado_endereco_profissional: baseData.executado_endereco_profissional || "Não informado",
    executado_telefone: baseData.executado_telefone || "Não informado",
    executado_email: baseData.executado_email || "Não informado",
    empregador_nome: baseData.empregador_nome || "Não informado",
    dados_adicionais_requerido:
      baseData.dados_adicionais_requerido || "Nenhuma informação adicional",

    // Filhos / Assistidos
    lista_filhos,
    rotulo_qualificacao,
    NOME: String(baseData.NOME || "______").toUpperCase(),
    nascimento: baseData.nascimento || baseData.assistido_data_nascimento || "______",
    cpf: baseData.cpf || baseData.cpf_assistido || "______",

    // Valores e Prazos
    valor_pensao:
      baseData.valor_pensao ||
      (valorMensalParaFixacao > 0 ? formatCurrencyBr(valorMensalParaFixacao) : "______"),
    percentual_salario_minimo: pctSeguro || "______",
    percentual_provisorio_salario_min: pctSeguro || baseData.percentual_salario_minimo || "______",
    percentual_despesas_extras: baseData.percentual_definitivo_extras || "______",
    percentual_definitivo_salario_min:
      baseData.percentual_definitivo_salario_min || pctSeguro || "______",
    empregador_endereco_profissional:
      baseData.empregador_endereco || baseData.empregador_requerido_endereco || "______",
    empregador_email: baseData.empregador_email || "",
    dia_pagamento: baseData.dia_pagamento || "______",
    periodo_meses_ano:
      baseData.periodo_meses_ano ||
      (() => {
        const formatMonthYear = (str) => {
          if (!str || !str.includes("/")) return str;
          const [m, a] = str.split("/");
          const monthIndex = parseInt(m, 10) - 1;
          if (monthIndex >= 0 && monthIndex < 12) {
            const monthName = mesesExtenso[monthIndex];
            return monthName.charAt(0).toUpperCase() + monthName.slice(1) + "/" + a;
          }
          return str;
        };
        if (baseData.data_inicio_debito && baseData.data_fim_debito) {
          return `${formatMonthYear(baseData.data_inicio_debito)} a ${formatMonthYear(baseData.data_fim_debito)}`;
        }
        return "______";
      })(),
    valor_debito:
      baseData.valor_debito || (debitoCalculado > 0 ? formatCurrencyBr(debitoCalculado) : "______"),
    valor_debito_extenso: baseData.valor_debito_extenso || debitoCalculadoExtenso || "______",
    valor_debito_penhora:
      baseData.valor_debito_penhora ||
      baseData.debito_penhora_valor ||
      (debitoPenhoraCalculado > 0 ? formatCurrencyBr(debitoPenhoraCalculado) : "______"),
    valor_debito_penhora_extenso:
      baseData.valor_debito_penhora_extenso ||
      baseData.debito_penhora_extenso ||
      debitoPenhoraExtenso ||
      "______",
    valor_debito_prisao:
      baseData.valor_debito_prisao ||
      baseData.debito_prisao_valor ||
      (debitoPrisaoCalculado > 0 ? formatCurrencyBr(debitoPrisaoCalculado) : "______"),
    valor_debito_prisao_extenso:
      baseData.valor_debito_prisao_extenso ||
      baseData.debito_prisao_extenso ||
      debitoPrisaoExtenso ||
      "______",
    // valor_causa: para fixação, SEMPRE usa o cálculo x12 do backend (regra de negócio inegociável).
    // Para execuções e cumprimentos, usa a soma dos débitos ou o valor informado.
    valor_causa: isFixacaoOuGravidicos
      ? valorCausaFixacaoCalculado > 0
        ? formatCurrencyBr(valorCausaFixacaoCalculado)
        : "______"
      : baseData.valor_causa ||
        (valorCausaCalculado > 0 ? formatCurrencyBr(valorCausaCalculado) : "______"),
    valor_causa_extenso: isFixacaoOuGravidicos
      ? valorCausaFixacaoExtenso
      : baseData.valor_causa_extenso || valorCausaExtenso || "______",

    // ── Tags exclusivas de Fixação de Alimentos (adicione ao .docx conforme necessário) ──
    // {valor_mensal_pensao}         → valor bruto da pensão mensal (ex: R$ 500,00)
    // {valor_causa_fixacao}         → valor da causa = pensão × 12 (ex: R$ 6.000,00)
    // {valor_causa_fixacao_extenso} → valor_causa_fixacao por extenso
    // {guarda_convivencia}          → texto livre sobre a guarda dos filhos
    // {bens_partilha}               → bens a partilhar
    // {situacao_financeira_genitora}→ situação financeira de quem cuida dos filhos
    valor_mensal_pensao: valorMensalPensaoFormatado,
    valor_causa_fixacao: valorCausaFixacaoFormatado,
    valor_causa_fixacao_extenso: valorCausaFixacaoExtenso,
    guarda_convivencia: descricaoGuardaTexto || "",
    bens_partilha: bensPartilhaTexto || "",
    situacao_financeira_genitora: situacaoFinanceiraTexto || "",
    relato_texto: (baseData.relato_texto || dosFatosTexto || "").replace(/\n/g, "\r\n"),
  };

  // 3. Mescla o mapeamento básico com as sobrescritas lógicas
  Object.assign(payload, specificOverrides);

  // Limpa 'undefined' ou 'null'
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null) {
      payload[key] = "";
    }
  });

  return payload;
};

const gerarTextoCompletoPeticao = (payload) => {
  const {
    vara,
    comarca,
    requerente_nome,
    requerente_nacionalidade,
    requerente_estado_civil,
    requerente_ocupacao,
    requerente_cpf,
    requerente_rg,
    requerente_endereco_residencial,
    representante_nome,
    representante_nacionalidade,
    representante_estado_civil,
    representante_ocupacao,
    representante_cpf,
    representante_rg,
    representante_endereco_residencial,
    requerido_nome,
    requerido_nacionalidade,
    requerido_estado_civil,
    requerido_ocupacao,
    requerido_cpf,
    requerido_endereco_residencial,
    dos_fatos,
    tipo_acao,
    valor_causa,
  } = payload;

  let texto = `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ${vara?.toUpperCase() || "[VARA]"} DA COMARCA DE ${comarca?.toUpperCase() || "[COMARCA]"}\n\n`;

  texto += `REQUERENTE: ${requerente_nome?.toUpperCase() || "[NOME REQUERENTE]"}`;
  if (representante_nome) {
    texto += `, representado(a) por ${representante_nome?.toUpperCase() || "[NOME REPRESENTANTE]"}`;
  }
  texto += `\nREQUERIDO: ${requerido_nome?.toUpperCase() || "[NOME REQUERIDO]"}\n\n`;

  texto += `AÇÃO: ${tipo_acao?.toUpperCase() || "[TIPO DA AÇÃO]"}\n\n`;

  texto += `QUALIFICAÇÃO DAS PARTES:\n`;
  texto += `${requerente_nome}, ${requerente_nacionalidade || "[nacionalidade]"}, ${requerente_estado_civil || "[estado civil]"}, ${requerente_ocupacao || "[profissão]"}, inscrito(a) no CPF sob o nº ${requerente_cpf || "[CPF]"}, portador(a) do RG nº ${requerente_rg || "[RG]"}, residente e domiciliado(a) em ${requerente_endereco_residencial || "[endereço]"}.\n`;

  if (representante_nome) {
    texto += `REPRESENTANTE LEGAL: ${representante_nome}, ${representante_nacionalidade || "[nacionalidade]"}, ${representante_estado_civil || "[estado civil]"}, ${representante_ocupacao || "[profissão]"}, inscrito(a) no CPF sob o nº ${representante_cpf || "[CPF]"}, portador(a) do RG nº ${representante_rg || "[RG]"}, residente e domiciliado(a) em ${representante_endereco_residencial || "[endereço]"}.\n`;
  }

  texto += `\nEM FACE DE: ${requerido_nome}, ${requerido_nacionalidade || "[nacionalidade]"}, ${requerido_estado_civil || "[estado civil]"}, ${requerido_ocupacao || "[profissão]"}, inscrito(a) no CPF sob o nº ${requerido_cpf || "[CPF]"}, residente e domiciliado(a) em ${requerido_endereco_residencial || "[endereço]"}.\n\n`;

  texto += `DOS FATOS\n\n${dos_fatos || "[Descrever os fatos]"}\n\n`;

  texto += `DOS PEDIDOS\n\n`;
  texto += `Diante do exposto, requer:\n`;
  texto += `1. A concessão da gratuidade da justiça;\n`;
  texto += `2. A citação da parte requerida;\n`;
  texto += `3. A procedência total da ação.\n\n`;

  texto += `Dá-se à causa o valor de ${valor_causa || "R$ 0,00"}.\n\n`;
  texto += `Nestes termos,\n`;
  texto += `Pede Deferimento.\n\n`;
  texto += `${comarca || "[Cidade]"}, ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}.`;

  return texto;
};

// --- WORKER EM BACKGROUND ---
export const processarCasoEmBackground = async (
  protocolo,
  dados_formulario,
  urls_documentos,
  url_audio,
  url_peticao,
) => {
  try {
    const casoAtual = await prisma.casos.findUnique({
      where: { protocolo },
      select: { status: true },
    });
    const statusOriginal = casoAtual?.status || "documentacao_completa";

    logger.info(
      `[Background] Iniciando processamento do protocolo=${protocolo}. Status original: ${statusOriginal}`,
    );

    // Mesmo sem documentos, casos enviados como "sem documento" devem gerar minuta.
    // O processamento segue com urls_documentos vazias e usa apenas os dados do formulário.
    // Extrair a chave do dicionário enviada pelo frontend
    let acaoRaw =
      dados_formulario.acaoEspecifica ||
      (dados_formulario.tipoAcao || "").split(" - ")[1]?.trim() ||
      (dados_formulario.tipoAcao || "").trim() ||
      "";

    // Normalização básica: converte para snake_case se vier com espaços ou camelCase
    const acaoKey = normalizeAcaoKey(acaoRaw);
    logger.info(`[Background] Processando protocolo=${protocolo} | acaoKey="${acaoKey}"`);

    await prisma.casos.update({
      where: { protocolo },
      data: { status: "processando_ia", updated_at: new Date() },
    });

    const casoRaw = await prisma.casos.findUnique({
      where: { protocolo },
      include: { partes: true, ia: true, juridico: true },
    });
    const caso = mapCasoRelations(casoRaw);
    if (!caso) throw new Error("Caso não encontrado no Prisma");

    // Obter configuração da ação
    const { getConfigAcaoBackend } = await import("../config/dicionarioAcoes.js");
    const configAcao = getConfigAcaoBackend(acaoKey);

    // OCR / Leitura de Documentos
    let textoCompleto = caso.relato_texto || "";
    let resumo_ia = null;
    let dosFatosTexto = "";

    // Desativação total de OCR para ganho de performance e privacidade no mutirão
    // Como os documentos agora são etiquetados manualmente no scanner, o OCR não é essencial
    // para a identificação do tipo de arquivo.
    const deveIgnorarIA = true;
    const deveIgnorarOCR = true;

    if (!deveIgnorarIA && !deveIgnorarOCR) {
      // Loop de OCR removido para otimização do mutirão
    } else {
      logger.info(
        `[Background] OCR desativado para garantir privacidade absoluta. Processando apenas metadados.`,
      );
    }

    // Formatação de Dados
    // Garante que a data de nascimento não seja formatada se estiver vazia ou inválida
    const rawAssistidoNascimento =
      dados_formulario.assistido_data_nascimento || dados_formulario.data_nascimento_assistido;
    const formattedAssistidoNascimento = rawAssistidoNascimento
      ? formatDateBr(rawAssistidoNascimento)
      : "";

    const formattedDataInicioRelacao = formatDateBr(dados_formulario.data_inicio_relacao);
    const formattedDataSeparacao = formatDateBr(dados_formulario.data_separacao);
    const formattedDiaPagamentoRequerido = formatDateBr(dados_formulario.dia_pagamento_requerido);
    const formattedDiaPagamentoFixado = formatDateBr(dados_formulario.dia_pagamento_fixado);
    const formattedValorPensao = formatCurrencyBr(
      dados_formulario.valor_mensal_pensao || dados_formulario.valor_pensao,
    );
    // [CORREÇÃO] Calculando o valor formatado que faltava
    const formattedValorTotalDebitoExecucao = formatCurrencyBr(
      dados_formulario.valor_total_debito_execucao,
    );
    const percentualSalarioMinimoCalculado = calcularPercentualSalarioMinimo(
      dados_formulario.valor_mensal_pensao || dados_formulario.valor_pensao,
    );

    // [NOVO] Cálculo dinâmico para valor_causa no background
    const penhoraVal = parseCurrencyToNumber(dados_formulario.debito_penhora_valor);
    const prisaoVal = parseCurrencyToNumber(dados_formulario.debito_prisao_valor);
    let valorCausaVal = penhoraVal + prisaoVal;

    if (acaoKey === "fixacao_alimentos" || acaoKey === "alimentos_gravidicos") {
      valorCausaVal = _calcularValorCausa(
        dados_formulario.valor_mensal_pensao || dados_formulario.valor_pensao,
      );
      logger.info(
        `[Cálculo Background] Ação: ${acaoKey} | Pensão: ${dados_formulario.valor_mensal_pensao || dados_formulario.valor_pensao} | Valor Causa: ${valorCausaVal} | %: ${percentualSalarioMinimoCalculado}`,
      );
    }
    const valorCausaExtenso = valorCausaVal > 0 ? numeroParaExtenso(valorCausaVal) : "";

    const documentosInformadosArray = safeJsonParse(dados_formulario.documentos_informados, []);
    const varaMapeada = getVaraByTipoAcao(dados_formulario.tipoAcao);
    const varaAutomatica =
      varaMapeada && !varaMapeada.includes("NÃO ESPECIFICADA") ? varaMapeada : null;

    const caseDataForPetitionRaw = {
      ...dados_formulario, // Injeção de todas as TAGS do dicionarioTags enviadas pelo Frontend
      protocolo,
      nome_assistido: dados_formulario.nome,
      cpf_assistido: dados_formulario.cpf,
      telefone_assistido: dados_formulario.telefone,
      tipo_acao: dados_formulario.tipoAcao,
      acao_especifica:
        (dados_formulario.tipoAcao || "").split(" - ")[1]?.trim() ||
        (dados_formulario.tipoAcao || "").trim(),
      relato_texto: textoCompleto,
      documentos_informados: documentosInformadosArray,
      resumo_ia,
      vara: varaAutomatica || dados_formulario.vara_originaria,
      endereco_assistido: dados_formulario.endereco_assistido,
      email_assistido: dados_formulario.email_assistido,
      dados_adicionais_requerente: dados_formulario.dados_adicionais_requerente,
      assistido_eh_incapaz: dados_formulario.assistido_eh_incapaz,
      assistido_nacionalidade: dados_formulario.assistido_nacionalidade,
      assistido_estado_civil: dados_formulario.assistido_estado_civil,
      assistido_ocupacao: dados_formulario.assistido_ocupacao,
      assistido_data_nascimento: formattedAssistidoNascimento,
      assistido_rg_numero: dados_formulario.assistido_rg_numero,
      assistido_rg_orgao: dados_formulario.assistido_rg_orgao,
      // Mapeamento do campo data_nascimento_assistido (frontend) → assistido_data_nascimento (backend)
      data_nascimento_assistido:
        dados_formulario.data_nascimento_assistido || dados_formulario.assistido_data_nascimento,
      representante_nome: dados_formulario.representante_nome,
      representante_nacionalidade: dados_formulario.representante_nacionalidade,
      representante_estado_civil: dados_formulario.representante_estado_civil,
      representante_ocupacao: dados_formulario.representante_ocupacao,
      representante_cpf: dados_formulario.representante_cpf,
      representante_endereco_residencial: dados_formulario.representante_endereco_residencial,
      representante_endereco_profissional: dados_formulario.representante_endereco_profissional,
      representante_email: dados_formulario.representante_email,
      representante_telefone: dados_formulario.representante_telefone,
      representante_rg_numero: dados_formulario.representante_rg_numero,
      representante_rg_orgao: dados_formulario.representante_rg_orgao,
      representante_nome_mae: dados_formulario.representante_nome_mae,
      representante_nome_pai: dados_formulario.representante_nome_pai,
      nome_requerido: dados_formulario.nome_requerido,
      cpf_requerido: dados_formulario.cpf_requerido,
      requerido_rg_numero: dados_formulario.requerido_rg_numero,
      requerido_rg_orgao: dados_formulario.requerido_rg_orgao,
      endereco_requerido: dados_formulario.endereco_requerido,
      dados_adicionais_requerido: dados_formulario.dados_adicionais_requerido,
      requerido_nacionalidade: dados_formulario.requerido_nacionalidade,
      requerido_estado_civil: dados_formulario.requerido_estado_civil,
      requerido_ocupacao: dados_formulario.requerido_ocupacao,
      requerido_nome_mae: dados_formulario.requerido_nome_mae,
      requerido_nome_pai: dados_formulario.requerido_nome_pai,
      requerido_endereco_profissional: dados_formulario.requerido_endereco_profissional,
      requerido_email: dados_formulario.email_requerido || dados_formulario.requerido_email,
      requerido_telefone:
        dados_formulario.telefone_requerido || dados_formulario.requerido_telefone,
      telefone_requerido:
        dados_formulario.telefone_requerido || dados_formulario.requerido_telefone,
      email_requerido: dados_formulario.email_requerido || dados_formulario.requerido_email,
      filhos_info: dados_formulario.filhos_info,
      data_inicio_relacao: formattedDataInicioRelacao,
      data_separacao: formattedDataSeparacao,
      bens_partilha: dados_formulario.bens_partilha,
      descricao_guarda: dados_formulario.descricao_guarda,
      situacao_financeira_genitora: dados_formulario.situacao_financeira_genitora,
      processo_titulo_numero: dados_formulario.processo_titulo_numero,
      cidade_assinatura: dados_formulario.cidade_assinatura,
      cidadeDataAssinatura: dados_formulario.cidade_assinatura,
      valor_total_extenso: dados_formulario.valor_total_extenso,
      valor_debito_extenso: dados_formulario.valor_debito_extenso,
      valor_debito_penhora: dados_formulario.debito_penhora_valor,
      valor_debito_penhora_extenso: dados_formulario.debito_penhora_extenso,
      valor_debito_prisao: dados_formulario.debito_prisao_valor,
      valor_debito_prisao_extenso: dados_formulario.debito_prisao_extenso,
      valor_causa: valorCausaVal > 0 ? formatCurrencyBr(valorCausaVal) : null,
      valor_causa_extenso: valorCausaExtenso,
      percentual_definitivo_salario_min: dados_formulario.percentual_definitivo_salario_min,
      percentual_definitivo_extras: dados_formulario.percentual_definitivo_extras,
      valor_pensao: formattedValorPensao,
      valor_pensao_solicitado: formattedValorPensao,
      valor_mensal_pensao: dados_formulario.valor_mensal_pensao || dados_formulario.valor_pensao,
      percentual_salario_minimo:
        dados_formulario.percentual_salario_minimo || percentualSalarioMinimoCalculado,
      salario_minimo_atual: salarioMinimoAtual,
      salario_minimo_formatado: formatCurrencyBr(salarioMinimoAtual),
      valor_salario_minimo: formatCurrencyBr(salarioMinimoAtual),
      dia_pagamento_requerido: formattedDiaPagamentoRequerido,
      dados_bancarios_deposito: dados_formulario.dados_bancarios_deposito,
      requerido_tem_emprego_formal: dados_formulario.requerido_tem_emprego_formal,
      empregador_requerido_nome: dados_formulario.empregador_requerido_nome,
      empregador_requerido_endereco: dados_formulario.empregador_requerido_endereco,
      empregador_email: dados_formulario.empregador_email,
      numero_processo_originario: dados_formulario.numero_processo_originario,
      vara_originaria: dados_formulario.vara_originaria,
      cidade_originaria: dados_formulario.cidade_originaria,
      percentual_ou_valor_fixado: dados_formulario.percentual_ou_valor_fixado,
      dia_pagamento_fixado: formattedDiaPagamentoFixado,
      tipo_decisao: dados_formulario.tipo_decisao,
      valor_multa: dados_formulario.valor_multa,
      valor_juros: dados_formulario.valor_juros,
      valor_honorarios: dados_formulario.valor_honorarios,
      periodo_debito_execucao:
        dados_formulario.periodo_debito_execucao || dados_formulario.periodo_debito,
      periodo_debito:
        dados_formulario.periodo_meses_ano ||
        dados_formulario.periodo_debito ||
        dados_formulario.periodo_debito_execucao,
      valor_total_debito_execucao: formattedValorTotalDebitoExecucao,
      regime_bens: dados_formulario.regime_bens,
      retorno_nome_solteira: dados_formulario.retorno_nome_solteira,
      alimentos_para_ex_conjuge: dados_formulario.alimentos_para_ex_conjuge,
      outros_filhos_detalhes: dados_formulario.outros_filhos_detalhes, // Adicionando o campo que faltava
    };

    // [EIXO 3] Preparação do Payload para Geração de Documentos
    // Buscamos o caso completo com as relações para garantir que usaremos os dados oficiais das tabelas
    const casoParaPayload = await prisma.casos.findUnique({
      where: { protocolo },
      include: { partes: true, ia: true, juridico: true, unidade: true },
    });

    const enrichedCaso = mapCasoRelations(casoParaPayload);

    // Atualizamos caseDataForPetition com os dados enriquecidos (oficiais)
    const officialBaseData = enrichedCaso.dados_formulario || {};

    // Prevenção de perda de dados: Limpa chaves vazias vindas do banco para que não esmaguem dados preenchidos no Reprocessar
    const cleanOfficialBaseData = {};
    for (const key in officialBaseData) {
      if (
        officialBaseData[key] !== "" &&
        officialBaseData[key] !== null &&
        officialBaseData[key] !== undefined
      ) {
        cleanOfficialBaseData[key] = officialBaseData[key];
      }
    }

    const caseDataForPetition = sanitizeCaseDataInlineFields({
      ...caseDataForPetitionRaw,
      ...cleanOfficialBaseData,
    });

    try {
      if (configAcao.ignorarDosFatos) {
        dosFatosTexto = "";
      } else {
        // Agora generateDosFatos recebe os dados oficiais (nomes corretos!)
        dosFatosTexto = await generateDosFatos(caseDataForPetition, acaoKey);
      }
    } catch (dosFatosError) {
      logger.warn(`Falha ao gerar Dos Fatos IA: ${dosFatosError.message}`);
      dosFatosTexto = buildFallbackDosFatos(caseDataForPetition);
    }

    // Gerar DOCX
    let url_documento_gerado = null;
    let url_peticao_penhora = null;
    let url_peticao_prisao = null;
    let url_peticao_cumulado = null;
    const urlsDocumentosGerados = {};

    const normalizedData = {
      comarca:
        enrichedCaso.unidade?.comarca ||
        process.env.DEFENSORIA_DEFAULT_COMARCA ||
        "Teixeira de Freitas/BA",
      defensoraNome:
        process.env.DEFENSORIA_DEFAULT_DEFENSORA || "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA",
      triagemNumero: protocolo,
    };

    const docxData = buildDocxTemplatePayload(
      normalizedData,
      dosFatosTexto,
      caseDataForPetition,
      acaoKey,
    );

    try {
      if (configAcao.gerarMultiplos) {
        const periodoParaCalculo =
          caseDataForPetition.periodo_meses_ano ||
          caseDataForPetition.periodo_debito_execucao ||
          caseDataForPetition.periodo_debito ||
          "";
        logger.info(`[DOCX Multi] Período para cálculo: "${periodoParaCalculo}"`);
        const docs = await generateMultiplosDocx(docxData, acaoKey, periodoParaCalculo);
        for (const doc of docs) {
          const docxPath = `${protocolo}/${doc.filename}`;
          if (isSupabaseConfigured) {
            const { error: uploadDocxErr } = await supabase.storage
              .from("peticoes")
              .upload(docxPath, doc.buffer, {
                contentType:
                  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                upsert: true,
              });

            if (!uploadDocxErr) {
              const extraKey = DOC_URL_KEY_BY_TIPO[doc.tipo];
              if (extraKey) urlsDocumentosGerados[extraKey] = docxPath;
              if (doc.tipo === "execucao_penhora" || doc.tipo === "penhora")
                url_peticao_penhora = docxPath;
              if (doc.tipo === "execucao_prisao" || doc.tipo === "prisao")
                url_peticao_prisao = docxPath;
              if (doc.tipo === "execucao_cumulado" || doc.tipo === "cumulado")
                url_peticao_cumulado = docxPath;
            } else {
              logger.error(
                `[Supabase] Erro ao fazer upload da minuta ${doc.tipo}: ${uploadDocxErr.message}`,
              );
              const localDir = path.resolve("uploads", "peticoes", protocolo);
              await fs.mkdir(localDir, { recursive: true });
              await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
              const extraKey = DOC_URL_KEY_BY_TIPO[doc.tipo];
              if (extraKey) urlsDocumentosGerados[extraKey] = docxPath;
              if (doc.tipo === "execucao_penhora" || doc.tipo === "penhora")
                url_peticao_penhora = docxPath;
              if (doc.tipo === "execucao_prisao" || doc.tipo === "prisao")
                url_peticao_prisao = docxPath;
              if (doc.tipo === "execucao_cumulado" || doc.tipo === "cumulado")
                url_peticao_cumulado = docxPath;
              logger.info(`[Local Fallback] DOCX ${doc.tipo} salvo em ${localDir}/${doc.filename}`);
            }
          } else {
            // Fallback: salva localmente
            const localDir = path.resolve("uploads", "peticoes", protocolo);
            await fs.mkdir(localDir, { recursive: true });
            await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
            const extraKey = DOC_URL_KEY_BY_TIPO[doc.tipo];
            if (extraKey) urlsDocumentosGerados[extraKey] = docxPath;
            if (doc.tipo === "execucao_penhora" || doc.tipo === "penhora")
              url_peticao_penhora = docxPath;
            if (doc.tipo === "execucao_prisao" || doc.tipo === "prisao")
              url_peticao_prisao = docxPath;
            if (doc.tipo === "execucao_cumulado" || doc.tipo === "cumulado")
              url_peticao_cumulado = docxPath;
            logger.info(`[Local] DOCX ${doc.tipo} salvo em ${localDir}/${doc.filename}`);
          }
        }
        // URL principal: prioriza o rito cumulado de execucao.
        url_documento_gerado = url_peticao_cumulado || url_peticao_penhora || url_peticao_prisao;
      } else {
        const docxBuffer = await generateDocx(docxData, acaoKey);
        const docxPath = `${protocolo}/peticao_inicial_${protocolo}.docx`;
        if (isSupabaseConfigured) {
          const { error: uploadDocxErr } = await supabase.storage
            .from("peticoes")
            .upload(docxPath, docxBuffer, {
              contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: true,
            });
          if (!uploadDocxErr) {
            url_documento_gerado = docxPath;
            url_peticao_penhora = docxPath;
          } else {
            logger.error(
              `[Supabase] Erro ao fazer upload da minuta única: ${uploadDocxErr.message}`,
            );
            const localDir = path.resolve("uploads", "peticoes", protocolo);
            await fs.mkdir(localDir, { recursive: true });
            const localFilename = `peticao_inicial_${protocolo}.docx`;
            await fs.writeFile(path.join(localDir, localFilename), docxBuffer);
            url_documento_gerado = docxPath;
            url_peticao_penhora = docxPath;
            logger.info(`[Local Fallback] DOCX salvo em ${localDir}/${localFilename}`);
          }
        } else {
          // Fallback: salva localmente
          const localDir = path.resolve("uploads", "peticoes", protocolo);
          await fs.mkdir(localDir, { recursive: true });
          const localFilename = `peticao_inicial_${protocolo}.docx`;
          await fs.writeFile(path.join(localDir, localFilename), docxBuffer);
          url_documento_gerado = docxPath;
          url_peticao_penhora = docxPath;
          logger.info(`[Local] DOCX salvo em ${localDir}/${localFilename}`);
        }
      }
    } catch (docxError) {
      logger.error(`Erro ao gerar DOCX: ${docxError.message}`, {
        stack: docxError.stack,
      });
    }

    // Gerar texto completo para backup/visualização
    const peticao_completa_texto = gerarTextoCompletoPeticao(
      buildDocxTemplatePayload(normalizedData, dosFatosTexto, caseDataForPetition, acaoKey),
    );

    // Agrupa dados virtuais (links multi-rito, rascunhos, resumos) que NÃO constam
    // na tipagem bruta do DB dentro do JSONB flexível para respeitar o Schema 1.0
    const iaDadosExtraidos = {
      ...caseDataForPetition,
      resumo_ia,
      peticao_inicial_rascunho: `DOS FATOS\n\n${dosFatosTexto || ""}`,
      ...urlsDocumentosGerados,
      url_peticao_penhora,
      url_peticao_prisao,
      url_peticao_cumulado,
    };

    const finalStatus =
      statusOriginal === "aguardando_documentos" ? "aguardando_documentos" : "pronto_para_analise";

    // Finalizar processamento - Atualiza Status no Caso e Dados na IA
    await prisma.casos.update({
      where: { protocolo },
      data: {
        status: finalStatus,
        processed_at: new Date(),
        ia: {
          upsert: {
            create: {
              relato_texto: textoCompleto,
              dos_fatos_gerado: dosFatosTexto,
              peticao_completa_texto,
              url_peticao: url_documento_gerado,
              url_peticao_penhora: url_peticao_penhora,
              url_peticao_prisao: url_peticao_prisao,
              dados_extraidos: iaDadosExtraidos,
              versao_peticao: 1,
            },
            update: {
              relato_texto: textoCompleto,
              dos_fatos_gerado: dosFatosTexto,
              peticao_completa_texto,
              url_peticao: url_documento_gerado,
              url_peticao_penhora: url_peticao_penhora,
              url_peticao_prisao: url_peticao_prisao,
              dados_extraidos: iaDadosExtraidos,
            },
          },
        },
      },
    });

    logger.info(`✅ Caso ${protocolo} processado com sucesso em background.`);
  } catch (error) {
    logger.error(`❌ Erro no background para ${protocolo}: ${error.message}`, {
      stack: error.stack,
    });
    await prisma.casos
      .update({
        where: { protocolo },
        data: {
          status: "erro_processamento",
          erro_processamento: error.message,
        },
      })
      .catch((e) => logger.error("Falha ao salvar erro no BD do caso: " + e.message));
  }
};

export const gerarTicketDownload = async (req, res) => {
  const { id } = req.params;
  const { caminho_arquivo } = req.body;

  try {
    // [SEGURANÇA] Verifica acesso ao caso antes de emitir o ticket (previne IDOR)
    const caso = await carregarCasoDetalhado(id, req.user);
    if (!caso) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // Detecta o bucket a partir do caminho para incluir no payload do ticket
    let bucket = "documentos";
    if (caminho_arquivo) {
      if (caminho_arquivo.includes("peticoes")) bucket = "peticoes";
      else if (caminho_arquivo.includes("audios")) bucket = "audios";
    }

    const payload = {
      user: {
        id: req.user.id,
        nome: req.user.nome,
        email: req.user.email,
        cargo: req.user.cargo,
        unidade_id: req.user.unidade_id,
      },
      casoId: id,
      casoUnidadeId: caso.unidade_id,
      path: caminho_arquivo || null,
      bucket,
      purpose: "download",
    };

    const ticket = jwt.sign(payload, process.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: "30s",
    });

    res.status(200).json({ ticket });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message, ...error.payload });
    }
    logger.error(`[Ticket] Erro ao gerar: ${error.message}`);
    res.status(500).json({ error: "Erro interno ao gerar ticket de download." });
  }
};

/**
 * [ID: 2] Implementar a função baixarDocumentoIndividual.
 */
export const baixarDocumentoIndividual = async (req, res) => {
  try {
    const { id } = req.params;
    const { path: storagePath } = req.query;

    if (!storagePath) {
      return res.status(400).json({ error: "Caminho do arquivo não informado." });
    }

    const caso = await carregarCasoDetalhado(id, req.user);
    if (!caso) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    const objectPath = extractObjectPath(storagePath);
    if (!objectPath) {
      return res.status(400).json({ error: "Caminho de arquivo inválido." });
    }

    const filename = path.basename(objectPath);
    let bucket = "documentos";
    if (objectPath.includes("peticoes") || storagePath.includes("peticoes")) bucket = "peticoes";
    if (objectPath.includes("audios") || storagePath.includes("audios")) bucket = "audios";

    // [SEGURANÇA] Hardening: O Ticket deve estar vinculado ao mesmo caso e path (Task ID: 01)
    if (req.ticket) {
      if (String(req.ticket.casoId) !== String(id)) {
        return res.status(403).json({ error: "Ticket não autorizado para este caso." });
      }

      // Valida se o path assinado bate com o requisitado (previne tampering)
      if (req.ticket.path && req.ticket.path !== storagePath) {
        logger.warn(
          `[Tampering Attempt] User ${req.user.id} tentou baixar path divergente do ticket.`,
        );
        return res.status(403).json({ error: "Ticket inválido: Divergência de arquivo." });
      }

      if (req.ticket.bucket && req.ticket.bucket !== bucket) {
        return res.status(403).json({ error: "Ticket inválido: Divergência de categoria." });
      }
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.storage.from(bucket).download(objectPath);
      if (error) {
        logger.error(`[Download] Erro Supabase: ${error.message}`, { objectPath, bucket });
        return res.status(404).json({ error: "Arquivo não encontrado no servidor." });
      }
      const buffer = Buffer.from(await data.arrayBuffer());
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", data.type || "application/octet-stream");
      return res.send(buffer);
    } else {
      const localPath = path.resolve("uploads", bucket, objectPath);
      if (fsSync.existsSync(localPath)) {
        res.download(localPath, filename);
      } else {
        return res.status(404).json({ error: "Arquivo local não encontrado." });
      }
    }
  } catch (error) {
    logger.error(`[Download] Erro fatal: ${error.message}`);
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

/**
 * [ID: 3] Implementar a função baixarTodosDocumentosZip.
 */
export const baixarTodosDocumentosZip = async (req, res) => {
  try {
    const { id } = req.params;
    const casoRaw = await carregarCasoDetalhado(id, req.user);
    if (!casoRaw) return res.status(404).json({ error: "Caso não encontrado." });

    // IMPORTANTE: Normalizar para garantir que campos como endereco_assistido e dados_formulario estejam presentes
    const caso = mapCasoRelations(casoRaw);

    // Ticket Binding Guard (Task 07)
    if (!req.ticket?.casoId || String(req.ticket.casoId) !== String(id)) {
      return res.status(403).json({ error: "Ticket não autorizado para este caso." });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    // [CONFIABILIDADE] Handlers para evitar ZIPs corrompidos e vazamentos de recursos
    let archiveAborted = false;

    archive.on("error", (err) => {
      logger.error(`[ZIP] Erro de compressão: ${err.message}`);
      if (!archiveAborted) {
        archiveAborted = true;
        if (!res.headersSent) {
          res.status(500).json({ error: "Erro ao gerar o arquivo ZIP." });
        } else {
          res.destroy();
        }
      }
    });

    archive.on("warning", (warn) => {
      logger.warn(`[ZIP] Aviso de compressão: ${warn.message || warn.code}`);
    });

    res.on("error", (err) => {
      logger.error(`[ZIP] Erro de escrita na resposta (cliente desconectado?): ${err.message}`);
      if (!archiveAborted) {
        archiveAborted = true;
        archive.abort();
      }
    });

    // Repositioned Headers (Task 08)
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${caso.protocolo}_documentos.zip"`);

    archive.pipe(res);

    // [AUTOMACAO] Injeta JSON de dados para a extensão (atendimento.json)
    const exportData = {
      caso: {
        id: caso.id,
        protocolo: caso.protocolo,
        tipo_acao: caso.tipo_acao,
        status: caso.status,
      },
      solar: buildSolarExportPayload(caso),
    };
    archive.append(JSON.stringify(stringifyBigInts(exportData), null, 2), {
      name: "atendimento.json",
    });

    const arquivosFalharam = [];

    if (caso.documentos && caso.documentos.length > 0) {
      for (const doc of caso.documentos) {
        try {
          const objectPath = doc.storage_path;
          if (isSupabaseConfigured) {
            const { data, error } = await supabase.storage.from("documentos").download(objectPath);
            if (error) throw error;
            if (data) {
              const filenameInZip = path
                .basename(String(doc.nome_original || path.basename(objectPath)))
                .replace(/[\\/\r\n]+/g, "_");
              logger.info(`[ZIP] Adicionando arquivo: ${filenameInZip}`);
              archive.append(Buffer.from(await data.arrayBuffer()), {
                name: filenameInZip,
              });
            }
          } else {
            const localPath = path.resolve("uploads", "documentos", objectPath);
            if (fsSync.existsSync(localPath)) {
              const filenameInZip = path
                .basename(String(doc.nome_original || path.basename(objectPath)))
                .replace(/[\\/\r\n]+/g, "_");
              logger.info(`[ZIP] Adicionando arquivo local: ${filenameInZip}`);
              archive.file(localPath, {
                name: filenameInZip,
              });
            } else {
              throw new Error("Arquivo não encontrado no storage local");
            }
          }
        } catch (err) {
          // LGPD: logar apenas ID, nunca nome/CPF do arquivo (Task 09)
          logger.error(`[ZIP] Falha no doc id=${doc.id}: ${err.message}`);
          arquivosFalharam.push(doc.nome_original || `documento_${doc.id}`);
        }
      }
    }

    if (arquivosFalharam.length > 0) {
      archive.append(`Arquivos não incluídos neste ZIP:\n${arquivosFalharam.join("\n")}`, {
        name: "RELATORIO_ERROS.txt",
      });
    }

    archive.finalize();
  } catch (error) {
    logger.error(`[Download] Erro fatal: ${error.message}`);
    if (!res.headersSent) res.status(error.statusCode || 500).json({ error: error.message });
  }
};

// --- CONTROLLER PRINCIPAL ---
export const criarNovoCaso = async (req, res) => {
  try {
    // O bloco finally cuidará da limpeza de arquivos
    const dados_formulario = req.body;
    const avisos = [];
    // Desestruturação segura (mantida do seu código)
    const { tipoAcao, relato, documentos_informados, documentos_nomes } = dados_formulario;

    // Extração mapeada forçadamente para o dicionário padrão (Sem Aliases)
    // [EIXO 6] Incapaz: assistido = filho (tag NOME), representante = mãe (tag REPRESENTANTE_NOME)
    // Adulto: assistido = a própria autora (tag REPRESENTANTE_NOME)
    const ehIncapaz = dados_formulario.assistidoEhIncapaz === "sim";
    const nome = ehIncapaz
      ? dados_formulario.NOME || dados_formulario.nome || ""
      : dados_formulario.REPRESENTANTE_NOME || dados_formulario.nome || "";
    let cpf_assistido_raw = dados_formulario.cpf || dados_formulario.cpf_assistido || "";
    let cpf_representante_raw = dados_formulario.representante_cpf || "";

    let cpf = cpf_assistido_raw.replace(/\D/g, "");
    let cpf_rep = cpf_representante_raw.replace(/\D/g, "");
    const cpf_requerido_limpo = (
      dados_formulario.executado_cpf ||
      dados_formulario.cpf_requerido ||
      ""
    ).replace(/\D/g, "");
    const telefone = dados_formulario.requerente_telefone || "";
    const cpf_requerido = dados_formulario.executado_cpf || "";
    const detalhes_filhos =
      dados_formulario.outros_filhos_detalhes || dados_formulario.lista_filhos || "";

    const documentosInformadosArray = safeJsonParse(documentos_informados, []);

    // --- VALIDAÇÃO DE CPFs (CRÍTICO) ---
    if (cpf && !validarCPF(cpf)) {
      return res.status(400).json({ error: "CPF do assistido inválido." });
    }

    if (ehIncapaz && !validarCPF(cpf_rep)) {
      return res.status(400).json({
        error: "CPF do representante é obrigatório e deve ser válido para assistidos incapazes.",
      });
    } else if (!ehIncapaz && cpf_rep && !validarCPF(cpf_rep)) {
      return res.status(400).json({ error: "CPF do representante inválido." });
    }

    if (cpf_requerido && !validarCPF(cpf_requerido)) {
      avisos.push("Alerta: O CPF informado para a parte contrária (Requerido) parece inválido.");
    }
    // Validação de filhos (lista_filhos)
    const filhosParsed = safeJsonParse(detalhes_filhos, []);
    if (Array.isArray(filhosParsed)) {
      filhosParsed.forEach((f, i) => {
        if (f.cpf && !validarCPF(f.cpf))
          avisos.push(`Alerta: O CPF do filho(a) ${f.NOME || i + 1} parece inválido.`);
      });
    }

    const { protocolo } = generateCredentials(tipoAcao);

    logger.info(`Iniciando criação de caso. Protocolo: ${protocolo}, Tipo: ${tipoAcao}`);

    // Upload de arquivos
    let url_audio = null;
    let urls_documentos = [];
    let url_peticao = null; // [CORREÇÃO] Inicializado para evitar ReferenceError

    if (req.files) {
      if (req.files.audio) {
        const audioFile = req.files.audio[0];
        const filePath = `${protocolo}/${audioFile.filename}`;

        if (!isSupabaseConfigured) {
          const localDir = path.resolve("uploads", "audios", protocolo);
          await fs.mkdir(localDir, { recursive: true });
          await fs.copyFile(audioFile.path, path.join(localDir, audioFile.filename));
          url_audio = filePath;
          logger.info(`[Local] Áudio salvo em ${localDir}`);
        } else {
          const audioStream = fsSync.createReadStream(audioFile.path);
          const { error: audioErr } = await supabase.storage
            .from("audios")
            .upload(filePath, audioStream, {
              contentType: audioFile.mimetype,
              duplex: "half",
            });
          if (audioErr) {
            logger.error("Erro upload áudio:", { error: audioErr });
            avisos.push("Falha ao salvar áudio.");
          } else {
            url_audio = filePath;
          }
        }
      }
      if (req.files.documentos) {
        if (!isSupabaseConfigured) {
          for (const docFile of req.files.documentos) {
            const filePath = `${protocolo}/${docFile.filename}`;
            const bucket = docFile.originalname.toLowerCase().includes("peticao")
              ? "peticoes"
              : "documentos";
            const localDir = path.resolve("uploads", bucket, protocolo);
            await fs.mkdir(localDir, { recursive: true });
            await fs.copyFile(docFile.path, path.join(localDir, docFile.filename));

            if (bucket === "peticoes") {
              url_peticao = filePath;
            } else {
              urls_documentos.push(filePath);
            }
          }
          logger.info(`[Local] ${req.files.documentos.length} documento(s) salvos.`);
        } else {
          for (const docFile of req.files.documentos) {
            const filePath = `${protocolo}/${docFile.filename}`;
            const docStream = fsSync.createReadStream(docFile.path);
            if (docFile.originalname.toLowerCase().includes("peticao")) {
              const { error: petErr } = await supabase.storage
                .from("peticoes")
                .upload(filePath, docStream, {
                  contentType: docFile.mimetype,
                  duplex: "half",
                });
              if (petErr) {
                logger.error(`Erro upload petição (${docFile.originalname}):`, {
                  error: petErr,
                });
                avisos.push(
                  `Erro ao salvar petição no Supabase, salvando local: ${docFile.originalname}`,
                );
                const localDir = path.resolve("uploads", "peticoes", protocolo);
                await fs.mkdir(localDir, { recursive: true });
                await fs.copyFile(docFile.path, path.join(localDir, docFile.filename));
                url_peticao = filePath;
              } else {
                url_peticao = filePath; // Agora seguro
              }
            } else {
              const { error: docErr } = await supabase.storage
                .from("documentos")
                .upload(filePath, docStream, {
                  contentType: docFile.mimetype,
                  duplex: "half",
                });
              if (docErr) {
                logger.error(`Erro upload documento (${docFile.originalname}):`, {
                  error: docErr,
                });
                avisos.push(`Erro ao salvar no Supabase, salvando local: ${docFile.originalname}`);
                const localDir = path.resolve("uploads", "documentos", protocolo);
                await fs.mkdir(localDir, { recursive: true });
                await fs.copyFile(docFile.path, path.join(localDir, docFile.filename));
                urls_documentos.push(filePath);
              } else {
                urls_documentos.push(filePath);
              }
            }
          }
        }
      }
    }

    // Mescla os nomes dos documentos nos dados do formulário
    const documentNamesObj = safeJsonParse(documentos_nomes, {});

    const dadosFormularioFinal = {
      ...dados_formulario,
      document_names: documentNamesObj,
    };

    // Salvar no Banco (Resposta Rápida)
    logger.debug("Salvando dados básicos no Banco...");

    // Busca a unidade pela cidade_assinatura informada no formulário
    const cidadeFormulario =
      dados_formulario.CIDADEASSINATURA ||
      dados_formulario.cidade_assinatura ||
      dados_formulario.cidadeAssinatura ||
      "";
    let unidadeDb = null;

    // [EIXO 4] Normalização de comarca: remove acentos e sufixos como /BA
    const normalizeComarca = (s) =>
      (s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // remove acentos
        .replace(/\/[A-Z]{2}$/, "") // remove /BA, /SP, etc.
        .toLowerCase()
        .trim();

    if (cidadeFormulario) {
      // Busca case-insensitive pela comarca
      const todasUnidades = await prisma.unidades.findMany({
        where: { ativo: true },
      });
      unidadeDb = todasUnidades.find(
        (u) => normalizeComarca(u.comarca) === normalizeComarca(cidadeFormulario),
      );

      if (!unidadeDb) {
        logger.warn(
          `[Unidade] Nenhuma match exato para "${cidadeFormulario}". Tentando match parcial...`,
        );
        unidadeDb = todasUnidades.find((u) =>
          normalizeComarca(u.comarca).includes(normalizeComarca(cidadeFormulario).split(" ")[0]),
        );
      }

      if (!unidadeDb) {
        logger.warn(
          `Nenhuma unidade encontrada para a comarca "${cidadeFormulario}". Usando a primeira unidade disponível.`,
        );
      }
    }

    // Fallback: usa a primeira unidade cadastrada
    if (!unidadeDb) {
      unidadeDb = await prisma.unidades.findFirst({ where: { ativo: true } });
    }

    if (!unidadeDb) {
      logger.warn(
        "Aviso: Nenhuma 'unidade' cadastrada. Criando 'Unidade Sede Defensoria' automaticamente.",
      );
      unidadeDb = await prisma.unidades.create({
        data: {
          nome: "Unidade Sede Defensoria",
          comarca: cidadeFormulario || "Teixeira de Freitas",
          sistema: "solar",
          ativo: true,
        },
      });
    }

    // Mapeia para um enum válido do Prisma:
    let tipoAcaoPrisma = "fixacao_alimentos";
    if (
      tipoAcao.toLowerCase().includes("execução") ||
      tipoAcao.toLowerCase().includes("execucao")
    ) {
      tipoAcaoPrisma = "exec_cumulado"; // Ou outro mapeamento correspondente ao DB
    } else if (tipoAcao.toLowerCase().includes("gravidicos")) {
      tipoAcaoPrisma = "alimentos_gravidicos";
    }

    // Determina o status inicial baseado em se o usuário vai enviar documentos depois
    const enviarDocDepois =
      dados_formulario.enviarDocumentosDepois === "true" ||
      dados_formulario.enviarDocumentosDepois === true ||
      dados_formulario.enviar_documentos_depois === "true" ||
      dados_formulario.enviar_documentos_depois === true;
    const statusInicial = enviarDocDepois ? "aguardando_documentos" : "documentacao_completa";

    // Busca se a mesma mãe/assistido já tem um caso vinculado a um Defensor para unificar
    let inheritedDefensorId = null;
    const cpf_busca = ehIncapaz && cpf_rep ? cpf_rep : cpf; // Agrupar pela mãe se for menor
    if (cpf_busca) {
      const orConditions = [{ cpf_assistido: cpf_busca }, { cpf_representante: cpf_busca }];
      const relatedCases = await prisma.casos_partes.findMany({
        where: { OR: orConditions },
        select: { caso_id: true },
      });

      if (relatedCases.length > 0) {
        const caseIds = relatedCases.map((c) => c.caso_id);
        const lockedCase = await prisma.casos.findFirst({
          where: {
            id: { in: caseIds },
            defensor_id: { not: null },
          },
          orderBy: { defensor_at: "desc" },
        });
        if (lockedCase) {
          inheritedDefensorId = lockedCase.defensor_id;
        }
      }
    }

    // Tenta salvar via Prisma de preferência (Normalizado v1.0)
    await prisma.casos.create({
      data: {
        protocolo,
        unidade_id: unidadeDb.id,
        tipo_acao: tipoAcaoPrisma,
        status: statusInicial,
        defensor_id: inheritedDefensorId,
        defensor_at: inheritedDefensorId ? new Date() : null,
        created_at: new Date(),
        partes: {
          create: {
            nome_assistido: nome,
            cpf_assistido: cpf,
            telefone_assistido: telefone,
            email_assistido: dados_formulario.requerente_email || dados_formulario.email_assistido,
            endereco_assistido:
              dados_formulario.requerente_endereco_residencial ||
              dados_formulario.endereco_assistido,
            rg_assistido: dados_formulario.representante_rg || dados_formulario.assistido_rg_numero,
            emissor_rg_assistido:
              dados_formulario.emissor_rg_exequente || dados_formulario.assistido_rg_orgao,
            nacionalidade:
              dados_formulario.representante_nacionalidade ||
              dados_formulario.assistido_nacionalidade,
            estado_civil:
              dados_formulario.representante_estado_civil ||
              dados_formulario.assistido_estado_civil,
            profissao:
              dados_formulario.representante_ocupacao || dados_formulario.assistido_ocupacao,
            assistido_eh_incapaz:
              dados_formulario.assistidoEhIncapaz || dados_formulario.assistido_eh_incapaz || null,
            data_nascimento_assistido:
              dados_formulario.nascimento ||
              dados_formulario.data_nascimento_assistido ||
              dadosFormularioFinal.nascimento ||
              null,
            data_nascimento_representante: dados_formulario.representante_data_nascimento || null,
            cpf_representante: cpf_rep || null,
            nome_representante:
              dados_formulario.REPRESENTANTE_NOME || dados_formulario.representante_nome || null,
            rg_representante: dados_formulario.representante_rg || null,
            emissor_rg_representante: dados_formulario.emissor_rg_exequente || null,
            nacionalidade_representante: dados_formulario.representante_nacionalidade || null,
            estado_civil_representante: dados_formulario.representante_estado_civil || null,
            profissao_representante: dados_formulario.representante_ocupacao || null,
            nome_mae_representante: dados_formulario.nome_mae_representante,
            nome_pai_representante: dados_formulario.nome_pai_representante,
            nome_requerido: dados_formulario.REQUERIDO_NOME || dados_formulario.nome_requerido,
            cpf_requerido: cpf_requerido_limpo,
            rg_requerido: dados_formulario.rg_executado || dados_formulario.requerido_rg_numero,
            emissor_rg_requerido:
              dados_formulario.emissor_rg_executado || dados_formulario.requerido_rg_orgao,
            profissao_requerido:
              dados_formulario.executado_profissao || dados_formulario.requerido_ocupacao,
            data_nascimento_requerido:
              dados_formulario.executado_data_nascimento ||
              dados_formulario.requerido_data_nascimento ||
              null,
            nome_mae_requerido:
              dados_formulario.nome_mae_executado || dados_formulario.requerido_nome_mae,
            nome_pai_requerido:
              dados_formulario.nome_pai_executado || dados_formulario.requerido_nome_pai,
            endereco_requerido:
              dados_formulario.executado_endereco_residencial ||
              dados_formulario.endereco_requerido,
            telefone_requerido:
              dados_formulario.executado_telefone || dados_formulario.telefone_requerido,
            email_requerido: dados_formulario.executado_email || dados_formulario.email_requerido,
            exequentes: filhosParsed,
          },
        },
        juridico: {
          create: {
            numero_processo_titulo:
              dados_formulario.processoOrigemNumero ||
              dados_formulario.numero_processo_originario ||
              dados_formulario.processo_titulo_numero,
            tipo_decisao: dados_formulario.tipo_decisao || null,
            vara_originaria:
              dados_formulario.varaOriginaria || dados_formulario.vara_originaria || null,
            cidade_originaria:
              dados_formulario.cidadeOriginaria || dados_formulario.cidade_originaria || null,
            percentual_salario: parseCurrencyToNumber(dados_formulario.percentual_salario_minimo),
            vencimento_dia:
              parseInt(
                dados_formulario.dia_pagamento ||
                  dados_formulario.dia_pagamento_fixado ||
                  dados_formulario.dia_pagamento_requerido,
              ) || null,
            periodo_inadimplencia:
              dados_formulario.periodo_meses_ano ||
              dados_formulario.periodo_debito_execucao ||
              dados_formulario.periodo_debito,
            debito_valor:
              dados_formulario.valor_debito ||
              dados_formulario.valor_pensao ||
              dados_formulario.valor_total_debito_execucao ||
              dados_formulario.valor_mensal_pensao,
            debito_penhora_valor: dados_formulario.debito_penhora_valor || null,
            debito_prisao_valor: dados_formulario.debito_prisao_valor || null,
            conta_banco: dados_formulario.banco_deposito,
            conta_agencia: dados_formulario.agencia_deposito,
            conta_operacao: dados_formulario.operacao_deposito || dados_formulario.conta_operacao,
            conta_numero: dados_formulario.conta_deposito,
            empregador_nome: dados_formulario.empregador_requerido_nome,
            empregador_endereco: dados_formulario.empregador_requerido_endereco,
          },
        },
        ia: {
          create: {
            relato_texto: relato,
            dados_extraidos: dadosFormularioFinal, // Guardamos o form completo aqui para histórico
          },
        },
        documentos: {
          create: urls_documentos.map((path) => ({
            storage_path: path,
            tipo: path.toLowerCase().includes("peticao") ? "peticao" : "outro",
          })),
        },
      },
    });

    logger.info(`Caso ${protocolo} salvo com status "${statusInicial}".`);

    const responsePayload = { protocolo };
    if (avisos.length) responsePayload.avisos = avisos;

    // Se vai enviar documentos depois, responde e NÃO processa em background
    if (enviarDocDepois) {
      logger.info(
        `📋 Caso ${protocolo} aguardando documentos. Processamento iniciado (Minuta em background).`,
      );
      res.status(201).json({
        ...responsePayload,
        message: "Caso registrado! A minuta está sendo gerada enquanto você anexa os documentos.",
        status: "aguardando_documentos",
      });
    } else {
      res.status(201).json({
        ...responsePayload,
        message: "Caso registrado! Processando...",
        status: "documentacao_completa",
      });
    }

    const qstashToken = process.env.QSTASH_TOKEN;
    const apiBaseUrl = process.env.API_BASE_URL;
    let apiBaseUrlValida = false;
    if (apiBaseUrl) {
      try {
        new URL(apiBaseUrl);
        apiBaseUrlValida = true;
      } catch {
        apiBaseUrlValida = false;
      }
    }

    // Enviar para QStash em vez de setImmediate
    if (qstashToken && apiBaseUrlValida) {
      // Configurar cliente QStash
      const qstashClient = new Client({ token: qstashToken });
      try {
        await qstashClient.publishJSON({
          url: `${apiBaseUrl.replace(/\/$/, "")}/api/jobs/process`,
          body: {
            protocolo,
            dados_formulario: dadosFormularioFinal, // Passa os dados do formulario ja finalizados
            urls_documentos,
            url_audio,
            url_peticao,
          },
        });
        logger.info(`[QStash] Job enviado: ${protocolo}`);
      } catch (qstashError) {
        logger.error(`[QStash] Falha ao enviar: ${qstashError.message}`);
        // Fallback para processamento local se QStash falhar
        setImmediate(async () => {
          try {
            await processarCasoEmBackground(
              protocolo,
              dados_formulario,
              urls_documentos,
              url_audio,
              url_peticao,
            );
          } catch (error) {
            logger.error(`Erro fatal no worker fallback: ${error.message}`);
          }
        });
      }
    } else {
      if (!qstashToken) {
        logger.warn("[QStash] QSTASH_TOKEN ausente; processamento local acionado.");
      } else if (!apiBaseUrlValida) {
        logger.warn("[QStash] API_BASE_URL invalida; processamento local acionado.");
      }
      setImmediate(async () => {
        try {
          await processarCasoEmBackground(
            protocolo,
            dados_formulario,
            urls_documentos,
            url_audio,
            url_peticao,
          );
        } catch (error) {
          logger.error(`Erro fatal no worker fallback: ${error.message}`);
        }
      });
    }
  } catch (error) {
    logger.error(`Erro na criação do caso: ${error.message}`, {
      stack: error.stack,
    });
    // Só responde se ainda não tiver respondido
    if (!res.headersSent) {
      res.status(500).json({ error: "Falha ao processar solicitação." });
    }
  } finally {
    // Limpeza unificada de arquivos temporários
    if (req.files) {
      for (const key in req.files) {
        for (const file of req.files[key]) {
          try {
            await fs.unlink(file.path);
          } catch (e) {
            logger.warn(`Falha ao limpar arquivo temporário: ${file.path}`, e.message);
          }
        }
      }
    }
  }
};

export const listarCasos = async (req, res) => {
  try {
    const { cpf, arquivado, limite, meusAtendimentos, unidade_id, status } = req.query;
    const arquivadoBool = arquivado === "true";
    const userCargo = (req.user?.cargo || "").toLowerCase();

    // 1. Filtro de base (Regional para Coordenador, Unidade para outros)
    let baseFilter = {};
    if (userCargo === "coordenador") {
      if (req.user.regional) {
        baseFilter.unidade = { regional: req.user.regional };
      } else {
        // Fallback de segurança: se a regional não estiver no perfil, restringe à unidade dele
        baseFilter.unidade_id = req.user.unidade_id;
      }
    } else if (userCargo !== "admin" && userCargo !== "gestor") {
      baseFilter.unidade_id = req.user.unidade_id;
    }

    // 2. Filtros de Unidade/Regional
    let whereClause = { arquivado: arquivadoBool, ...baseFilter };

    if (status) {
      const statusList = status.split(",");
      whereClause.status = { in: statusList };
    }

    if (userCargo === "admin" || userCargo === "gestor" || userCargo === "coordenador") {
      if (unidade_id && unidade_id !== "todas") {
        whereClause.unidade_id = unidade_id;
      }
    }

    // Filtro para ocultar em_protocolo de servidor/estagiario
    if (userCargo === "servidor" || userCargo === "estagiario") {
      whereClause.status = { not: "em_protocolo" };
    }

    // Filtro "Meus Atendimentos"
    if (meusAtendimentos === "true" && req.user) {
      const meusFilter = {
        OR: [
          { defensor_id: req.user.id },
          { servidor_id: req.user.id },
          {
            assistencia_casos: {
              some: {
                destinatario_id: req.user.id,
                status: "aceito",
              },
            },
          },
        ],
      };
      whereClause = { ...whereClause, ...meusFilter };
    }

    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      const cpfQuery = [
        { protocolo: cpf },
        { partes: { cpf_assistido: cpf } },
        { partes: { cpf_assistido: cpfLimpo } },
        { partes: { cpf_assistido: cpfFormatado } },
        { partes: { cpf_representante: cpf } },
        { partes: { cpf_representante: cpfLimpo } },
        { partes: { cpf_representante: cpfFormatado } },
      ];

      // Combina com o filtro de "Meus Atendimentos" se ele existir
      if (whereClause.OR) {
        const existingOR = whereClause.OR;
        delete whereClause.OR;
        whereClause.AND = [{ OR: existingOR }, { OR: cpfQuery }];
      } else {
        whereClause.OR = cpfQuery;
      }
    }

    const queryOptions = {
      where: whereClause,
      orderBy: { created_at: "desc" },
      include: {
        partes: true,
        ia: true,
        documentos: true,
        defensor: { select: { id: true, nome: true } },
        servidor: { select: { id: true, nome: true } },
        unidade: { select: { sistema: true, regional: true } },
      },
    };

    if (limite) {
      const n = parseInt(limite, 10);
      if (!isNaN(n) && n > 0) queryOptions.take = n;
    }

    const data = await prisma.casos.findMany(queryOptions);

    const normalizedData = data.map((casoRaw) => {
      const caso = mapCasoRelations(casoRaw);
      caso.nome_representante =
        caso.dados_formulario?.REPRESENTANTE_NOME ||
        caso.dados_formulario?.representante_nome ||
        null;
      return caso;
    });

    res.status(200).json(stringifyBigInts(normalizedData));
  } catch (error) {
    logger.error(`Erro ao listar casos: ${error.message}`);
    res.status(500).json({ error: "Erro ao listar casos." });
  }
};

/**
 * Retorna apenas contagens de casos por status — SEM dados pessoais (PII).
 * Usado pelo Dashboard para exibir estatísticas sem expor CPFs/nomes.
 */
export const resumoCasos = async (req, res) => {
  try {
    const whereClause = { arquivado: false };
    const cargoNormalizado = (req.user?.cargo || "").toLowerCase();

    // Filtro por unidade/regional
    if (req.user && !["admin", "gestor"].includes(cargoNormalizado)) {
      if (cargoNormalizado === "coordenador") {
        if (req.user.regional) {
          whereClause.unidade = { regional: req.user.regional };
        } else {
          whereClause.unidade_id = req.user.unidade_id;
        }
      } else if (req.user.unidade_id) {
        // Demais veem apenas sua unidade
        whereClause.unidade_id = req.user.unidade_id;
      }
    }

    // Filtro para ocultar em_protocolo de servidor/estagiario
    if (req.user && (cargoNormalizado === "servidor" || cargoNormalizado === "estagiario")) {
      whereClause.status = { not: "em_protocolo" };
    }

    const contagens = {
      total: 0,
      aguardando_documentos: 0,
      documentacao_completa: 0,
      processando_ia: 0,
      pronto_para_analise: 0,
      em_atendimento: 0,
      liberado_para_protocolo: 0,
      em_protocolo: 0,
      protocolado: 0,
      erro_processamento: 0,
      colaboracao: 0,
      meus: 0,
    };

    const vinteMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
    const isPowerUser = req.user?.cargo === "admin" || req.user?.cargo === "gestor";
    let partesWhere = { caso: { arquivado: false } };
    if (!isPowerUser && req.user?.unidade_id) {
      if (req.user.cargo?.toLowerCase() === "coordenador") {
        const userUnidade = await prisma.unidades
          .findUnique({
            where: { id: req.user.unidade_id },
            select: { regional: true },
          })
          .catch(() => null);

        if (userUnidade?.regional) {
          partesWhere.caso.unidade = { regional: userUnidade.regional };
        } else {
          partesWhere.caso.unidade_id = req.user.unidade_id;
        }
      } else {
        partesWhere.caso.unidade_id = req.user.unidade_id;
      }
    }

    const [total, porStatus, porTipo, colaboracao, meus, ociosos, representacao, partesTotal] =
      await Promise.all([
        prisma.casos.count({ where: whereClause }),
        prisma.casos.groupBy({
          by: ["status"],
          where: whereClause,
          _count: { _all: true },
        }),
        prisma.casos.groupBy({
          by: ["tipo_acao"],
          where: whereClause,
          _count: { _all: true },
        }),
        prisma.casos.count({ where: { ...whereClause, compartilhado: true } }),
        req.user
          ? prisma.casos.count({
              where: {
                ...whereClause,
                OR: [{ servidor_id: req.user.id }, { defensor_id: req.user.id }],
              },
            })
          : Promise.resolve(0),
        prisma.casos.count({
          where: {
            ...whereClause,
            OR: [
              { status: "em_atendimento", servidor_at: { lt: vinteMinsAgo } },
              { status: "em_protocolo", defensor_at: { lt: vinteMinsAgo } },
            ],
          },
        }),
        prisma.casos_partes.count({
          where: {
            ...partesWhere,
            cpf_representante: { not: null },
            NOT: { cpf_representante: "" },
          },
        }),
        prisma.casos_partes.count({ where: partesWhere }),
      ]);

    contagens.total = total;
    contagens.colaboracao = colaboracao;
    contagens.meus = meus;

    for (const row of porStatus) {
      const status = String(row.status || "")
        .toLowerCase()
        .trim();
      if (Object.prototype.hasOwnProperty.call(contagens, status)) {
        contagens[status] = row._count._all;
      }
    }

    contagens.ativos = contagens.total - contagens.protocolado;

    const topTipos = porTipo
      .map((row) => ({
        tipo: row.tipo_acao || "Outros",
        qtd: row._count._all,
      }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 3);

    res.status(200).json(
      stringifyBigInts({
        contagens,
        topTipos,
        representacao: { representacao, proprio: Math.max(partesTotal - representacao, 0) },
        temCasoOcioso: ociosos > 0,
      }),
    );
  } catch (error) {
    logger.error(`Erro ao gerar resumo de casos local: ${error.message}`);
    res.status(500).json({ error: "Erro ao gerar resumo." });
  }
};

export const obterDetalhesCaso = async (req, res) => {
  const { id } = req.params;

  // Validação: Se o ID não for número nem UUID (ex: "arquivados"), retorna 400 e evita erro 500 no banco
  const isValidId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^\d+$/.test(id);
  if (!isValidId) {
    return res.status(400).json({ error: "ID do caso inválido." });
  }

  try {
    let data;

    if (isSupabaseConfigured) {
      // Supabase Join: usamos os nomes definidos no Prisma (ia, partes, juridico)
      const result = await supabase
        .from("casos")
        .select(
          `
          *,
          ia:casos_ia(*),
          partes:casos_partes(*),
          juridico:casos_juridico(*),
          documentos(*),
          defensor:defensores!casos_defensor_id_fkey(nome),
          servidor:defensores!casos_servidor_id_fkey(nome),
          unidade:unidades(nome, sistema, comarca),
          assistencia_casos:assistencia_casos(
            id,
            status, 
            destinatario_id,
            remetente_id,
            remetente:defensores!remetente_id(nome),
            destinatario:defensores!destinatario_id(nome)
          )
        `,
        )
        .eq("id", id)
        .single();

      if (result.error) throw result.error;
      data = result.data;
    } else {
      // Fallback Prisma
      const dataRaw = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: {
          partes: true,
          ia: true,
          juridico: true,
          documentos: true,
          defensor: { select: { nome: true } },
          servidor: { select: { nome: true } },
          unidade: { select: { nome: true, sistema: true, comarca: true } },
          assistencia_casos: {
            where: {
              OR: [{ destinatario_id: req.user.id }, { remetente_id: req.user.id }],
              status: "aceito",
            },
            include: {
              destinatario: { select: { nome: true } },
              remetente: { select: { nome: true } },
            },
          },
        },
      });

      if (!dataRaw) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }

      data = dataRaw;
    }

    // Normaliza relações aninhadas para expor os campos corretamente na raiz (nome_assistido, dados_formulario, etc.)
    data = mapCasoRelations(data);

    // --- Lógica de Travamento (Locking) e Vínculo Automático ---
    const userCargo = req.user.cargo.toLowerCase();
    const isObserver = ["admin", "gestor", "coordenador", "visualizador"].includes(userCargo);

    // [EIXO 1] Lock Permanente: Uma vez vinculado, apenas o dono ou Admin acessa.
    // Não expira em 30 min. Somente Admin pode liberar via /unlock.
    const isOwner =
      String(data.defensor_id) === String(req.user.id) ||
      String(data.servidor_id) === String(req.user.id);

    const isShared = (data.assistencia_casos || []).some(
      (a) =>
        (String(a.destinatario_id) === String(req.user.id) ||
          String(a.remetente_id) === String(req.user.id)) &&
        a.status === "aceito",
    );

    const isServidorOrEstagiario = userCargo === "servidor" || userCargo === "estagiario";
    if (data.status === "em_protocolo" && isServidorOrEstagiario) {
      return res.status(403).json({
        error:
          "Acesso Negado. Este caso está na etapa de protocolo e apenas defensores e coordenadores podem acessá-lo.",
      });
    }

    if (!isObserver && !isOwner && !isShared && (data.defensor_id || data.servidor_id)) {
      const holderName = data.defensor?.nome || data.servidor?.nome || "outro usuário";
      const holderId = data.defensor_id || data.servidor_id;
      logger.warn(
        `[Lock Contention]: Usuário ${req.user.id} tentou acessar caso ${id} bloqueado por ID ${holderId}`,
      );
      return res.status(423).json({
        error: "Caso bloqueado",
        message: `Este caso já está vinculado ao profissional ${holderName}. Apenas o administrador pode liberar este caso.`,
        holder: holderName,
      });
    }

    // Vínculo Automático (Apenas para o dono primário, colaboradores NÃO vinculam irmãos)
    // SEGURANÇA: Só pode assumir a autoria de um caso se ele pertencer à sua própria unidade.
    if (!isObserver && !data.defensor_id && !data.servidor_id && !isShared) {
      const isDefensor = req.user.cargo.toLowerCase().includes("defensor");
      const isServidor =
        req.user.cargo.toLowerCase() === "servidor" ||
        req.user.cargo.toLowerCase() === "estagiario";

      // BUG FIX: Se o status for 'liberado_para_protocolo', o servidor NÃO deve assumir o caso automaticamente.
      // Isso permite que o servidor libere o caso e ele continue livre para o defensor.
      let podeAssumir = false;
      if (isDefensor && ["liberado_para_protocolo", "em_protocolo"].includes(data.status)) {
        podeAssumir = true;
      } else if (isServidor && ["pronto_para_analise", "em_atendimento"].includes(data.status)) {
        podeAssumir = true;
      }

      if (podeAssumir) {
        if (String(req.user.unidade_id) !== String(data.unidade_id)) {
          return res.status(403).json({
            error: "Acesso Negado",
            message: "Você não tem permissão para assumir um caso de outra unidade.",
          });
        }

        const updateData = {};
        if (isDefensor) {
          updateData.defensor_id = req.user.id;
          updateData.defensor_at = new Date();
          data.defensor_id = req.user.id;
        } else {
          updateData.servidor_id = req.user.id;
          updateData.servidor_at = new Date();
          data.servidor_id = req.user.id;
        }

        // Atualiza o caso atual
        await prisma.casos.update({
          where: { id: BigInt(id) },
          data: updateData,
        });

        // NOVO: Vincular automaticamente todos os outros casos da mesma família
        const cpfRepresentante = data.representante_cpf; // Usar exclusivamente cpf_representante
        if (cpfRepresentante && isSupabaseConfigured) {
          try {
            // Busca casos irmãos via Supabase (mesma mãe/representante)
            const { data: outrosCasos, error: searchError } = await supabase
              .from("casos_partes")
              .select("caso_id")
              .eq("cpf_representante", cpfRepresentante);

            if (!searchError && outrosCasos?.length > 0) {
              const idsIrmaos = outrosCasos
                .map((c) => String(c.caso_id))
                .filter((cid) => cid !== String(id));

              if (idsIrmaos.length > 0) {
                // Só vincula se o caso irmão:
                // 1. NÃO tiver um lock ativo (defensor/servidor)
                // 2. Pertencer à mesma unidade do profissional (Isolamento de Unidades)
                const { error: batchError } = await supabase
                  .from("casos")
                  .update(updateData)
                  .in("id", idsIrmaos)
                  .eq("unidade_id", req.user.unidade_id)
                  .is("defensor_id", null)
                  .is("servidor_id", null);

                if (!batchError) {
                  logger.info(
                    `Vinculado automaticamente ${idsIrmaos.length} caso(s) irmão(s) da unidade ${req.user.unidade_id} ao usuário ${req.user.id}`,
                  );
                }
              }
            }
          } catch (err) {
            logger.error(`Erro ao vincular casos familiares: ${err.message}`);
          }
        } else if (cpfRepresentante && !isSupabaseConfigured) {
          // Fallback Prisma (mantendo lógica segura)
          try {
            const outrosCasos = await prisma.casos_partes.findMany({
              where: { cpf_representante: cpfRepresentante },
              select: { caso_id: true },
            });

            const idsIrmaos = outrosCasos
              .map((c) => c.caso_id)
              .filter((cid) => cid.toString() !== id.toString());

            if (idsIrmaos.length > 0) {
              await prisma.casos.updateMany({
                where: {
                  id: { in: idsIrmaos },
                  unidade_id: req.user.unidade_id,
                  defensor_id: null,
                  servidor_id: null,
                },
                data: updateData,
              });
            }
          } catch (err) {
            logger.error(`Erro ao vincular casos familiares (Prisma): ${err.message}`);
          }
        }
      }
    }

    // Garante que dados_formulario existe
    if (!data.dados_formulario) {
      data.dados_formulario = {};
    }
    if (!data.dados_formulario.document_names) {
      data.dados_formulario.document_names = {};
    }

    // Garante compatibilidade com o frontend que espera camelCase (documentNames)
    if (!data.dados_formulario.documentNames) {
      data.dados_formulario.documentNames = data.dados_formulario.document_names;
    }

    // Busca o histórico de agendamentos (só via Supabase, Prisma não tem o model)
    if (isSupabaseConfigured) {
      const { data: historico, error: histError } = await supabase
        .from("historico_agendamentos")
        .select("*")
        .eq("caso_id", id)
        .order("created_at", { ascending: false });

      if (!histError && historico) {
        data.historico_agendamentos = historico;
      }
    } else {
      data.historico_agendamentos = [];
    }

    // attachSignedUrls agora lida tanto com Supabase quanto com Local storage
    const casoFinal = await attachSignedUrls(data);

    res.status(200).json(stringifyBigInts(casoFinal));
  } catch (error) {
    logger.error(`Erro ao obter detalhes do caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao obter detalhes." });
  }
};

export const distribuirCaso = async (req, res) => {
  const { id } = req.params;
  const { usuario_id } = req.body;
  if (!usuario_id) {
    return res.status(400).json({ error: "ID do usuário alvo é obrigatório." });
  }

  // 0. Verificação de Cargo do Distribuidor (RBAC Explícito)
  const allowedDistributors = ["admin", "gestor", "coordenador"];
  if (!allowedDistributors.includes(req.user.cargo.toLowerCase())) {
    return res.status(403).json({
      error: "Acesso Negado",
      message: "Seu cargo não possui permissão para distribuir casos.",
    });
  }

  try {
    // 1. Busca status atual via Supabase (garantindo dados mais recentes)
    const { data: casoAtual, error: fetchError } = await supabase
      .from("casos")
      .select("status, unidade_id")
      .eq("id", id)
      .single();

    if (fetchError || !casoAtual) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // 1.1 Valida o usuário alvo (Prisma - RBAC/Equipe)
    const usuarioAlvo = await prisma.defensores.findUnique({
      where: { id: usuario_id },
      select: {
        ativo: true,
        unidade_id: true,
        nome: true,
        cargo: { select: { nome: true } },
      },
    });

    if (!usuarioAlvo || !usuarioAlvo.ativo) {
      return res.status(400).json({ error: "Usuário alvo inexistente ou inativo." });
    }

    const targetCargo = usuarioAlvo.cargo?.nome?.toLowerCase();

    // 1.2 Validação de Nível de Lock (RBAC Rigoroso)
    const ALVOS_ATENDIMENTO = [
      "servidor",
      "estagiario",
      "defensor",
      "coordenador",
      "admin",
      "gestor",
    ];
    const ALVOS_PROTOCOLO = ["defensor", "coordenador", "admin", "gestor"];

    if (["pronto_para_analise", "em_atendimento"].includes(casoAtual.status)) {
      if (!ALVOS_ATENDIMENTO.includes(targetCargo)) {
        return res.status(403).json({
          error: "Acesso Negado",
          message: `O cargo '${targetCargo}' não pode assumir atendimentos nesta fase.`,
        });
      }
    } else if (["liberado_para_protocolo", "em_protocolo"].includes(casoAtual.status)) {
      if (!ALVOS_PROTOCOLO.includes(targetCargo)) {
        return res.status(403).json({
          error: "Acesso Negado",
          message: `O cargo '${targetCargo}' não pode realizar protocolos.`,
        });
      }
    }

    // Admins e Gestores podem distribuir para qualquer unidade. Coordenadores apenas para a própria.
    const isPowerUser = ["admin", "gestor"].includes(req.user.cargo.toLowerCase());
    if (!isPowerUser && String(usuarioAlvo.unidade_id) !== String(casoAtual.unidade_id)) {
      return res.status(403).json({
        error: "Acesso Negado",
        message: "Não é possível distribuir um caso para um profissional de outra unidade.",
      });
    }

    // 2. Determina o campo alvo e o novo status com base no fluxo
    let campoAlvo = null;
    let novoStatus = null;
    let statusPermitidos = [];

    if (["pronto_para_analise", "em_atendimento"].includes(casoAtual.status)) {
      campoAlvo = "servidor_id";
      novoStatus = "em_atendimento";
      statusPermitidos = ["pronto_para_analise", "em_atendimento"];
    } else if (["liberado_para_protocolo", "em_protocolo"].includes(casoAtual.status)) {
      campoAlvo = "defensor_id";
      novoStatus = "em_protocolo";
      statusPermitidos = ["liberado_para_protocolo", "em_protocolo"];
    } else {
      return res.status(409).json({
        error: "Operação inválida",
        message: `Não é possível distribuir um caso com status '${casoAtual.status}'.`,
      });
    }

    // 3. Executa a mutação atômica
    const updateData = {
      [campoAlvo]: usuario_id,
      [`${campoAlvo.split("_")[0]}_at`]: new Date().toISOString(),
      status: novoStatus,
    };

    let casoAtualizado = null;

    if (isSupabaseConfigured) {
      const { data, error: updateError } = await supabase
        .from("casos")
        .update(updateData)
        .eq("id", id)
        .in("status", statusPermitidos) // Segurança da máquina de estados
        .select()
        .single();

      if (updateError) throw updateError;
      casoAtualizado = data;
    } else {
      // Fallback Prisma - Operação Atômica para evitar condições de corrida
      const { count } = await prisma.casos.updateMany({
        where: {
          id: BigInt(id),
          status: { in: statusPermitidos },
        },
        data: updateData,
      });

      if (count === 0) {
        return res.status(409).json({
          error: "Conflito",
          message: "O caso foi alterado por outro usuário ou não pôde ser distribuído.",
        });
      }

      casoAtualizado = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
      });
    }

    // 4. Log de Auditoria via Prisma (LGPD: Sem nomes ou CPFs)
    await prisma.logs_auditoria.create({
      data: {
        usuario_id: req.user.id,
        caso_id: BigInt(id),
        acao: "distribuicao_caso",
        detalhes: {
          alvo_id: usuario_id,
          campo_atualizado: campoAlvo,
          status_anterior: casoAtual.status,
          status_novo: novoStatus,
        },
      },
    });

    return res.status(200).json({
      message: "Caso distribuído com sucesso.",
      caso: stringifyBigInts(casoAtualizado),
    });
  } catch (error) {
    logger.error(`Erro ao distribuir caso ${id}: ${error.message}`);

    // Mapeamento de Erro de Concorrência do Prisma (P2025: Record not found)
    if (error.code === "P2025") {
      return res.status(409).json({
        error: "Conflito",
        message: "O caso foi alterado por outro usuário ou não pôde ser distribuído.",
      });
    }

    return res.status(500).json({ error: "Erro interno ao distribuir caso." });
  }
};

export const exportarCasoSolar = async (req, res) => {
  const { id } = req.params;

  const isValidId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || /^\d+$/.test(id);
  if (!isValidId) {
    return res.status(400).json({ error: "ID do caso inválido." });
  }

  try {
    const data = await carregarCasoDetalhado(id, req.user);

    res.status(200).json(
      stringifyBigInts({
        caso: {
          id: data.id,
          protocolo: data.protocolo,
          tipo_acao: data.tipo_acao,
          status: data.status,
        },
        solar: buildSolarExportPayload(data),
      }),
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({
        error: error.message,
        ...error.payload,
      });
    }
    logger.error(`Erro ao exportar caso ${id} para o SOLAR: ${error.message}`);
    res.status(500).json({ error: "Erro ao exportar caso para o SOLAR." });
  }
};

export const atualizarStatusCaso = async (req, res) => {
  const { id } = req.params;
  let { status, descricao_pendencia, numero_solar } = req.body;

  try {
    // 1. Busca status atual
    const casoAtual = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      select: { status: true },
    });

    if (!casoAtual) return res.status(404).json({ error: "Caso não encontrado." });

    // 2. Normalização
    if (status === "aguardando_docs") status = "aguardando_documentos";

    // Validação centralizada via State Machine
    const transition = validateTransition(casoAtual.status, status, req.user?.cargo);

    if (!transition.ok && status !== undefined && status !== casoAtual.status) {
      logger.warn(
        `[Status Machine] Bloqueada: ${casoAtual.status} -> ${status} (user: ${req.user?.id})`,
      );
      return res.status(400).json({ error: transition.reason, currentStatus: casoAtual.status });
    }

    if (transition.adminBypass) {
      logger.warn(
        `[Status Machine] Admin bypass: ${casoAtual.status} -> ${status} (user: ${req.user?.id})`,
      );
    }

    const isServidorOrEstagiario =
      req.user?.cargo === "servidor" || req.user?.cargo === "estagiario";
    if (status === "em_protocolo" && isServidorOrEstagiario) {
      return res.status(403).json({
        error: "Acesso Negado. Seu cargo não permite enviar casos para protocolo.",
      });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (descricao_pendencia !== undefined) updateData.descricao_pendencia = descricao_pendencia;
    if (numero_solar !== undefined) updateData.numero_solar = numero_solar;

    // Ao liberar para protocolo, desvincula o servidor para que o defensor possa assumir
    if (status === "liberado_para_protocolo") {
      updateData.servidor_id = null;
      updateData.servidor_at = null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nenhum dado enviado para atualização." });
    }

    const data = await prisma.casos.update({
      where: { id: BigInt(id) },
      data: updateData,
    });

    const casoAtualizadoComUrls = await attachSignedUrls(data);
    res.status(200).json(stringifyBigInts(casoAtualizadoComUrls));
  } catch (error) {
    logger.error(`Erro ao atualizar caso ${id}: ${error.message}`);

    if (error.code === "23505") {
      return res.status(409).json({ error: "Este número Solar já está vinculado a outro caso." });
    }
    if (error.code === "22P02") {
      return res.status(400).json({
        error: "Formato inválido. O número Solar deve conter apenas números.",
      });
    }

    res.status(500).json({ error: "Erro ao atualizar dados do caso." });
  }
};

export const salvarDadosJuridicos = async (req, res) => {
  const { id } = req.params;
  const {
    memoria_calculo,
    debito_valor,
    percentual_salario,
    vencimento_dia,
    debito_penhora_valor,
    debito_penhora_extenso,
    debito_prisao_valor,
    debito_prisao_extenso,
    conta_banco,
    conta_agencia,
    conta_operacao,
    conta_numero,
    descricao_guarda,
    opcao_guarda,
    bens_partilha,
    situacao_financeira_genitora,
  } = req.body;

  try {
    const updateData = {};
    if (memoria_calculo !== undefined) updateData.memoria_calculo = memoria_calculo;
    if (debito_valor !== undefined) updateData.debito_valor = debito_valor;
    if (percentual_salario !== undefined) updateData.percentual_salario = percentual_salario;
    if (vencimento_dia !== undefined) updateData.vencimento_dia = parseInt(vencimento_dia) || null;
    if (debito_penhora_valor !== undefined) updateData.debito_penhora_valor = debito_penhora_valor;
    if (debito_penhora_extenso !== undefined)
      updateData.debito_penhora_extenso = debito_penhora_extenso;
    if (debito_prisao_valor !== undefined) updateData.debito_prisao_valor = debito_prisao_valor;
    if (debito_prisao_extenso !== undefined)
      updateData.debito_prisao_extenso = debito_prisao_extenso;
    if (conta_banco !== undefined) updateData.conta_banco = conta_banco;
    if (conta_agencia !== undefined) updateData.conta_agencia = conta_agencia;
    if (conta_operacao !== undefined) updateData.conta_operacao = conta_operacao;
    if (conta_numero !== undefined) updateData.conta_numero = conta_numero;
    if (descricao_guarda !== undefined) updateData.descricao_guarda = descricao_guarda;
    if (opcao_guarda !== undefined) updateData.opcao_guarda = opcao_guarda;
    if (bens_partilha !== undefined) updateData.bens_partilha = bens_partilha;
    if (situacao_financeira_genitora !== undefined)
      updateData.situacao_financeira_genitora = situacao_financeira_genitora;

    await prisma.casos_juridico.upsert({
      where: { caso_id: BigInt(id) },
      update: updateData,
      create: {
        caso_id: BigInt(id),
        ...updateData,
      },
    });

    res.status(200).json({ success: true });
  } catch (error) {
    logger.error(`Erro ao salvar dados jurídicos do caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao salvar dados jurídicos." });
  }
};

export const salvarFeedback = async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;
  try {
    const casoEncontrado = await prisma.casos.update({
      where: { id: BigInt(id) },
      data: { feedback },
    });

    const casoComUrls = await attachSignedUrls(casoEncontrado);
    res.status(200).json(stringifyBigInts(casoComUrls));
  } catch (error) {
    logger.error(`Erro ao salvar feedback ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao salvar feedback." });
  }
};

export const regenerarDosFatos = async (req, res) => {
  const { id } = req.params;
  try {
    let caso;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("casos").select("*").eq("id", id).single();
      if (error || !data) throw new Error("Caso não encontrado");
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
      });
      if (!caso) throw new Error("Caso não encontrado");
    }

    // Restrição: Apenas administradores OU o responsável pelo caso podem regenerar os fatos
    const isAdmin = req.user && req.user.cargo.toLowerCase() === "admin";
    const isDono =
      req.user &&
      (String(caso.defensor_id) === String(req.user.id) ||
        String(caso.servidor_id) === String(req.user.id));

    if (!isAdmin && !isDono) {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas o responsável pelo caso ou administradores podem regenerar os fatos.",
      });
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("casos")
        .select("*, partes:casos_partes(*), ia:casos_ia(*), juridico:casos_juridico(*)")
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("Caso não encontrado");
      caso = mapCasoRelations(data);
    } else {
      const dataRaw = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: { partes: true, ia: true, juridico: true },
      });
      if (!dataRaw) throw new Error("Caso não encontrado");
      caso = mapCasoRelations(dataRaw);
    }

    const dados = safeFormData(caso);
    if (!Object.keys(dados).length) {
      logger.warn(`[regenerarDosFatos] dados_formulario vazio para caso ${id}`);
    }

    let acaoRaw =
      dados.acaoEspecifica ||
      (dados.tipoAcao || "").split(" - ")[1]?.trim() ||
      (dados.tipoAcao || "").trim() ||
      caso.tipo_acao ||
      "";

    const acaoKey = normalizeAcaoKey(acaoRaw);

    const dosFatosTexto = await generateDosFatos(dados, acaoKey);

    let casoAtualizado;

    // Mantém e atualiza o JSONB atual sem sobrescrever os outros links
    const currentExtra = safeJsonParse(
      caso.ia?.dados_extraidos || caso.casos_ia?.dados_extraidos,
      {},
    );
    currentExtra.peticao_inicial_rascunho = `DOS FATOS\n\n${dosFatosTexto}`;

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from("casos_ia")
        .update({
          dos_fatos_gerado: dosFatosTexto,
          peticao_inicial_rascunho: currentExtra.peticao_inicial_rascunho,
          peticao_completa_texto: null, // Limpa o snapshot completo para forçar exibição do novo rascunho
          dados_extraidos: currentExtra,
        })
        .eq("caso_id", id);
      if (updateError) throw updateError;

      const { data } = await supabase
        .from("casos")
        .select(
          "*, ia:casos_ia(*), partes:casos_partes(*), juridico:casos_juridico(*), documentos(*)",
        )
        .eq("id", id)
        .single();
      casoAtualizado = data;
    } else {
      await prisma.casos_ia.update({
        where: { caso_id: BigInt(id) },
        data: {
          dos_fatos_gerado: dosFatosTexto,
          peticao_inicial_rascunho: currentExtra.peticao_inicial_rascunho,
          peticao_completa_texto: null,
          dados_extraidos: currentExtra,
        },
      });
      casoAtualizado = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: { partes: true, ia: true, juridico: true, documentos: true },
      });
    }

    // Reanexa URLs assinadas para que links de download/áudio não quebrem na tela
    const casoComUrls = await attachSignedUrls(mapCasoRelations(casoAtualizado));
    res.status(200).json(stringifyBigInts(casoComUrls));
  } catch (error) {
    res.status(500).json({ error: "Falha ao regenerar texto." });
  }
};

export const gerarTermoDeclaracao = async (req, res) => {
  const { id } = req.params;
  try {
    const casoRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: {
        partes: true,
        ia: true,
        juridico: true,
        assistencia_casos: {
          where: {
            OR: [{ destinatario_id: req.user.id }, { remetente_id: req.user.id }],
            status: "aceito",
          },
        },
      },
    });
    if (!casoRaw) throw new Error("Caso não encontrado");
    const caso = mapCasoRelations(casoRaw);

    // [SEGURANÇA] Lógica de Locking e Autorização
    const userCargo = req.user.cargo.toLowerCase();
    const isAdmin = userCargo === "admin";
    const isGestor = userCargo === "gestor";
    const isDono =
      String(caso.defensor_id) === String(req.user.id) ||
      String(caso.servidor_id) === String(req.user.id);
    const isShared = (caso.assistencia_casos || []).length > 0;
    const lockAtivo = !isDono && (caso.defensor_id || caso.servidor_id);

    if (!isAdmin && !isDono && !isShared) {
      if (!isGestor || lockAtivo) {
        return res.status(423).json({
          error: "Caso bloqueado",
          message: "Acesso negado. Caso bloqueado por outro usuário ou você não tem permissão.",
        });
      }
    }

    // Dados base consolidados para o Payload Builder
    const baseDataForPayload = {
      ...caso,
      ...(caso.partes || {}),
      ...safeJsonParse(caso.ia?.dados_extraidos, {}),
      ...(caso.juridico || {}),
    };

    // Build term declaration data payload using the centralized builder
    const termoData = buildDocxTemplatePayload(
      caso.partes || {},
      caso.relato_texto || "",
      baseDataForPayload,
      normalizeAcaoKey(caso.tipo_acao),
    );

    // Generate the term declaration document
    const docxBuffer = await generateTermoDeclaracao(termoData);

    // Upload to storage (Supabase or Local)
    const termoPath = `${caso.protocolo}/termo_declaracao_${caso.protocolo}.docx`;

    if (isSupabaseConfigured) {
      await supabase.storage.from("peticoes").remove([termoPath]);
      const { error: uploadError } = await supabase.storage
        .from("peticoes")
        .upload(termoPath, docxBuffer, {
          contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (uploadError) throw new Error(`Erro upload Supabase: ${uploadError.message}`);
    } else {
      const localDir = path.resolve("uploads", "peticoes", caso.protocolo);
      await fs.mkdir(localDir, { recursive: true });
      await fs.writeFile(
        path.join(localDir, `termo_declaracao_${caso.protocolo}.docx`),
        docxBuffer,
      );
      logger.info(`[Local] Termo de declaração salvo em ${localDir}`);
    }

    // Salva o link do termo extra via JSONB Respeitando o DB
    const currentExtra = safeJsonParse(
      caso.ia?.dados_extraidos || caso.casos_ia?.dados_extraidos,
      {},
    );
    currentExtra.url_termo_declaracao = termoPath;

    if (isSupabaseConfigured) {
      const { error: iaError } = await supabase
        .from("casos_ia")
        .update({ dados_extraidos: currentExtra })
        .eq("caso_id", id);
      if (iaError) throw iaError;
    } else {
      await prisma.casos_ia.update({
        where: { caso_id: BigInt(id) },
        data: { dados_extraidos: currentExtra },
      });
    }

    const casoAtualizadoRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: { partes: true, ia: true, juridico: true, documentos: true },
    });
    const casoAtualizado = await attachSignedUrls(mapCasoRelations(casoAtualizadoRaw));
    res.status(200).json(stringifyBigInts(casoAtualizado));
  } catch (error) {
    logger.error(`Erro ao gerar termo de declaração: ${error.message}`);
    res.status(500).json({ error: "Falha ao gerar termo de declaração." });
  }
};

export const regerarMinuta = async (req, res) => {
  const { id } = req.params;
  try {
    const dataRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: {
        partes: true,
        ia: true,
        juridico: true,
        unidade: { select: { comarca: true } },
        assistencia_casos: {
          where: {
            OR: [{ destinatario_id: req.user.id }, { remetente_id: req.user.id }],
            status: "aceito",
          },
        },
      },
    });
    if (!dataRaw) throw new Error("Caso não encontrado");

    // 1. Permissões: Admin sempre pode. Dono ou Assistente (Compartilhado) também. Gestor pode se não houver lock.
    const userCargo = req.user.cargo.toLowerCase();
    const isAdmin = userCargo === "admin";
    const isGestor = userCargo === "gestor";
    const isDono =
      String(dataRaw.defensor_id) === String(req.user.id) ||
      String(dataRaw.servidor_id) === String(req.user.id);
    const isShared = (dataRaw.assistencia_casos || []).length > 0;
    const lockAtivo = !isDono && (dataRaw.defensor_id || dataRaw.servidor_id);

    if (!isAdmin && !isDono && !isShared) {
      if (!isGestor || lockAtivo) {
        return res.status(403).json({
          error:
            "Acesso negado. Você não tem permissão para regerar a minuta deste caso ou ele está bloqueado.",
        });
      }
    }

    const caso = mapCasoRelations(dataRaw);

    // 1. Prepara os dados baseados no estado atual do caso no banco
    const dosFatosTexto = (caso.peticao_inicial_rascunho || "").replace("DOS FATOS\n\n", "");

    const normalizedData = {
      comarca: process.env.DEFENSORIA_DEFAULT_COMARCA || "Teixeira de Freitas/BA",
      defensoraNome:
        process.env.DEFENSORIA_DEFAULT_DEFENSORA || "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA",
      triagemNumero: caso.protocolo,
    };

    // 2. Prepara os dados do formulário com o percentual recalculado e salário mínimo correto
    // Garante que campos do JSONB bruto (dados_formulario) preencham lacunas,
    // sem sobrescrever campos já normalizados pelo mapCasoRelations (que têm prioridade).
    const iaData = safeJsonParse(caso.ia?.dados_extraidos, {});
    const juridico = dataRaw.juridico || {};
    const baseData = {
      ...iaData,
      ...(caso.dados_formulario || {}),
      // Preenche lacunas com dados normalizados da tabela casos_juridico (fonte canônica)
      percentual_salario_minimo:
        caso.percentual_salario_minimo ||
        (juridico.percentual_salario ? String(juridico.percentual_salario) : null) ||
        iaData.percentual_salario_minimo ||
        (caso.dados_formulario || {}).percentual_salario_minimo,
      valor_mensal_pensao:
        caso.valor_mensal_pensao ||
        juridico.debito_valor ||
        iaData.valor_mensal_pensao ||
        (caso.dados_formulario || {}).valor_mensal_pensao,
      debito_penhora_valor:
        juridico.debito_penhora_valor || iaData.debito_penhora_valor || iaData.valor_debito_penhora,
      debito_prisao_valor:
        juridico.debito_prisao_valor || iaData.debito_prisao_valor || iaData.valor_debito_prisao,
      ...caso,
    };
    const valorMensalPensao = baseData.valor_mensal_pensao;
    const percentualSalarioMinimoCalculado = calcularPercentualSalarioMinimo(valorMensalPensao);
    const valorPensaoFormatado = formatCurrencyBr(valorMensalPensao);

    let acaoRaw =
      caso.dados_formulario?.acaoEspecifica ||
      (caso.tipo_acao || "").split(" - ")[1]?.trim() ||
      (caso.tipo_acao || "").trim();

    // Normalização básica: converte para snake_case
    const acaoKey = normalizeAcaoKey(acaoRaw);

    // [LÓGICA INTELIGENTE DE PERCENTUAL]
    // Se for FIXAÇÃO: O Valor manda (recalculamos sempre para bater com o salário mínimo atual)
    // Se for EXECUÇÃO/CUMPRIMENTO: O Percentual manda (é um dado fixo da sentença passada)
    const isFixacao = acaoKey === "fixacao_alimentos" || acaoKey === "alimentos_gravidicos";

    const finalPercentual =
      (!isFixacao &&
        (baseData.percentual_salario_minimo ||
          (baseData.percentual_salario ? String(baseData.percentual_salario) : null))) ||
      percentualSalarioMinimoCalculado ||
      baseData.percentual_salario_minimo;

    const dadosComPercentual = {
      ...baseData,
      percentual_salario_minimo: finalPercentual,
      percentual_definitivo_salario_min: finalPercentual,
      salario_minimo_atual: salarioMinimoAtual,
      salario_minimo_formatado: formatCurrencyBr(salarioMinimoAtual),
      valor_salario_minimo: formatCurrencyBr(salarioMinimoAtual),
      valor_pensao: valorPensaoFormatado,
      valor_pensao_solicitado: valorPensaoFormatado,
    };

    // 3. Gera o novo payload e o buffer do Word
    // Já usamos o 'caso' que já passou pelo mapCasoRelations no topo desta função
    const payload = buildDocxTemplatePayload(
      normalizedData,
      dosFatosTexto,
      dadosComPercentual, // ← FIX: usa os dados mesclados (filhos + valores recalculados)
      acaoKey,
    );

    const { getConfigAcaoBackend } = await import("../config/dicionarioAcoes.js");
    const configAcao = getConfigAcaoBackend(acaoKey);

    let docxPath; // URL da minuta primária ou única

    if (configAcao.gerarMultiplos) {
      const periodoParaCalculo =
        dadosComPercentual.periodo_debito_execucao || dadosComPercentual.periodo_debito || "";
      const docs = await generateMultiplosDocx(payload, acaoKey, periodoParaCalculo);

      // [TASK] Filtro: Se houver uma minuta cumulada E for solicitado pelo botão financeiro (solo_cumulado),
      // reprocessamos APENAS ela no "Regerar". Isso preserva minutas individuais editadas.
      const soloCumulado = req.body.solo_cumulado === true;
      const hasCumulado = docs.some((d) => d.tipo.toLowerCase().includes("cumulado"));
      const docsToProcess =
        hasCumulado && soloCumulado
          ? docs.filter((d) => d.tipo.toLowerCase().includes("cumulado"))
          : docs;

      let url_peticao_penhora = null;
      let url_peticao_prisao = null;
      let url_peticao_cumulado = null;
      const urlsDocumentosGerados = {};

      for (const doc of docsToProcess) {
        const pathMultiplo = `${caso.protocolo}/${doc.filename}`;

        if (isSupabaseConfigured) {
          const { error: uploadError } = await supabase.storage
            .from("peticoes")
            .upload(pathMultiplo, doc.buffer, {
              contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: true,
            });
          if (uploadError) throw new Error(`Erro upload Supabase: ${uploadError.message}`);
        } else {
          const localDir = path.resolve("uploads", "peticoes", caso.protocolo);
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
          logger.info(`[Local] Minuta (${doc.tipo}) regerada em ${localDir}`);
        }

        const extraKey = DOC_URL_KEY_BY_TIPO[doc.tipo];
        if (extraKey) urlsDocumentosGerados[extraKey] = pathMultiplo;
        if (doc.tipo === "execucao_penhora" || doc.tipo === "penhora")
          url_peticao_penhora = pathMultiplo;
        if (doc.tipo === "execucao_prisao" || doc.tipo === "prisao")
          url_peticao_prisao = pathMultiplo;
        if (doc.tipo === "execucao_cumulado" || doc.tipo === "cumulado")
          url_peticao_cumulado = pathMultiplo;
      }

      docxPath = url_peticao_cumulado || url_peticao_penhora || url_peticao_prisao;

      // 5. Atualiza a IA com as novas URLs múltiplas via JSONB flexível
      const currentExtra = safeJsonParse(caso.ia?.dados_extraidos, {});
      if (url_peticao_penhora) currentExtra.url_peticao_penhora = url_peticao_penhora;
      if (url_peticao_prisao) currentExtra.url_peticao_prisao = url_peticao_prisao;
      if (url_peticao_cumulado) currentExtra.url_peticao_cumulado = url_peticao_cumulado;
      Object.assign(currentExtra, urlsDocumentosGerados);

      let iaUpdateData = {
        url_peticao: docxPath,
        dados_extraidos: currentExtra,
      };

      if (url_peticao_penhora) iaUpdateData.url_peticao_penhora = url_peticao_penhora;
      if (url_peticao_prisao) iaUpdateData.url_peticao_prisao = url_peticao_prisao;

      if (isSupabaseConfigured) {
        await prisma.casos_ia.update({
          where: { caso_id: BigInt(id) },
          data: iaUpdateData,
        });
      } else {
        await prisma.casos_ia.update({
          where: { caso_id: BigInt(id) },
          data: iaUpdateData,
        });
      }
    } else {
      // Lógica ÚNICA: Apenas 1 doc gerado
      const docxBuffer = await generateDocx(payload, acaoKey);
      docxPath = `${caso.protocolo}/peticao_inicial_${caso.protocolo}.docx`;

      if (isSupabaseConfigured) {
        const { error: uploadError } = await supabase.storage
          .from("peticoes")
          .upload(docxPath, docxBuffer, {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
          });
        if (uploadError) throw new Error(`Erro upload Supabase: ${uploadError.message}`);
      } else {
        const localDir = path.resolve("uploads", "peticoes", caso.protocolo);
        await fs.mkdir(localDir, { recursive: true });
        await fs.writeFile(
          path.join(localDir, `peticao_inicial_${caso.protocolo}.docx`),
          docxBuffer,
        );
        logger.info(`[Local] Minuta regerada salva em ${localDir}`);
      }

      // 5. Atualiza URL única no banco
      const currentExtra = safeJsonParse(caso.ia?.dados_extraidos, {});
      currentExtra.url_peticao_penhora = docxPath;

      if (isSupabaseConfigured) {
        await supabase
          .from("casos_ia")
          .update({
            url_peticao: docxPath,
            url_peticao_penhora: docxPath,
            dados_extraidos: currentExtra,
          })
          .eq("caso_id", id);
      } else {
        await prisma.casos_ia.update({
          where: { caso_id: BigInt(id) },
          data: {
            url_peticao: docxPath,
            url_peticao_penhora: docxPath,
            dados_extraidos: currentExtra,
          },
        });
      }
    }

    // 6. Retorna o caso atualizado com as novas URLs assinadas
    // [FIX] Buscamos o caso atualizado do banco para garantir que attachSignedUrls tenha as chaves corretas (evita erro de Storage)
    const casoAtualizadoRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: {
        partes: true,
        ia: true,
        juridico: true,
        documentos: true,
        unidade: { select: { comarca: true, sistema: true } },
      },
    });

    const casoAtualizado = await attachSignedUrls(mapCasoRelations(casoAtualizadoRaw));
    res.status(200).json(stringifyBigInts(casoAtualizado));
  } catch (error) {
    logger.error(`Erro ao regerar minuta: ${error.message}`);
    res.status(500).json({ error: "Falha ao regerar a minuta em Word." });
  }
};

export const substituirMinuta = async (req, res) => {
  const { id } = req.params;
  const { documentKey: rawDocumentKey } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: "Arquivo não enviado." });
  if (!rawDocumentKey) return res.status(400).json({ error: "Chave do documento não informada." });

  // 1. Normaliza a chave (frontend envia chaves curtas como "penhora", "prisao")
  let documentKey = DOC_URL_KEY_BY_TIPO[rawDocumentKey] || rawDocumentKey;
  if (documentKey === "termo") documentKey = "url_termo_declaracao";

  // 2. Validações de arquivo e allowlist
  const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

  if (file.mimetype !== DOCX_MIME || !file.originalname.toLowerCase().endsWith(".docx")) {
    return res.status(400).json({ error: "Apenas arquivos .docx são aceitos." });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return res.status(400).json({ error: "Arquivo excede o tamanho máximo de 10MB." });
  }
  if (!ALLOWED_MINUTA_KEYS.has(documentKey)) {
    logger.warn(
      `[Upload Minuta] Chave rejeitada: "${documentKey}" (original: "${rawDocumentKey}")`,
    );
    return res.status(400).json({
      error: "Chave de documento inválida.",
      detalhes: `A chave ${documentKey} não está na lista de permissões.`,
    });
  }

  try {
    // 3. Autorização via carregarCasoDetalhado (já implementa isAdmin/isOwner/isShared e lança HttpError(423))
    const caso = await carregarCasoDetalhado(id, req.user);
    const ia = Array.isArray(caso.ia) ? caso.ia[0] : caso.ia; // Reuso da relação carregada
    const protocolo = caso.protocolo;
    const extras = safeJsonParse(ia?.dados_extraidos, {});

    // 4. Upload para o Supabase Storage (Bucket peticoes)
    const safeName = file.originalname.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const storagePath = `${protocolo}/substituicao_${Date.now()}_${safeName}`;

    if (isSupabaseConfigured) {
      const fileStream = fsSync.createReadStream(file.path);
      const { error: uploadError } = await supabase.storage
        .from("peticoes")
        .upload(storagePath, fileStream, {
          contentType: file.mimetype,
          duplex: "half",
        });

      if (uploadError) throw new Error(`Erro no upload: ${uploadError.message}`);
    } else {
      // Fallback local
      const localDir = path.resolve("uploads", "peticoes", protocolo);
      await fs.mkdir(localDir, { recursive: true });
      const localPath = path.join(localDir, path.basename(storagePath));
      await fs.copyFile(file.path, localPath);
    }

    // 5. Atualiza o Histórico de Versões
    const oldUrl = ia?.[documentKey] || extras[documentKey];
    const historico = extras.historico_versoes || [];

    if (oldUrl) {
      historico.push({
        data: new Date(),
        url_antiga: oldUrl,
        chave: documentKey,
        substituido_por: req.user.nome,
      });
    }

    // 6. Atualiza o Banco de Dados
    const updatedExtras = {
      ...extras,
      [documentKey]: storagePath,
      historico_versoes: historico,
    };

    const iaUpdateData = { dados_extraidos: updatedExtras };
    if (DIRECT_COLUMN_KEYS.has(documentKey)) {
      iaUpdateData[documentKey] = storagePath;
    }

    if (isSupabaseConfigured) {
      const { error: dbError } = await supabase
        .from("casos_ia")
        .update(iaUpdateData)
        .eq("caso_id", id);
      if (dbError) throw new Error(`Falha ao atualizar casos_ia no Supabase: ${dbError.message}`);
    } else {
      await prisma.casos_ia.update({
        where: { caso_id: BigInt(id) },
        data: iaUpdateData,
      });
    }

    // 7. Log de auditoria (LGPD-safe: remove nome_arquivo)
    await registrarLog(req.user.id, "substituir_minuta", "casos", id, {
      documento: documentKey,
    });

    res.status(200).json({
      message: "Minuta substituída com sucesso!",
      url: storagePath,
    });
  } catch (error) {
    logger.error(`Erro ao substituir minuta do caso ${id}: ${error.message}`);
    if (error.statusCode) {
      return res.status(error.statusCode).json(error.payload || { error: error.message });
    }
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno ao substituir minuta." });
    }
  } finally {
    // Garante limpeza mesmo que upload ou DB falhem (Task 05)
    if (file?.path) {
      try {
        await fs.unlink(file.path);
      } catch (e) {
        logger.warn(`[substituirMinuta] Falha ao limpar temp: ${file.path}`);
      }
    }
  }
};

export const buscarPorCpf = async (req, res) => {
  const cpf = req.params.cpf || req.query.cpf;
  if (!cpf) return res.status(400).json({ error: "CPF não fornecido." });

  const cleanCpf = cpf.replace(/\D/g, "");

  try {
    const query = isSupabaseConfigured
      ? supabase
          .from("casos")
          .select(
            `
            id,
            protocolo,
            status,
            unidade_id,
            numero_processo,
            numero_solar,
            url_capa_processual,
            partes:casos_partes!inner(
              nome_assistido,
              cpf_assistido,
              nome_representante,
              cpf_representante,
              rg_representante,
              emissor_rg_representante,
              nacionalidade_representante,
              estado_civil_representante,
              profissao_representante,
              data_nascimento_representante,
              nome_mae_representante,
              nome_pai_representante,
              endereco_assistido,
              telefone_assistido,
              email_assistido
            ),
            unidade:unidades(nome, comarca)
          `,
          )
          .or(
            `cpf_assistido.eq.${cleanCpf},cpf_representante.eq.${cleanCpf},cpf_assistido.eq.${cpf},cpf_representante.eq.${cpf}`,
            { foreignTable: "casos_partes" },
          )
          .order("created_at", { ascending: false })
      : prisma.casos.findMany({
          where: {
            partes: {
              OR: [
                { cpf_assistido: cleanCpf },
                { cpf_assistido: cpf },
                { cpf_representante: cleanCpf },
                { cpf_representante: cpf },
              ],
            },
          },
          select: {
            id: true,
            protocolo: true,
            status: true,
            unidade_id: true,
            numero_processo: true,
            numero_solar: true,
            url_capa_processual: true,
            partes: true,
            unidade: { select: { nome: true, comarca: true } },
          },
          orderBy: { created_at: "desc" },
        });

    const results = isSupabaseConfigured ? (await query).data : await query;

    if (!results || results.length === 0) return res.status(200).json([]);

    let filteredResults = results;

    if (req.user) {
      const isPowerUser = ["admin", "gestor"].includes(req.user.cargo?.toLowerCase());

      const collaborations = await prisma.assistencia_casos.findMany({
        where: {
          OR: [{ destinatario_id: req.user.id }, { remetente_id: req.user.id }],
          status: "aceito",
        },
        select: { caso_id: true },
      });
      const sharedIds = new Set(collaborations.map((c) => String(c.caso_id)));

      filteredResults = results.filter((caso) => {
        if (isPowerUser) return true;
        if (String(caso.unidade_id) === String(req.user.unidade_id)) return true;
        if (sharedIds.has(String(caso.id))) return true;
        return false;
      });
    }

    if (filteredResults.length === 0) {
      return res.status(200).json([]);
    }

    const normalizedData = await Promise.all(
      filteredResults.map(async (casoRaw) => {
        const urlCapaProcessual = casoRaw.url_capa_processual
          ? await buildSignedUrl(storageBuckets.documentos, casoRaw.url_capa_processual)
          : null;

        const partesObj = Array.isArray(casoRaw.partes) ? casoRaw.partes[0] : casoRaw.partes;

        // Extraímos os dados da representante para o prefill
        const dadosRepresentante = {
          nome_representante: partesObj?.nome_representante,
          cpf_representante: partesObj?.cpf_representante,
          rg_representante: partesObj?.rg_representante,
          emissor_rg_representante: partesObj?.emissor_rg_representante,
          nacionalidade_representante: partesObj?.nacionalidade_representante,
          estado_civil_representante: partesObj?.estado_civil_representante,
          profissao_representante: partesObj?.profissao_representante,
          data_nascimento_representante: partesObj?.data_nascimento_representante,
          nome_mae_representante: partesObj?.nome_mae_representante,
          nome_pai_representante: partesObj?.nome_pai_representante,
          endereco_representante: partesObj?.endereco_assistido,
          telefone_representante: partesObj?.telefone_assistido,
          email_representante: partesObj?.email_assistido,
          CIDADEASSINATURA: casoRaw.unidade?.comarca,
        };

        return {
          id: casoRaw.id,
          protocolo: casoRaw.protocolo,
          status: casoRaw.status,
          nome_assistido: partesObj?.nome_assistido || "Não informado",
          nome_representante: partesObj?.nome_representante || "Não informado",
          descricao: casoRaw.descricao_pendencia || "",
          numero_processo: casoRaw.numero_processo || null,
          numero_solar: casoRaw.numero_solar || null,
          url_capa_processual: urlCapaProcessual,
          unidade_nome: casoRaw.unidade?.nome,
          dados_representante: dadosRepresentante,
          protocolo_referencia: casoRaw.protocolo,
        };
      }),
    );

    res.status(200).json(stringifyBigInts(normalizedData));
  } catch (error) {
    logger.error(`Erro ao buscar por CPF ${cpf}: ${error.message}`);
    res.status(500).json({ error: "Erro ao buscar por CPF." });
  }
};

export const finalizarCasoSolar = async (req, res) => {
  const { id } = req.params;
  const { numero_solar, numero_processo } = req.body;
  let url_capa_processual = null;
  try {
    if (req.file) {
      const file = req.file;
      const safeOriginalName = sanitizeFilename(path.basename(file.originalname));
      const filePath = `capas/${id}_${Date.now()}_${safeOriginalName}`;

      if (isSupabaseConfigured) {
        const fileStream = fsSync.createReadStream(file.path);
        const { error: uploadError } = await supabase.storage
          .from(storageBuckets.documentos)
          .upload(filePath, fileStream, {
            contentType: file.mimetype,
            duplex: "half",
          });
        if (uploadError) throw uploadError;
        url_capa_processual = filePath;
      } else {
        // Fallback Local
        const localDir = path.resolve("uploads", "capas");
        await fs.mkdir(localDir, { recursive: true });
        const localPath = path.join(localDir, `${id}_${Date.now()}_${safeOriginalName}`);
        await fs.copyFile(file.path, localPath);
        url_capa_processual = `capas/${path.basename(localPath)}`;
        logger.info(`[Local] Capa processual salva em ${localPath}`);
      }
      await fs.unlink(file.path);
    }

    const updateData = {
      status: "protocolado",
      numero_solar,
      numero_processo,
      url_capa_processual,
      protocolado_at: new Date(),
      finished_at: new Date(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase.from("casos").update(updateData).eq("id", id);
      if (error) throw error;
    } else {
      await prisma.casos.update({
        where: { id: BigInt(id) },
        data: updateData,
      });
    }

    res.status(200).json({ message: "Caso finalizado com sucesso." });
  } catch (error) {
    logger.error(`Erro ao finalizar caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao finalizar caso." });
  }
};

export const reverterFinalizacao = async (req, res) => {
  if (!req.user || req.user.cargo.toLowerCase() !== "admin") {
    return res.status(403).json({
      error: "Acesso negado. Apenas administradores podem reverter a finalização.",
    });
  }

  const { id } = req.params;

  try {
    let caso;
    if (isSupabaseConfigured) {
      const { data, error: fetchError } = await supabase
        .from("casos")
        .select("url_capa_processual, protocolo")
        .eq("id", id)
        .single();
      if (fetchError || !data) throw new Error("Caso não encontrado");
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        select: { url_capa_processual: true, protocolo: true },
      });
      if (!caso) throw new Error("Caso não encontrado");
    }

    const { url_capa_processual } = caso;

    if (url_capa_processual) {
      if (isSupabaseConfigured) {
        const filePath = extractObjectPath(url_capa_processual);
        if (filePath) {
          logger.info(`Revertendo finalização: Excluindo capa do Supabase para o caso ${id}`);
          await supabase.storage.from(storageBuckets.documentos).remove([filePath]);
        }
      } else {
        // Fallback Local
        const localPath = path.resolve("uploads", url_capa_processual);
        try {
          await fs.unlink(localPath);
          logger.info(`[Local] Capa processual removida: ${localPath}`);
        } catch (e) {
          logger.warn(`Falha ao remover capa local: ${localPath}`, e.message);
        }
      }
    }

    const updateData = {
      status: "pronto_para_analise",
      numero_solar: null,
      numero_processo: null,
      url_capa_processual: null,
      finished_at: null,
    };

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase.from("casos").update(updateData).eq("id", id);
      if (updateError) throw updateError;
    } else {
      await prisma.casos.update({
        where: { id: BigInt(id) },
        data: updateData,
      });
    }

    logger.info(
      `Finalização do caso ${caso.protocolo} (ID: ${id}) revertida por ${req.user.email}.`,
    );
    res.status(200).json({ message: "Finalização revertida com sucesso." });
  } catch (error) {
    logger.error(`Erro ao reverter finalização do caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao reverter finalização do caso." });
  }
};

export const resetarChaveAcesso = async (req, res) => {
  const { id } = req.params;
  try {
    let caso;
    if (isSupabaseConfigured) {
      const { data } = await supabase.from("casos").select("tipo_acao").eq("id", id).single();
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        select: { tipo_acao: true },
      });
    }

    if (!caso) throw new Error("Caso não encontrado");

    res
      .status(410)
      .json({ error: "Funcionalidade desativada: O sistema não utiliza mais Chaves de Acesso." });
  } catch (error) {
    logger.error(`Erro ao resetar chave do caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao resetar chave." });
  }
};
export const receberDocumentosComplementares = async (req, res) => {
  const { id } = req.params;
  const cpfRaw = req.body.cpf || req.query.cpf;
  const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "") : null;
  const { nomes_arquivos } = req.body;

  try {
    // Log seguro sem expor o CPF completo
    logger.info(`[Upload Complementar] Iniciando. ID: ${id}, CPF recebido: ${!!cpf}`);

    let caso = null;
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isInt = /^\d+$/.test(id) && id !== "0";

    // 1. Busca do caso
    if (isSupabaseConfigured) {
      if (isUUID || isInt) {
        const { data } = await supabase
          .from("casos")
          .select("*, ia:casos_ia(*)")
          .eq("id", id)
          .single();
        caso = data;
      } else if (id !== "0") {
        const { data } = await supabase
          .from("casos")
          .select("*, ia:casos_ia(*)")
          .eq("protocolo", id)
          .single();
        caso = data;
      }
    } else {
      if (isInt) {
        caso = await prisma.casos.findUnique({ where: { id: BigInt(id) }, include: { ia: true } });
      } else if (id !== "0") {
        caso = await prisma.casos.findUnique({ where: { protocolo: id }, include: { ia: true } });
      }
    }

    if (!caso && cpf) {
      if (isSupabaseConfigured) {
        const cpfLimpo = cpf.replace(/\D/g, "");
        const [assistidoResult, representanteResult] = await Promise.all([
          supabase.from("casos_partes").select("caso_id").eq("cpf_assistido", cpfLimpo).limit(1),
          supabase
            .from("casos_partes")
            .select("caso_id")
            .eq("cpf_representante", cpfLimpo)
            .limit(1),
        ]);

        let casoId = null;
        if (assistidoResult.data?.length > 0) {
          casoId = assistidoResult.data[0].caso_id;
        } else if (representanteResult.data?.length > 0) {
          casoId = representanteResult.data[0].caso_id;
        }

        if (casoId) {
          const { data } = await supabase
            .from("casos")
            .select("*, ia:casos_ia(*)")
            .eq("id", casoId)
            .single();
          caso = data;
        }
      } else {
        caso = await prisma.casos.findFirst({
          where: {
            partes: {
              OR: [
                { cpf_assistido: cpf.replace(/\D/g, "") },
                { cpf_representante: cpf.replace(/\D/g, "") },
              ],
            },
          },
          include: { ia: true },
        });
      }
    }

    if (!caso) throw new Error("Caso não encontrado.");

    const novosUrls = [];

    // 2. Processa e sobe os arquivos
    if (req.files && req.files.documentos) {
      for (const docFile of req.files.documentos) {
        const safeName = sanitizeFilename(docFile.originalname);
        const filePath = `${caso.protocolo}/complementar_${Date.now()}_${safeName}`;

        if (isSupabaseConfigured) {
          const docStream = fsSync.createReadStream(docFile.path);
          const { error: uploadError } = await supabase.storage
            .from("documentos")
            .upload(filePath, docStream, {
              contentType: docFile.mimetype,
              duplex: "half",
            });

          if (!uploadError) {
            novosUrls.push(filePath);
            await supabase.from("documentos").insert({
              caso_id: caso.id,
              storage_path: filePath,
              nome_original: docFile.originalname,
              tipo: "complementar",
              tamanho_bytes: docFile.size,
            });
          }
        } else {
          const localDir = path.resolve("uploads", "documentos", caso.protocolo);
          await fs.mkdir(localDir, { recursive: true });
          const localPath = path.join(localDir, `complementar_${Date.now()}_${safeName}`);
          await fs.copyFile(docFile.path, localPath);
          const relativePath = `${caso.protocolo}/${path.basename(localPath)}`;
          novosUrls.push(relativePath);

          await prisma.documentos.create({
            data: {
              caso_id: caso.id,
              storage_path: relativePath,
              nome_original: docFile.originalname,
              tipo: "complementar",
              tamanho_bytes: BigInt(docFile.size),
            },
          });
        }

        try {
          await fs.unlink(docFile.path);
        } catch (e) {
          logger.warn(`Falha ao limpar temporário: ${docFile.path}`);
        }
      }
    }

    if (novosUrls.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo enviado ou erro no upload." });
    }

    // 3. Atualiza metadados na tabela casos_ia (CORREÇÃO DO ERRO 500)
    const nomesMap = safeJsonParse(nomes_arquivos, {});
    let iaData = caso.ia && caso.ia[0] ? caso.ia[0] : caso.ia; // Trata array ou objeto
    const currentDadosExtraidos =
      typeof iaData?.dados_extraidos === "string"
        ? safeJsonParse(iaData.dados_extraidos, {})
        : iaData?.dados_extraidos || {};

    const currentNames = currentDadosExtraidos.document_names || {};
    const updatedNames = { ...currentNames, ...nomesMap };
    const updatedDadosExtraidos = {
      ...currentDadosExtraidos,
      document_names: updatedNames,
    };

    if (isSupabaseConfigured) {
      // Usar upsert para criar o registro caso_ia se não existir
      await supabase.from("casos_ia").upsert(
        {
          caso_id: caso.id,
          dados_extraidos: updatedDadosExtraidos,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "caso_id" },
      );
    } else {
      await prisma.casos_ia.upsert({
        where: { caso_id: caso.id },
        update: { dados_extraidos: updatedDadosExtraidos },
        create: {
          caso_id: caso.id,
          dados_extraidos: updatedDadosExtraidos,
        },
      });
    }

    // 4. Determina se deve disparar o processamento em background (IA/DocGen)
    // Só disparamos se o caso ainda estiver em fase de triagem/documentação ou erro.
    // Se o caso já estiver em análise, atendimento ou protocolo, apenas salvamos o documento.
    const statusElegiveisParaReprocessar = [
      "aguardando_documentos",
      "documentos_entregues",
      "erro_processamento",
      "processando_ia",
    ];

    const deveTriggerBackground = statusElegiveisParaReprocessar.includes(caso.status);

    if (deveTriggerBackground) {
      const updatePayload = {
        status: "documentacao_completa",
        updated_at: new Date(),
      };

      if (isSupabaseConfigured) {
        await supabase.from("casos").update(updatePayload).eq("id", caso.id);
      } else {
        await prisma.casos.update({ where: { id: caso.id }, data: updatePayload });
      }

      // 6. Dispara o processamento em background (IA / OCR / Merge)
      setImmediate(() => {
        processarCasoEmBackground(
          caso.protocolo,
          updatedDadosExtraidos,
          novosUrls,
          caso.url_audio,
          caso.url_peticao,
        ).catch((e) => logger.error(`[Background Upload Complementar] Erro: ${e.message}`));
      });

      // 5. Cria Notificação para o Defensor/Servidor (Restaurado)
      const mensagemNotif = `Novos documentos entregues por ${caso.nome_assistido || "Assistido"}.`;

      if (isSupabaseConfigured) {
        const destinatarioId = caso.servidor_id || caso.defensor_id;
        if (destinatarioId) {
          const { error: notifError } = await supabase.from("notificacoes").insert({
            usuario_id: destinatarioId,
            titulo: "Documentos Complementares",
            mensagem: mensagemNotif,
            tipo: "upload",
            link: `/painel/casos/${caso.id}`,
            lida: false,
          });

          if (notifError) {
            logger.error(`Erro ao criar notificação de upload: ${notifError.message}`);
          }
        }
      }

      return res.status(200).json({
        message: "Documentos anexados com sucesso e caso enviado para processamento!",
        reprocessed: true,
      });
    } else {
      // Caso já avançado: Apenas atualiza o timestamp de alteração
      if (isSupabaseConfigured) {
        await supabase.from("casos").update({ updated_at: new Date() }).eq("id", caso.id);
      } else {
        await prisma.casos.update({ where: { id: caso.id }, data: { updated_at: new Date() } });
      }

      // 5. Cria Notificação para o Defensor/Servidor
      const mensagemNotif = `Novos documentos entregues por ${caso.nome_assistido || "Assistido"}.`;

      if (isSupabaseConfigured) {
        const destinatarioId = caso.servidor_id || caso.defensor_id;
        if (destinatarioId) {
          const { error: notifError } = await supabase.from("notificacoes").insert({
            usuario_id: destinatarioId,
            titulo: "Documentos Complementares",
            mensagem: mensagemNotif,
            tipo: "upload",
            link: `/painel/casos/${caso.id}`,
            lida: false,
          });

          if (notifError) {
            logger.error(`Erro ao criar notificação de upload: ${notifError.message}`);
          }
        }
      }

      return res.status(200).json({
        message: "Documentos anexados com sucesso ao caso (status preservado).",
        reprocessed: false,
      });
    }
  } catch (error) {
    logger.error(`Erro upload complementar para caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Falha ao enviar documentos." });
  }
};

// --- DELETAR CASO (Apenas Admin) ---
export const deletarCaso = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificação de permissão de admin
    if (!req.user || req.user.cargo.toLowerCase() !== "admin") {
      return res.status(403).json({
        error: "Acesso negado. Apenas administradores podem excluir casos.",
      });
    }

    // --- BUSCA COMPLETA ANTES DE DELETAR (Necessário para limpar storage devido ao CASCADE) ---
    // Buscamos via Prisma para garantir que as relações IA e Documentos venham juntas
    const casoRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: { ia: true, documentos: true },
    });

    if (!casoRaw) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // Enriquecer dados para garantir que virtual fields de URLs existam (url_peticao, etc)
    const caso = mapCasoRelations(casoRaw);

    // --- REMOVER ARQUIVOS DO STORAGE (Apenas se Supabase configurado) ---
    if (isSupabaseConfigured) {
      const filesToDelete = {
        [storageBuckets.audios]: [],
        [storageBuckets.peticoes]: [],
        [storageBuckets.documentos]: [],
      };

      const addFile = (bucket, path) => {
        if (!path) return;
        const cleanPath = extractObjectPath(path);
        if (cleanPath && !filesToDelete[bucket].includes(cleanPath)) {
          filesToDelete[bucket].push(cleanPath);
        }
      };

      // 1. Audio
      addFile(storageBuckets.audios, caso.url_audio);

      // 2. Petições / Minutas (Todas as possíveis chaves do schema e dados_extraidos)
      addFile(storageBuckets.peticoes, caso.url_peticao);
      addFile(storageBuckets.peticoes, caso.url_peticao_penhora);
      addFile(storageBuckets.peticoes, caso.url_peticao_prisao);
      addFile(storageBuckets.peticoes, caso.url_peticao_cumulado);
      addFile(storageBuckets.peticoes, caso.url_documento_gerado);
      addFile(storageBuckets.peticoes, caso.url_termo_declaracao);
      
      // Chaves extras dinâmicas (se houver no JSONB dados_extraidos)
      URL_KEYS_DOCUMENTOS_GERADOS.forEach((key) => addFile(storageBuckets.peticoes, caso[key]));

      // 3. Documentos Originais e Capa
      addFile(storageBuckets.documentos, caso.url_capa_processual);
      
      // Documentos da tabela documentos (via mapCasoRelations, ficam em urls_documentos)
      if (Array.isArray(caso.urls_documentos)) {
        caso.urls_documentos.forEach((docPath) => addFile(storageBuckets.documentos, docPath));
      }

      // Executar deleção em paralelo por bucket para otimização
      await Promise.all(
        Object.entries(filesToDelete).map(async ([bucket, files]) => {
          if (files.length > 0) {
            logger.info(
              `🗑️ Storage: Excluindo ${files.length} arquivos do bucket '${bucket}' (Caso ${id})`,
            );
            const { error: storageError } = await supabase.storage.from(bucket).remove(files);
            if (storageError) {
              logger.warn(`[Storage] Erro parcial ao remover arquivos do bucket ${bucket}: ${storageError.message}`);
            }
          }
        }),
      );
    } else {
      // Se local, poderíamos remover os arquivos da pasta uploads no futuro
      logger.info(`[Local] Ignorando limpeza de storage para o caso ${id}`);
    }

    // --- LIMPEZA DE REFERÊNCIAS (Prevenção de erro de Constraint) ---
    // Bug Fix: Supabase update/delete não lançam exceções — retornam { error }.
    if (isSupabaseConfigured) {
      // Logs de auditoria: mantém o log histórico mas desvincula do caso (SetNull)
      await supabase.from("logs_auditoria").update({ caso_id: null }).eq("caso_id", id);
      
      // Notificações: apaga as notificações ligadas a este link exato
      await supabase.from("notificacoes").delete().eq("link", `/painel/casos/${id}`);
    } else {
      await prisma.logs_auditoria.updateMany({
        where: { caso_id: BigInt(id) },
        data: { caso_id: null },
      });
      // Usa endsWith para match exato do sufixo, evitando colisão entre IDs similares (12 vs 123)
      await prisma.notificacoes.deleteMany({
        where: { link: { endsWith: `/casos/${id}` } },
      });
    }

    // --- EXCLUSÃO FINAL DO CASO ---
    // Tabelas partes, juridico, ia e documentos possuem CASCADE no Prisma/Postgres
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase.from("casos").delete().eq("id", id);
      if (deleteError) throw deleteError;
    } else {
      await prisma.casos.delete({
        where: { id: BigInt(id) },
      });
    }

    logger.info(`✅ Caso ${id} (Protocolo: ${caso.protocolo}) excluído com sucesso por admin.`);
    res.json({ message: "Caso excluído com sucesso." });
  } catch (err) {
    logger.error(`❌ Erro ao deletar caso ${id}: ${err.message}`);
    res.status(500).json({ error: `Erro ao excluir caso: ${err.message}` });
  }
};

// --- REPROCESSAR CASO (Manual) ---
export const reprocessarCaso = async (req, res) => {
  const { id } = req.params;
  try {
    // Busca os dados originais do caso do schema novo
    let casoRaw;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("casos")
        .select(
          "*, ia:casos_ia(*), partes:casos_partes(*), juridico:casos_juridico(*), documentos(*)",
        )
        .eq("id", id)
        .single();
      if (error || !data) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      casoRaw = mapCasoRelations(data);
    } else {
      const dataFull = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: { ia: true, partes: true, juridico: true, documentos: true },
      });
      if (!dataFull) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      casoRaw = mapCasoRelations(dataFull);
    }

    // Adaptando para o novo Schema: A IA é a base, mas o Banco (dados_formulario) e as Tabelas Relacionais (fallback) têm prioridade.
    const baseExtraidos =
      typeof casoRaw.ia?.dados_extraidos === "string"
        ? JSON.parse(casoRaw.ia.dados_extraidos)
        : casoRaw.ia?.dados_extraidos || {};

    const fallbackDadosFormulario = buildDadosFormularioFallback(casoRaw);
    const dadosFormularioBanco =
      typeof casoRaw.dados_formulario === "object" && casoRaw.dados_formulario
        ? casoRaw.dados_formulario
        : {};

    // Limpar valores 'não informado' ou '______' do baseExtraidos para segurança
    const cleanBaseExtraidos = {};
    for (const key in baseExtraidos) {
      if (
        baseExtraidos[key] &&
        baseExtraidos[key] !== "não informado" &&
        baseExtraidos[key] !== "______" &&
        baseExtraidos[key] !== "[PREENCHER]"
      ) {
        cleanBaseExtraidos[key] = baseExtraidos[key];
      }
    }

    // Limpar valores vazios que possam vir do fallback
    const cleanFallback = {};
    for (const key in fallbackDadosFormulario) {
      if (
        fallbackDadosFormulario[key] &&
        fallbackDadosFormulario[key] !== "não informado" &&
        fallbackDadosFormulario[key] !== "______"
      ) {
        cleanFallback[key] = fallbackDadosFormulario[key];
      }
    }

    // ── Deep Merge: dados jurídicos do defensor têm PRIORIDADE MÁXIMA ────────────
    // Garante que dados bancários e campos de fixação editados pelo defensor na
    // tela DetalhesCaso.jsx (salvos em casos_juridico via PATCH /juridico) não
    // sejam perdidos quando o reprocessamento regenerar o payload do template.
    const juridicoDB = casoRaw.juridico || {};

    // Reconstrói dados_bancarios_exequente a partir dos campos normalizados no DB
    // Apenas sobrescreve se o defensor tiver preenchido os campos no painel jurídico
    const dadosBancariosDerivados = (() => {
      const banco = juridicoDB.conta_banco || "";
      const agencia = juridicoDB.conta_agencia || "";
      const operacao = juridicoDB.conta_operacao || "";
      const numero = juridicoDB.conta_numero || "";
      if (!banco && !agencia && !numero) return {};
      const partes = [banco, agencia, operacao, numero].filter(Boolean).join(" / ");
      return {
        dados_bancarios_exequente: partes,
        dados_bancarios_deposito: partes,
        banco_deposito: banco,
        agencia_deposito: agencia,
        conta_operacao: operacao,
        conta_deposito: numero,
      };
    })();

    // Campos extras do juridicoDB que alimentam o template diretamente
    const camposJuridicoExtras = {
      ...(juridicoDB.descricao_guarda ? { descricao_guarda: juridicoDB.descricao_guarda } : {}),
      ...(juridicoDB.bens_partilha ? { bens_partilha: juridicoDB.bens_partilha } : {}),
      ...(juridicoDB.situacao_financeira_genitora
        ? { situacao_financeira_genitora: juridicoDB.situacao_financeira_genitora }
        : {}),
      ...(juridicoDB.vencimento_dia ? { dia_pagamento: String(juridicoDB.vencimento_dia) } : {}),
      ...(juridicoDB.debito_valor ? { valor_mensal_pensao: juridicoDB.debito_valor } : {}),
      ...(juridicoDB.debito_penhora_valor
        ? { debito_penhora_valor: juridicoDB.debito_penhora_valor }
        : {}),
      ...(juridicoDB.debito_penhora_extenso
        ? { debito_penhora_extenso: juridicoDB.debito_penhora_extenso }
        : {}),
      ...(juridicoDB.debito_prisao_valor
        ? { debito_prisao_valor: juridicoDB.debito_prisao_valor }
        : {}),
      ...(juridicoDB.debito_prisao_extenso
        ? { debito_prisao_extenso: juridicoDB.debito_prisao_extenso }
        : {}),
      ...(juridicoDB.opcao_guarda
        ? { opcao_guarda: juridicoDB.opcao_guarda, opcaoGuarda: juridicoDB.opcao_guarda }
        : {}),
      ...(juridicoDB.empregador_nome ? { empregador_nome: juridicoDB.empregador_nome } : {}),
      ...(juridicoDB.empregador_email ? { empregador_email: juridicoDB.empregador_email } : {}),
    };

    const dados_extraidos = {
      ...cleanBaseExtraidos,
      ...dadosFormularioBanco,
      ...cleanFallback,
      // Dados bancários e jurídicos salvos pelo defensor sobrescrevem tudo (prioridade máxima)
      ...dadosBancariosDerivados,
      ...camposJuridicoExtras,
      tipoAcao: casoRaw.tipo_acao || cleanBaseExtraidos.tipoAcao || cleanFallback.tipoAcao,
    };

    const docsExtraidos = casoRaw.documentos ? casoRaw.documentos.map((d) => d.storage_path) : [];

    // Responde imediatamente para a interface não travar
    res.status(200).json({ message: "Reprocessamento iniciado em background." });

    // Dispara o worker novamente
    setImmediate(async () => {
      try {
        await processarCasoEmBackground(
          casoRaw.protocolo,
          dados_extraidos,
          docsExtraidos,
          null, // url áudio deprecated/não usado no mutirão
          null, // url_petição base null, vai regenerar e sobrescrever
        );
      } catch (err) {
        logger.error(`Erro ao reprocessar caso ${id}: ${err.message}`);
      }
    });
  } catch (error) {
    logger.error(`Erro ao solicitar reprocessamento: ${error.message}`);
    if (!res.headersSent) res.status(500).json({ error: "Erro interno ao reprocessar." });
  }
};

export const renomearDocumento = async (req, res) => {
  const { id } = req.params;
  const { fileUrl, newName } = req.body;

  try {
    const { data: caso, error } = await supabase
      .from("casos")
      .select("dados_formulario")
      .eq("id", id)
      .single();

    if (error || !caso) throw new Error("Caso não encontrado");

    const dados = caso.dados_formulario || {};
    const docNames = dados.document_names || {};

    // Usa o nome do arquivo (extraído da URL) como chave para salvar o novo nome
    const fileName = fileUrl.split("/").pop().split("?")[0];
    docNames[decodeURIComponent(fileName)] = newName;

    dados.document_names = docNames;
    dados.documentNames = docNames; // Compatibilidade

    await supabase.from("casos").update({ dados_formulario: dados }).eq("id", id);

    res.status(200).json({ message: "Documento renomeado com sucesso." });
  } catch (e) {
    res.status(500).json({ error: "Erro ao renomear documento." });
  }
};

export const alternarArquivamento = async (req, res) => {
  const { id } = req.params;
  const { arquivado, motivo, motivo_codigo, observacao_arquivamento } = req.body; // espera true ou false
  const motivosPermitidos = new Set([
    "duplicidade",
    "desistencia",
    "dados_inconsistentes",
    "fora_do_escopo",
    "outro",
  ]);
  const motivoNormalizado = String(motivo_codigo || motivo || "").trim();
  const observacaoNormalizada = String(observacao_arquivamento || "").trim();

  // Validação: Motivo obrigatório ao arquivar
  if (arquivado === true && !motivosPermitidos.has(motivoNormalizado)) {
    return res.status(400).json({
      error: "Motivo de arquivamento invalido.",
    });
  }

  try {
    const updateData = { arquivado };
    if (arquivado) {
      updateData.motivo_arquivamento = motivoNormalizado;
      updateData.observacao_arquivamento = observacaoNormalizada || null;
    } else {
      updateData.motivo_arquivamento = null; // Limpa o motivo ao restaurar
      updateData.observacao_arquivamento = null;
    }

    const { data, error } = await supabase
      .from("casos")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar arquivamento" });
  }
};

// --- CONTROLLERS DE NOTIFICAÇÃO ---

export const listarNotificacoes = async (req, res) => {
  try {
    const notificacoes = await prisma.notificacoes.findMany({
      where: { usuario_id: req.user.id },
      orderBy: { created_at: "desc" },
      take: 20,
    });
    res.status(200).json(stringifyBigInts(notificacoes));
  } catch (error) {
    logger.error(`Erro ao listar notificações: ${error.message}`);
    res.status(500).json({ error: "Erro ao buscar notificações." });
  }
};

export const marcarNotificacaoLida = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.notificacoes.update({
      where: { id },
      data: { lida: true },
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar notificação." });
  }
};

// --- CONTROLLERS DE ASSISTÊNCIA / COMPARTILHAMENTO ---

export const solicitarAssistencia = async (req, res) => {
  const { id: caso_id } = req.params;
  const { destinatario_id } = req.body;
  const remetente_id = req.user.id;

  try {
    // 1. Cria o registro de assistência
    const assistencia = await prisma.assistencia_casos.create({
      data: {
        caso_id: BigInt(caso_id),
        remetente_id,
        destinatario_id,
        status: "pendente",
      },
    });

    // 2. Cria a notificação para o destinatário
    await prisma.notificacoes.create({
      data: {
        usuario_id: destinatario_id,
        titulo: "Pedido de Colaboração",
        mensagem: `${req.user.nome} solicitou sua ajuda no caso #${caso_id}.`,
        tipo: "assistencia",
        referencia_id: assistencia.id,
        link: `/painel/casos/${caso_id}`,
      },
    });

    res.status(201).json({
      message: "Solicitação enviada!",
      assistencia_id: assistencia.id,
    });
  } catch (error) {
    logger.error(`Erro ao solicitar assistência: ${error.message}`);
    res.status(500).json({ error: "Erro ao enviar solicitação." });
  }
};

export const responderAssistencia = async (req, res) => {
  const { assistencia_id } = req.params;
  const { aceito } = req.body; // boolean
  const userId = req.user.id;

  try {
    const assistencia = await prisma.assistencia_casos.findUnique({
      where: { id: assistencia_id },
      include: {
        caso: {
          include: { unidade: true },
        },
        remetente: true,
      },
    });

    if (!assistencia || assistencia.destinatario_id !== userId) {
      return res.status(403).json({ error: "Solicitação não encontrada ou não autorizada." });
    }

    const novoStatus = aceito ? "aceito" : "recusado";

    // 1. Atualiza o status da solicitação
    await prisma.assistencia_casos.update({
      where: { id: assistencia_id },
      data: { status: novoStatus },
    });

    if (aceito) {
      // 2. Marca o caso como compartilhado
      await prisma.casos.update({
        where: { id: assistencia.caso_id },
        data: { compartilhado: true },
      });

      // 3. Log Detalhado (Quem, Para Quem, Unidade, Tipo)
      await registrarLog(userId, "assistencia_aceita", "casos", assistencia.caso_id, {
        remetente_nome: assistencia.remetente.nome,
        destinatario_nome: req.user.nome,
        unidade: assistencia.caso.unidade?.nome,
        tipo_acao: assistencia.caso.tipo_acao,
        mensagem: `Colaboração aceita: ${req.user.nome} agora ajuda no caso #${assistencia.caso_id} (${assistencia.caso.tipo_acao}) da unidade ${assistencia.caso.unidade?.nome}`,
      });
    }

    // 4. Notifica o remetente sobre a resposta
    await prisma.notificacoes.create({
      data: {
        usuario_id: assistencia.remetente_id,
        titulo: aceito ? "Colaboração Aceita" : "Colaboração Recusada",
        mensagem: `${req.user.nome} ${aceito ? "aceitou" : "recusou"} o pedido de ajuda no caso #${assistencia.caso_id}.`,
        tipo: "assistencia_resposta",
        referencia_id: assistencia_id,
      },
    });

    res.status(200).json({ status: novoStatus });
  } catch (error) {
    logger.error(`Erro ao responder assistência: ${error.message}`);
    res.status(500).json({ error: "Erro ao processar resposta." });
  }
};
