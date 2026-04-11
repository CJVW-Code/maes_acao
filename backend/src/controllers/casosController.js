import { supabase, isSupabaseConfigured } from "../config/supabase.js";
import { prisma } from "../config/prisma.js";
import path from "path";
import {
  generateCredentials,
  hashKeyWithSalt,
  verifyKey,
} from "../services/securityService.js";
import fs from "fs/promises";
import fsSync from "fs";
import { extractTextFromImage } from "../services/documentService.js";
import { visionOCR } from "../services/aiService.js";
import { registrarLog } from "../services/loggerService.js";

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
import { analyzeCase, generateDosFatos } from "../services/geminiService.js";
import { getVaraByTipoAcao } from "../config/varasMapping.js";
import logger from "../utils/logger.js";
import { Client } from "@upstash/qstash";

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

  if (partes) {
    enriched.nome_assistido = partes.nome_assistido;
    enriched.cpf_assistido = partes.cpf_assistido;
    enriched.telefone_assistido = partes.telefone_assistido;
    enriched.email_assistido = partes.email_assistido;
    enriched.endereco_assistido = partes.endereco_assistido;
    enriched.assistido_data_nascimento = partes.data_nascimento_assistido;
    enriched.assistido_rg_numero = partes.rg_assistido;
    enriched.assistido_rg_orgao = partes.emissor_rg_assistido;
    enriched.assistido_nacionalidade = partes.nacionalidade;
    enriched.assistido_estado_civil = partes.estado_civil;
    enriched.assistido_ocupacao = partes.profissao;

    // Mapeamento para tags oficiais do dicionarioTags.js
    enriched.REPRESENTANTE_NOME = partes.nome_assistido;
    enriched.nome_representante = partes.nome_assistido; // Alias compatibilidade
    enriched.representante_cpf = partes.cpf_assistido;
    enriched.nome_mae_representante = partes.nome_mae_representante;
    enriched.nome_pai_representante = partes.nome_pai_representante;

    enriched.nome_requerido = partes.nome_requerido;
    enriched.cpf_requerido = partes.cpf_requerido;
    enriched.endereco_requerido = partes.endereco_requerido;
  }

  if (ia) {
    const extras = safeJsonParse(ia.dados_extraidos, {});
    enriched.relato_texto = ia.relato_texto;
    enriched.dos_fatos_gerado = ia.dos_fatos_gerado;
    enriched.resumo_ia = ia.resumo_ia || extras.resumo_ia || null;
    enriched.url_peticao = ia.url_peticao;
    enriched.url_documento_gerado = ia.url_peticao;
    enriched.peticao_inicial_rascunho = ia.peticao_inicial_rascunho || extras.peticao_inicial_rascunho || null;
    enriched.peticao_completa_texto = ia.peticao_completa_texto;
    enriched.url_peticao_penhora = ia.url_peticao_penhora || extras.url_peticao_penhora || null;
    enriched.url_peticao_prisao = ia.url_peticao_prisao || extras.url_peticao_prisao || null;
    enriched.url_termo_declaracao = ia.url_termo_declaracao || extras.url_termo_declaracao || null;

    // Alias para attachSignedUrls
    enriched.casos_ia = ia;
    enriched.ia = ia;
    // [FIX] O dados_formulario agora abraça o próprio payload JSONB extraído com integridade
    enriched.dados_formulario = extras;
  } else {
    enriched.dados_formulario = {};
  }

  if (partes) {
    // ... campos já mapeados acima ...
    // Alias para consultas Supabase style
    enriched.casos_partes = [partes];
    enriched.partes = partes;
  }

  if (juridico) {
    enriched.numero_processo_originario = juridico.numero_processo_titulo;
    enriched.percentual_salario_minimo = juridico.percentual_salario;
    enriched.dia_pagamento_fixado = juridico.vencimento_dia;
    enriched.juridico = juridico;
  }

  // Populate urls_documentos for attachSignedUrls
  if (caso.documentos && Array.isArray(caso.documentos)) {
    enriched.urls_documentos = caso.documentos.map((doc) => doc.storage_path);
  } else if (!enriched.urls_documentos) {
    enriched.urls_documentos = [];
  }

  return enriched;
};

// Tempo de expiração (em segundos) para URLs assinadas do Supabase
const signedExpires = Number.parseInt(
  process.env.SIGNED_URL_EXPIRES || "3600",
  10,
);

const storageBuckets = {
  documentos: process.env.SUPABASE_DOCUMENTOS_BUCKET || "documentos",
  peticoes: process.env.SUPABASE_PETICOES_BUCKET || "peticoes",
  audios: process.env.SUPABASE_AUDIOS_BUCKET || "audios",
};

const salarioMinimoAtual = Number.parseFloat(
  process.env.SALARIO_MINIMO_ATUAL || "1621",
);

// --- VALIDAÇÃO DE CPF ---
const validarCPF = (cpf) => {
  if (!cpf) return false;
  const strCPF = String(cpf).replace(/[^\d]/g, "");
  if (strCPF.length !== 11) return false;
  if (/^(\d)\1+$/.test(strCPF)) return false;
  let soma = 0,
    resto;
  for (let i = 1; i <= 9; i++)
    soma += parseInt(strCPF.substring(i - 1, i)) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(strCPF.substring(9, 10))) return false;
  soma = 0;
  for (let i = 1; i <= 10; i++)
    soma += parseInt(strCPF.substring(i - 1, i)) * (12 - i);
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
  const parsedString = hasComma
    ? normalized.replace(/\./g, "").replace(",", ".")
    : normalized;
  const result = Number(parsedString);
  return Number.isNaN(result) ? 0 : result;
};

const calcularValorCausa = (valorMensal) => {
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
        index === 0
          ? ""
          : ` ${ehSingular ? qualificador.singular : qualificador.plural}`;
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
  if (
    !salarioMinimoAtual ||
    Number.isNaN(valorNumerico) ||
    valorNumerico <= 0
  ) {
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
        logger.warn(
          `[Storage] Arquivo ausente (Link órfão no Banco): ${objectPath}`,
        );
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
  const ia = Array.isArray(caso.casos_ia)
    ? caso.casos_ia[0]
    : caso.casos_ia || caso.ia;
  const iaPenhoraUrl =
    caso.url_peticao_penhora || ia?.url_peticao_penhora || null;
  const iaPrisaoUrl = caso.url_peticao_prisao || ia?.url_peticao_prisao || null;

  const [docGerado, audio, peticao, termoDeclaracao, docPenhora, docPrisao] =
    await Promise.all([
      buildSignedUrl(storageBuckets.peticoes, caso.url_documento_gerado),
      buildSignedUrl(storageBuckets.audios, caso.url_audio),
      buildSignedUrl(storageBuckets.peticoes, caso.url_peticao),
      buildSignedUrl(storageBuckets.peticoes, caso.url_termo_declaracao),
      buildSignedUrl(storageBuckets.peticoes, iaPenhoraUrl),
      buildSignedUrl(storageBuckets.peticoes, iaPrisaoUrl),
    ]);
  enriched.url_documento_gerado = docGerado;
  enriched.url_audio = audio;
  enriched.url_peticao = peticao;
  enriched.url_termo_declaracao = termoDeclaracao;
  if (docPenhora) enriched.url_peticao_penhora = docPenhora;
  if (docPrisao) enriched.url_peticao_prisao = docPrisao;
  if (Array.isArray(caso.urls_documentos) && caso.urls_documentos.length) {
    const signedDocs = await Promise.all(
      caso.urls_documentos.map((value) =>
        buildSignedUrl(storageBuckets.documentos, value),
      ),
    );
    enriched.urls_documentos = signedDocs.filter(Boolean);
  } else {
    enriched.urls_documentos = [];
  }
  return enriched;
};

const ensureText = (val, fallback = "") => {
  if (
    val === undefined ||
    val === null ||
    String(val).toLowerCase() === "undefined"
  )
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

const ensureInlineValue = (value) => {
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
  const safe = (value) =>
    typeof value === "string" ? value.trim() : (value ?? "");
  const paragraphs = [];

  // --- LÓGICA MULTI-FILHOS ---
  const outrosFilhos = safeJsonParse(caseData.outros_filhos_detalhes, []);

  const assistidoPrincipal =
    safe(caseData.nome_assistido) ||
    safe(caseData.requerente_nome) ||
    safe(caseData.nome) ||
    "";
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
    safe(caseData.valor_pensao) ||
    safe(formatCurrencyBr(caseData.valor_mensal_pensao));
  const diaPagamento =
    safe(caseData.dia_pagamento_requerido) ||
    safe(caseData.dia_pagamento_fixado);
  if (valorPretendido || diaPagamento) {
    paragraphs.push(
      `Diante desse contexto, requer-se a fixação de alimentos no valor de ${
        valorPretendido || "[valor a ser definido]"
      }` +
        (diaPagamento
          ? `, com vencimento no dia ${diaPagamento} de cada mês.`
          : "."),
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

const processarDadosFilhosParaPeticao = (
  baseData = {},
  normalizedData = {},
) => {
  const outrosFilhosRaw = safeJsonParse(baseData.outros_filhos_detalhes, []);
  const outrosFilhosSafe = Array.isArray(outrosFilhosRaw)
    ? outrosFilhosRaw
    : outrosFilhosRaw
      ? [outrosFilhosRaw]
      : [];

  const filhoPrincipal = {
    nome: ensureText(
      baseData.nome ||
        baseData.nome_assistido ||
        normalizedData.requerente_nome,
    ),
    cpf: ensureText(
      baseData.cpf || baseData.cpf_assistido || normalizedData.requerente_cpf,
    ),
    nascimento: ensureText(
      baseData.assistido_data_nascimento ||
        formatDateBr(baseData.data_nascimento_assistido) ||
        formatDateBr(baseData.dataNascimentoAssistido) ||
        formatDateBr(baseData.dados_formulario?.assistido_data_nascimento) ||
        formatDateBr(baseData.dados_formulario?.data_nascimento_assistido),
    ),
    rg: ensureText(
      baseData.assistido_rg_numero
        ? `${baseData.assistido_rg_numero} ${baseData.assistido_rg_orgao}`
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
  if (baseData.assistido_eh_incapaz === "sim") {
    if (isPlural) {
      if (temMenorDe16 && temEntre16e18)
        termo_representacao = "neste ato representados e assistidos";
      else if (temEntre16e18) termo_representacao = "neste ato assistidos";
      else termo_representacao = "neste ato representados";
    } else if (idades.length === 1) {
      termo_representacao =
        idades[0] < 16 ? "neste ato representado(a)" : "neste ato assistido(a)";
    }
  }

  const assistidoNome =
    lista_filhos.length > 0
      ? lista_filhos.map((f) => f.nome).join(", ")
      : baseData.nome_assistido || normalizedData.requerente_nome;
  const assistidoCpf =
    lista_filhos.length > 0
      ? lista_filhos[0].cpf
      : baseData.cpf_assistido || normalizedData.requerente_cpf;
  const dataNascimentoAssistidoBr =
    lista_filhos.length > 0
      ? lista_filhos[0].nascimento
      : formatDateBr(
          baseData.assistido_data_nascimento ||
            normalizedData.requerente?.dataNascimento,
        );

  return {
    lista_filhos,
    rotulo_qualificacao,
    termo_representacao,
    assistidoNome,
    assistidoCpf,
    dataNascimentoAssistidoBr,
  };
};

const buildDocxTemplatePayload = (
  normalizedData, // No longer using mapping, but keep parameter for backwards compatibility
  dosFatosTexto,
  baseData = {},
  acaoKey = "",
) => {
  // A lógica do '#lista_filhos' ainda precisa processar idades e formatação de datas
  const { lista_filhos, rotulo_qualificacao, termo_representacao } =
    processarDadosFilhosParaPeticao(baseData, normalizedData);

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

  const debitoCalculado = parseCurrencyToNumber(
    baseData.valor_debito || baseData.valor_total_debito_execucao || "0",
  );
  const debitoCalculadoExtenso =
    debitoCalculado > 0 ? numeroParaExtenso(debitoCalculado) : "";

  const payload = {
    ...baseData, // 1:1 Injeção Direta
    lista_filhos,
    rotulo_qualificacao,
    termo_representacao,

    // --- TAGS GERAIS E EXECUÇÃO (CAIXA ALTA OBRIGATÓRIA) ---
    VARA: String(baseData.VARA || baseData.vara || baseData.numero_vara || normalizedData.numero_vara || "______").toUpperCase(),
    CIDADEASSINATURA: String(baseData.CIDADEASSINATURA || baseData.cidade_assinatura || normalizedData.comarca || "______").toUpperCase(),
    REPRESENTANTE_NOME: String(baseData.REPRESENTANTE_NOME || baseData.representante_nome || baseData.nome_assistido || "______").toUpperCase(),
    REQUERIDO_NOME: String(baseData.REQUERIDO_NOME || baseData.nome_requerido || "______").toUpperCase(),

    // RECUPERAÇÃO DE CONTATOS E ENDEREÇOS (Evita sumiços nas minutas)
    requerente_endereco_residencial: baseData.requerente_endereco_residencial || baseData.endereco_assistido || baseData.representante_endereco_residencial || "não informado",
    requerente_telefone: baseData.requerente_telefone || baseData.telefone_assistido || baseData.representante_telefone || "não informado",
    requerente_email: baseData.requerente_email || baseData.email_assistido || baseData.representante_email || "não informado",

    executado_endereco_residencial: baseData.executado_endereco_residencial || baseData.endereco_requerido || "não informado",
    executado_telefone: baseData.executado_telefone || baseData.telefone_requerido || "não informado",
    executado_email: baseData.executado_email || baseData.email_requerido || "não informado",

    representante_rg: baseData.representante_rg || baseData.assistido_rg_numero || baseData.representante_rg_numero || "não informado",
    emissor_rg_exequente: baseData.emissor_rg_exequente || baseData.assistido_rg_orgao || baseData.representante_rg_orgao || "não informado",
    nome_mae_representante: baseData.nome_mae_representante || baseData.representante_nome_mae || "não informado",
    nome_pai_representante: baseData.nome_pai_representante || baseData.representante_nome_pai || "não informado",

    rg_executado: baseData.rg_executado || baseData.requerido_rg_numero || "não informado",
    emissor_rg_executado: baseData.emissor_rg_executado || baseData.requerido_rg_orgao || "não informado",
    nome_mae_executado: baseData.nome_mae_executado || baseData.requerido_nome_mae || "não informado",
    nome_pai_executado: baseData.nome_pai_executado || baseData.requerido_nome_pai || "não informado",

    cidadeOriginaria: baseData.cidadeOriginaria || baseData.cidade_originaria || "______",
    varaOriginaria: baseData.varaOriginaria || baseData.vara_originaria || "______",
    processoOrigemNumero: baseData.processoOrigemNumero || baseData.numero_processo_originario || "______",
    tipo_decisao: baseData.tipo_decisao || "Sentença/Acordo",
    periodo_meses_ano: baseData.periodo_meses_ano || baseData.periodo_debito_execucao || baseData.periodo_debito || "______",
    valor_debito: baseData.valor_debito || baseData.valor_total_debito_execucao || (debitoCalculado > 0 ? formatCurrencyBr(debitoCalculado) : "______"),
    valor_debito_extenso: baseData.valor_debito_extenso || debitoCalculadoExtenso || "______",
    data_atual: baseData.data_atual || dataAtualTexto,
    defensoraNome: baseData.defensoraNome || normalizedData.defensoraNome || "DEFENSOR(A) PÚBLICO(A)",
    dos_fatos: ensureText(dosFatosTexto, "[DESCREVER OS FATOS]") || "[DESCREVER OS FATOS]",

    // --- ALIASES EXATOS PARA O TEMPLATE XML (Fixação, Divórcio, etc) ---
    vara: String(baseData.VARA || baseData.vara || baseData.numero_vara || "______").toUpperCase(),
    comarca: String(baseData.CIDADEASSINATURA || baseData.cidade_assinatura || normalizedData.comarca || "______").toUpperCase(),
    triagemNumero: baseData.protocolo || normalizedData.triagemNumero || "______",

    // REQUERENTE = Criança (Titular do direito)
    requerente_nome: String(lista_filhos[0]?.nome || baseData.NOME || baseData.nome_assistido || "______").toUpperCase(),
    requerente_data_nascimento: lista_filhos[0]?.nascimento || baseData.nascimento || baseData.assistido_data_nascimento || "______",
    requerente_cpf: lista_filhos[0]?.cpf || baseData.cpf_assistido || "______",
    dados_adicionais_requerente: baseData.dados_adicionais_requerente || "______",

    // REPRESENTANTE = Mãe (Assina pelo incapaz)
    representante_nome: String(baseData.REPRESENTANTE_NOME || baseData.representante_nome || "______").toUpperCase(),
    representante_nacionalidade: baseData.representante_nacionalidade || "brasileira",
    representante_estado_civil: baseData.representante_estado_civil || "solteira",
    representante_ocupacao: baseData.representante_ocupacao || baseData.assistido_ocupacao || "______",
    representante_cpf: baseData.representante_cpf || "______",
    representante_endereco_residencial: baseData.requerente_endereco_residencial || baseData.representante_endereco_residencial || baseData.endereco_assistido || "não informado",
    representante_endereco_profissional: baseData.representante_endereco_profissional || "não informado",
    representante_email: baseData.requerente_email || baseData.representante_email || baseData.email_assistido || "não informado",
    representante_telefone: baseData.requerente_telefone || baseData.representante_telefone || baseData.telefone_assistido || "não informado",

    // REQUERIDO / EXECUTADO = Pai
    requerido_nome: String(baseData.REQUERIDO_NOME || baseData.nome_requerido || "______").toUpperCase(),
    executado_nacionalidade: baseData.requerido_nacionalidade || "brasileiro(a)",
    executado_estado_civil: baseData.requerido_estado_civil || "solteiro(a)",
    executado_ocupacao: baseData.executado_ocupacao || baseData.requerido_ocupacao || "______",
    requerido_cpf: baseData.executado_cpf || baseData.cpf_requerido || "______",
    requerido_endereco_residencial: baseData.executado_endereco_residencial || baseData.endereco_requerido || "______",
    executado_endereco_profissional: baseData.requerido_endereco_profissional || "não informado",
    executado_email: baseData.executado_email || baseData.email_requerido || "não informado",
    executado_telefone: baseData.executado_telefone || baseData.telefone_requerido || "não informado",
    dados_adicionais_requerido: baseData.dados_adicionais_requerido || "______",

    // PEDIDOS E VALORES
    filhos_info: baseData.filhos_info || "______",
    percentual_provisorio_salario_min: baseData.percentual_salario_minimo || "______",
    valor_provisorio_referencia: baseData.valor_pensao || "______",
    percentual_despesas_extras: baseData.percentual_definitivo_extras || "50",
    dia_pagamento: baseData.dia_pagamento || baseData.dia_pagamento_fixado || baseData.dia_pagamento_requerido || "10",
    dados_bancarios_requerente: baseData.dados_bancarios_exequente || baseData.dados_bancarios_deposito || "______",
    
    empregador_nome: baseData.empregador_nome || baseData.empregador_requerido_nome || "______",
    empregador_endereco_profissional: baseData.empregador_requerido_endereco || "______",
    empregador_email: baseData.empregador_email || "não informado",

    percentual_definitivo_salario_min: baseData.percentual_definitivo_salario_min || baseData.percentual_salario_minimo || "______",
    
    valor_causa: baseData.valor_debito || baseData.valor_total_debito_execucao || (debitoCalculado > 0 ? formatCurrencyBr(debitoCalculado) : "______"),
    valor_causa_extenso: baseData.valor_debito_extenso || debitoCalculadoExtenso || "______",
    cidade_data_assinatura: baseData.data_atual || dataAtualTexto,
  };

  // Limpa 'undefined' ou 'null' para garantir que não sujem o Docx final
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
export async function processarCasoEmBackground(
  protocolo,
  dados_formulario,
  urls_documentos,
  url_audio,
  url_peticao,
) {
  try {
    // Extrair a chave do dicionário enviada pelo frontend
    let acaoRaw =
      dados_formulario.acaoEspecifica ||
      (dados_formulario.tipoAcao || "").split(" - ")[1]?.trim() ||
      (dados_formulario.tipoAcao || "").trim() ||
      "";

    // Normalização básica: converte para snake_case se vier com espaços ou camelCase
    let acaoKey = acaoRaw
      .toLowerCase()
      .replace(/\s+/g, "_")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Mapeamento manual para casos comuns
    if (
      acaoKey.includes("execucao") &&
      (acaoKey.includes("penhora") || acaoKey.includes("prisao"))
    ) {
      acaoKey = "execucao_alimentos";
    }
    logger.info(
      `[Background] Processando protocolo=${protocolo} | acaoKey="${acaoKey}"`,
    );

    await prisma.casos.update({
      where: { protocolo },
      data: { status: "processando_ia", updated_at: new Date() },
    });

    const casoRaw = await prisma.casos.findUnique({
      where: { protocolo },
      include: { partes: true, ia: true },
    });
    const caso = mapCasoRelations(casoRaw);
    if (!caso) throw new Error("Caso não encontrado no Prisma");

    // Obter configuração da ação
    const { getConfigAcaoBackend } =
      await import("../config/dicionarioAcoes.js");
    const configAcao = getConfigAcaoBackend(acaoKey);

    // OCR / Leitura de Documentos
    let textoCompleto = caso.relato_texto || "";
    let resumo_ia = null;
    let dosFatosTexto = "";

    // Verificação se deve ignorar leitura de documentos (OCR)
    const deveIgnorarIA =
      configAcao.ignorarDosFatos === true && configAcao.promptIA === null;
    const deveIgnorarOCR = configAcao.ignorarOCR === true;

    if (!deveIgnorarIA && !deveIgnorarOCR) {
      for (const docPath of urls_documentos) {
        // Processa imagens e PDFs
        if (docPath.match(/\.(jpg|jpeg|png|pdf)$/i)) {
          logger.info(`[OCR] Processando arquivo: ${docPath}`);
          try {
            // 1. Baixar o arquivo do Supabase Storage
            if (!isSupabaseConfigured)
              throw new Error("Supabase inativo. Impossível baixar arquivo.");

            const { data: blob, error: downloadError } = await supabase.storage
              .from(storageBuckets.documentos)
              .download(docPath);

            if (downloadError) {
              throw new Error(
                `Erro no download do arquivo ${docPath}: ${downloadError.message}`,
              );
            }

            // 2. Converter o Blob para Buffer
            const buffer = Buffer.from(await blob.arrayBuffer());

            // 3. Extrair texto (IA com Fallback para Tesseract em imagens)
            let textoExtraido = "";
            const lowerPath = docPath.toLowerCase();
            // Define o tipo correto para a IA (PDF ou Imagem)
            let mimeType = lowerPath.endsWith(".pdf")
              ? "application/pdf"
              : lowerPath.endsWith(".png")
                ? "image/png"
                : "image/jpeg";

            try {
              textoExtraido = await visionOCR(
                buffer,
                mimeType,
                "Transcreva todo o texto deste documento fielmente.",
              );
            } catch (aiError) {
              logger.warn(
                `[OCR IA] Falha ao processar ${docPath}: ${aiError.message}`,
              );
              // Fallback: Tesseract (Apenas para imagens, pois Tesseract puro não lê PDF binário)
              if (mimeType !== "application/pdf") {
                textoExtraido = await extractTextFromImage(buffer);
                logger.info(`[OCR Fallback] Sucesso com Tesseract.`);
              } else {
                throw aiError; // Se for PDF e a IA falhar, repassa o erro
              }
            }

            if (textoExtraido) {
              textoCompleto += `\n\n--- TEXTO EXTRAÍDO (${docPath}) ---\n${textoExtraido}`;
            }

            // Delay entre documentos para evitar rate limit (429) do Gemini
            if (urls_documentos.indexOf(docPath) < urls_documentos.length - 1) {
              logger.info(`[OCR] Aguardando 6s antes do próximo documento...`);
              await new Promise((r) => setTimeout(r, 6000));
            }
          } catch (ocrError) {
            logger.warn(`Falha no OCR para ${docPath}: ${ocrError.message}`);
          }
        } else {
          logger.info(
            `[OCR] Pulando arquivo (formato não suportado): ${docPath}`,
          );
        }
      }

      // IA: Resumo e Dos Fatos
      try {
        resumo_ia = await analyzeCase(textoCompleto);
      } catch (analyzeError) {
        logger.warn(`Falha ao gerar resumo IA: ${analyzeError.message}`);
      }
    } else {
      logger.info(
        `[Background] IA ignorada pela configuração da ação ${acaoKey}.`,
      );
    }

    // Formatação de Dados
    // Garante que a data de nascimento não seja formatada se estiver vazia ou inválida
    const rawAssistidoNascimento =
      dados_formulario.assistido_data_nascimento ||
      dados_formulario.data_nascimento_assistido;
    const formattedAssistidoNascimento = rawAssistidoNascimento
      ? formatDateBr(rawAssistidoNascimento)
      : "";

    const formattedDataInicioRelacao = formatDateBr(
      dados_formulario.data_inicio_relacao,
    );
    const formattedDataSeparacao = formatDateBr(
      dados_formulario.data_separacao,
    );
    const formattedDiaPagamentoRequerido = formatDateBr(
      dados_formulario.dia_pagamento_requerido,
    );
    const formattedDiaPagamentoFixado = formatDateBr(
      dados_formulario.dia_pagamento_fixado,
    );
    const formattedValorPensao = formatCurrencyBr(
      dados_formulario.valor_mensal_pensao,
    );
    // [CORREÇÃO] Calculando o valor formatado que faltava
    const formattedValorTotalDebitoExecucao = formatCurrencyBr(
      dados_formulario.valor_total_debito_execucao,
    );
    const percentualSalarioMinimoCalculado = calcularPercentualSalarioMinimo(
      dados_formulario.valor_mensal_pensao,
    );

    const documentosInformadosArray = safeJsonParse(
      dados_formulario.documentos_informados,
      [],
    );
    const varaMapeada = getVaraByTipoAcao(dados_formulario.tipoAcao);
    const varaAutomatica =
      varaMapeada && !varaMapeada.includes("NÃO ESPECIFICADA")
        ? varaMapeada
        : null;

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
        dados_formulario.data_nascimento_assistido ||
        dados_formulario.assistido_data_nascimento,
      representante_nome: dados_formulario.representante_nome,
      representante_nacionalidade: dados_formulario.representante_nacionalidade,
      representante_estado_civil: dados_formulario.representante_estado_civil,
      representante_ocupacao: dados_formulario.representante_ocupacao,
      representante_cpf: dados_formulario.representante_cpf,
      representante_endereco_residencial:
        dados_formulario.representante_endereco_residencial,
      representante_endereco_profissional:
        dados_formulario.representante_endereco_profissional,
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
      requerido_endereco_profissional:
        dados_formulario.requerido_endereco_profissional,
      requerido_email:
        dados_formulario.email_requerido || dados_formulario.requerido_email,
      requerido_telefone:
        dados_formulario.telefone_requerido ||
        dados_formulario.requerido_telefone,
      telefone_requerido:
        dados_formulario.telefone_requerido ||
        dados_formulario.requerido_telefone,
      email_requerido:
        dados_formulario.email_requerido || dados_formulario.requerido_email,
      filhos_info: dados_formulario.filhos_info,
      data_inicio_relacao: formattedDataInicioRelacao,
      data_separacao: formattedDataSeparacao,
      bens_partilha: dados_formulario.bens_partilha,
      descricao_guarda: dados_formulario.descricao_guarda,
      situacao_financeira_genitora:
        dados_formulario.situacao_financeira_genitora,
      processo_titulo_numero: dados_formulario.processo_titulo_numero,
      cidade_assinatura: dados_formulario.cidade_assinatura,
      cidadeDataAssinatura: dados_formulario.cidade_assinatura,
      valor_total_extenso: dados_formulario.valor_total_extenso,
      valor_debito_extenso: dados_formulario.valor_debito_extenso,
      percentual_definitivo_salario_min:
        dados_formulario.percentual_definitivo_salario_min,
      percentual_definitivo_extras:
        dados_formulario.percentual_definitivo_extras,
      valor_pensao: formattedValorPensao,
      valor_pensao_solicitado: formattedValorPensao,
      valor_mensal_pensao: dados_formulario.valor_mensal_pensao,
      percentual_salario_minimo:
        dados_formulario.percentual_salario_minimo ||
        percentualSalarioMinimoCalculado,
      salario_minimo_atual: salarioMinimoAtual,
      salario_minimo_formatado: formatCurrencyBr(salarioMinimoAtual),
      valor_salario_minimo: formatCurrencyBr(salarioMinimoAtual),
      dia_pagamento_requerido: formattedDiaPagamentoRequerido,
      dados_bancarios_deposito: dados_formulario.dados_bancarios_deposito,
      requerido_tem_emprego_formal:
        dados_formulario.requerido_tem_emprego_formal,
      empregador_requerido_nome: dados_formulario.empregador_requerido_nome,
      empregador_requerido_endereco:
        dados_formulario.empregador_requerido_endereco,
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
        dados_formulario.periodo_debito_execucao ||
        dados_formulario.periodo_debito,
      periodo_debito:
        dados_formulario.periodo_debito ||
        dados_formulario.periodo_debito_execucao,
      valor_total_debito_execucao: formattedValorTotalDebitoExecucao,
      regime_bens: dados_formulario.regime_bens,
      retorno_nome_solteira: dados_formulario.retorno_nome_solteira,
      alimentos_para_ex_conjuge: dados_formulario.alimentos_para_ex_conjuge,
      outros_filhos_detalhes: dados_formulario.outros_filhos_detalhes, // Adicionando o campo que faltava
    };

    const caseDataForPetition = sanitizeCaseDataInlineFields(
      caseDataForPetitionRaw,
    );

    // Usa a configAcao já carregada no topo

    try {
      if (configAcao.ignorarDosFatos) {
        dosFatosTexto = "";
      } else {
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

    const normalizedData = {
      comarca:
        process.env.DEFENSORIA_DEFAULT_COMARCA || "Teixeira de Freitas/BA",
      defensoraNome:
        process.env.DEFENSORIA_DEFAULT_DEFENSORA ||
        "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA",
      triagemNumero: protocolo,
    };

    try {
      const docxData = buildDocxTemplatePayload(
        normalizedData,
        dosFatosTexto,
        caseDataForPetition,
        acaoKey,
      );

      const { getConfigAcaoBackend } =
        await import("../config/dicionarioAcoes.js");
      const configAcao = getConfigAcaoBackend(acaoKey);

      if (configAcao.gerarMultiplos) {
        const periodoParaCalculo =
          caseDataForPetition.periodo_debito_execucao ||
          caseDataForPetition.periodo_debito ||
          "";
        logger.info(
          `[DOCX Multi] Período para cálculo: "${periodoParaCalculo}"`,
        );
        const docs = await generateMultiplosDocx(
          docxData,
          acaoKey,
          periodoParaCalculo,
        );
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
              if (doc.tipo === "penhora") url_peticao_penhora = docxPath;
              if (doc.tipo === "prisao") url_peticao_prisao = docxPath;
            } else {
              logger.error(
                `[Supabase] Erro ao fazer upload da minuta ${doc.tipo}: ${uploadDocxErr.message}`,
              );
              const localDir = path.resolve("uploads", "peticoes", protocolo);
              await fs.mkdir(localDir, { recursive: true });
              await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
              if (doc.tipo === "penhora") url_peticao_penhora = docxPath;
              if (doc.tipo === "prisao") url_peticao_prisao = docxPath;
              logger.info(
                `[Local Fallback] DOCX ${doc.tipo} salvo em ${localDir}/${doc.filename}`,
              );
            }
          } else {
            // Fallback: salva localmente
            const localDir = path.resolve("uploads", "peticoes", protocolo);
            await fs.mkdir(localDir, { recursive: true });
            await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
            if (doc.tipo === "penhora") url_peticao_penhora = docxPath;
            if (doc.tipo === "prisao") url_peticao_prisao = docxPath;
            logger.info(
              `[Local] DOCX ${doc.tipo} salvo em ${localDir}/${doc.filename}`,
            );
          }
        }
        // The main url gets the penhora as fallback
        url_documento_gerado = url_peticao_penhora;
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
            logger.info(
              `[Local Fallback] DOCX salvo em ${localDir}/${localFilename}`,
            );
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
      buildDocxTemplatePayload(
        normalizedData,
        dosFatosTexto,
        caseDataForPetition,
        acaoKey,
      ),
    );

    // Agrupa dados virtuais (links multi-rito, rascunhos, resumos) que NÃO constam
    // na tipagem bruta do DB dentro do JSONB flexível para respeitar o Schema 1.0
    const iaDadosExtraidos = {
      ...caseDataForPetition,
      resumo_ia,
      peticao_inicial_rascunho: `DOS FATOS\n\n${dosFatosTexto || ""}`,
      url_peticao_penhora,
      url_peticao_prisao,
    };

    // Finalizar processamento - Atualiza Status no Caso e Dados na IA
    await prisma.casos.update({
      where: { protocolo },
      data: {
        status: "pronto_para_analise",
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
      .catch((e) =>
        logger.error("Falha ao salvar erro no BD do caso: " + e.message),
      );
  }
}

// --- CONTROLLER PRINCIPAL ---
export const criarNovoCaso = async (req, res) => {
  try {
    // O bloco finally cuidará da limpeza de arquivos
    const dados_formulario = req.body;
    const avisos = [];
    // Desestruturação segura (mantida do seu código)
    const { tipoAcao, relato, documentos_informados, documentos_nomes } =
      dados_formulario;

    // Extração mapeada forçadamente para o dicionário padrão (Sem Aliases)
    const nome =
      dados_formulario.REPRESENTANTE_NOME || dados_formulario.nome || "";
    let cpf = dados_formulario.representante_cpf || dados_formulario.cpf || "";
    cpf = cpf.replace(/\D/g, ""); // Remove pontuações para não bugar a busca depois
    const cpf_requerido_limpo = (
      dados_formulario.executado_cpf || dados_formulario.cpf_requerido || ""
    ).replace(/\D/g, "");
    const telefone = dados_formulario.requerente_telefone || "";
    const cpf_requerido = dados_formulario.executado_cpf || "";
    const detalhes_filhos = dados_formulario.lista_filhos || "";

    const documentosInformadosArray = safeJsonParse(documentos_informados, []);

    // --- VALIDAÇÃO DE CPFs (CRÍTICO) ---
    if (!validarCPF(cpf)) {
      return res.status(400).json({ error: "CPF do assistido inválido." });
    }

    if (cpf_requerido && !validarCPF(cpf_requerido)) {
      avisos.push(
        "Alerta: O CPF informado para a parte contrária (Requerido) parece inválido.",
      );
    }
    // Validação de filhos (lista_filhos)
    if (detalhes_filhos) {
      const filhos = safeJsonParse(detalhes_filhos, []);
      if (Array.isArray(filhos)) {
        filhos.forEach((f, i) => {
          if (f.cpf && !validarCPF(f.cpf))
            avisos.push(
              `Alerta: O CPF do filho(a) ${f.NOME || i + 1} parece inválido.`,
            );
        });
      }
    }

    const { protocolo } = generateCredentials(tipoAcao);

    logger.info(
      `Iniciando criação de caso. Protocolo: ${protocolo}, Tipo: ${tipoAcao}`,
    );

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
          await fs.copyFile(
            audioFile.path,
            path.join(localDir, audioFile.filename),
          );
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
            const bucket = docFile.originalname
              .toLowerCase()
              .includes("peticao")
              ? "peticoes"
              : "documentos";
            const localDir = path.resolve("uploads", bucket, protocolo);
            await fs.mkdir(localDir, { recursive: true });
            await fs.copyFile(
              docFile.path,
              path.join(localDir, docFile.filename),
            );

            if (bucket === "peticoes") {
              url_peticao = filePath;
            } else {
              urls_documentos.push(filePath);
            }
          }
          logger.info(
            `[Local] ${req.files.documentos.length} documento(s) salvos.`,
          );
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
                await fs.copyFile(
                  docFile.path,
                  path.join(localDir, docFile.filename),
                );
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
                logger.error(
                  `Erro upload documento (${docFile.originalname}):`,
                  {
                    error: docErr,
                  },
                );
                avisos.push(
                  `Erro ao salvar no Supabase, salvando local: ${docFile.originalname}`,
                );
                const localDir = path.resolve(
                  "uploads",
                  "documentos",
                  protocolo,
                );
                await fs.mkdir(localDir, { recursive: true });
                await fs.copyFile(
                  docFile.path,
                  path.join(localDir, docFile.filename),
                );
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
      dados_formulario.cidade_assinatura ||
      dados_formulario.cidadeAssinatura ||
      "";
    let unidadeDb = null;

    if (cidadeFormulario) {
      // Busca case-insensitive pela comarca
      const todasUnidades = await prisma.unidades.findMany({
        where: { ativo: true },
      });
      unidadeDb = todasUnidades.find(
        (u) =>
          u.comarca.toLowerCase().trim() ===
          cidadeFormulario.toLowerCase().trim(),
      );
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
      dados_formulario.enviar_documentos_depois === "true" ||
      dados_formulario.enviar_documentos_depois === true;
    const statusInicial = enviarDocDepois
      ? "aguardando_documentos"
      : "documentacao_completa";

    // Tenta salvar via Prisma de preferência (Normalizado v1.0)
    await prisma.casos.create({
      data: {
        protocolo,
        unidade_id: unidadeDb.id,
        tipo_acao: tipoAcaoPrisma,
        status: statusInicial,
        created_at: new Date(),
        partes: {
          create: {
            nome_assistido: nome,
            cpf_assistido: cpf,
            telefone_assistido: telefone,
            email_assistido:
              dados_formulario.requerente_email ||
              dados_formulario.email_assistido,
            endereco_assistido:
              dados_formulario.requerente_endereco_residencial ||
              dados_formulario.endereco_assistido,
            rg_assistido:
              dados_formulario.representante_rg ||
              dados_formulario.assistido_rg_numero,
            emissor_rg_assistido:
              dados_formulario.emissor_rg_exequente ||
              dados_formulario.assistido_rg_orgao,
            nacionalidade:
              dados_formulario.representante_nacionalidade ||
              dados_formulario.assistido_nacionalidade,
            estado_civil:
              dados_formulario.representante_estado_civil ||
              dados_formulario.assistido_estado_civil,
            profissao:
              dados_formulario.representante_ocupacao ||
              dados_formulario.assistido_ocupacao,
            nome_mae_representante: dados_formulario.nome_mae_representante,
            nome_pai_representante: dados_formulario.nome_pai_representante,
            nome_requerido:
              dados_formulario.REQUERIDO_NOME ||
              dados_formulario.nome_requerido,
            cpf_requerido: cpf_requerido_limpo,
            rg_requerido:
              dados_formulario.rg_executado ||
              dados_formulario.requerido_rg_numero,
            emissor_rg_requerido:
              dados_formulario.emissor_rg_executado ||
              dados_formulario.requerido_rg_orgao,
            profissao_requerido:
              dados_formulario.executado_profissao ||
              dados_formulario.requerido_ocupacao,
            nome_mae_requerido:
              dados_formulario.nome_mae_executado ||
              dados_formulario.requerido_nome_mae,
            nome_pai_requerido:
              dados_formulario.nome_pai_executado ||
              dados_formulario.requerido_nome_pai,
            endereco_requerido:
              dados_formulario.executado_endereco_residencial ||
              dados_formulario.endereco_requerido,
            telefone_requerido:
              dados_formulario.executado_telefone ||
              dados_formulario.telefone_requerido,
            email_requerido:
              dados_formulario.executado_email ||
              dados_formulario.email_requerido,
          },
        },
        juridico: {
          create: {
            numero_processo_titulo:
              dados_formulario.numero_processo_originario ||
              dados_formulario.processo_titulo_numero,
            percentual_salario: parseCurrencyToNumber(
              dados_formulario.percentual_salario_minimo,
            ),
            vencimento_dia:
              parseInt(
                dados_formulario.dia_pagamento_fixado ||
                  dados_formulario.dia_pagamento_requerido,
              ) || null,
            periodo_inadimplencia:
              dados_formulario.periodo_debito_execucao ||
              dados_formulario.periodo_debito,
            debito_valor:
              dados_formulario.valor_total_debito_execucao ||
              dados_formulario.valor_mensal_pensao,
            debito_penhora_valor: dados_formulario.debito_penhora_valor || null,
            debito_prisao_valor: dados_formulario.debito_prisao_valor || null,
            conta_banco: dados_formulario.banco_deposito,
            conta_agencia: dados_formulario.agencia_deposito,
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
        `📋 Caso ${protocolo} aguardando documentos. Processamento adiado.`,
      );
      res.status(201).json({
        ...responsePayload,
        message: "Caso registrado! Envie os documentos quando possível.",
        status: "aguardando_documentos",
      });
      return; // pula todo o pipeline de processamento
    }

    res.status(201).json({
      ...responsePayload,
      message: "Caso registrado! Processando...",
      status: "documentacao_completa",
    });

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
        logger.warn(
          "[QStash] QSTASH_TOKEN ausente; processamento local acionado.",
        );
      } else if (!apiBaseUrlValida) {
        logger.warn(
          "[QStash] API_BASE_URL invalida; processamento local acionado.",
        );
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
            logger.warn(
              `Falha ao limpar arquivo temporário: ${file.path}`,
              e.message,
            );
          }
        }
      }
    }
  }
};

export const listarCasos = async (req, res) => {
  try {
    const { cpf, arquivado, limite } = req.query;
    const statusFiltro = arquivado === "true";

    const where = { arquivado: statusFiltro };

    // Filtro por unidade: admin vê tudo, demais veem apenas sua unidade
    if (req.user && req.user.cargo !== "admin" && req.user.unidade_id) {
      where.unidade_id = req.user.unidade_id;
    }

    if (cpf) {
      const cpfLimpo = cpf.replace(/\D/g, "");
      where.OR = [
        { protocolo: cpf },
        { partes: { cpf_assistido: cpf } },
        { partes: { cpf_assistido: cpfLimpo } },
        {
          ia: {
            dados_extraidos: {
              path: ["representante_cpf"],
              equals: cpf,
            },
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
      ];
    }

    const queryOptions = {
      where,
      orderBy: { created_at: "desc" },
      include: {
        partes: true,
        ia: true,
        documentos: true,
        defensor: { select: { id: true, nome: true } },
        servidor: { select: { id: true, nome: true } },
      },
    };

    if (limite) {
      const n = parseInt(limite, 10);
      if (!isNaN(n) && n > 0) queryOptions.take = n;
    }

    const data = await prisma.casos.findMany(queryOptions);

    // Hidrata e garante compatibilidade com o frontend
    const normalizedData = data.map((casoRaw) => {
      const caso = mapCasoRelations(casoRaw);
      if (!caso.dados_formulario || typeof caso.dados_formulario !== "object") {
        caso.dados_formulario = {};
      }
      if (!caso.dados_formulario.document_names)
        caso.dados_formulario.document_names = {};
      if (!caso.dados_formulario.documentNames) {
        caso.dados_formulario.documentNames =
          caso.dados_formulario.document_names;
      }

      // Adiciona o nome do representante no topo para facilitar a listagem no front
      caso.nome_representante =
        caso.dados_formulario?.REPRESENTANTE_NOME ||
        caso.dados_formulario?.representante_nome ||
        caso.dados_formulario?.representanteNome ||
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

    // Filtro por unidade: admin vê tudo, demais veem apenas sua unidade
    if (req.user && req.user.cargo !== "admin" && req.user.unidade_id) {
      whereClause.unidade_id = req.user.unidade_id;
    }

    const data = await prisma.casos.findMany({
      where: whereClause,
      select: {
        status: true,
        tipo_acao: true,
        compartilhado: true,
      },
    });

    const contagens = {
      total: data.length,
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
    };

    const topTiposMap = {};
    let representacao = 0;
    let proprio = 0;

    for (const caso of data) {
      if (caso.compartilhado) contagens.colaboracao++;
      const s = (caso.status || "recebido").toLowerCase().trim();

      // Mapeamento de legado/variantes para o material estratégico (Enum Prisma)
      if (s === "aguardando_documentos" || s === "aguardando_docs") {
        contagens.aguardando_documentos++;
      } else if (
        s === "documentacao_completa" ||
        s === "documentos_entregues"
      ) {
        contagens.documentacao_completa++;
      } else if (s === "processando_ia" || s === "processando") {
        contagens.processando_ia++;
      } else if (s === "pronto_para_analise" || s === "processado") {
        contagens.pronto_para_analise++;
      } else if (s === "em_atendimento" || s === "em_analise") {
        contagens.em_atendimento++;
      } else if (s === "liberado_para_protocolo") {
        contagens.liberado_para_protocolo++;
      } else if (s === "em_protocolo") {
        contagens.em_protocolo++;
      } else if (s === "protocolado" || s === "encaminhado_solar") {
        contagens.protocolado++;
      } else if (s === "erro_processamento" || s === "erro") {
        contagens.erro_processamento++;
      }

      // Estatísticas sem PII
      const tipo = caso.tipo_acao || "Outros";
      topTiposMap[tipo] = (topTiposMap[tipo] || 0) + 1;
    }

    contagens.ativos = contagens.total - contagens.protocolado;

    const topTipos = Object.entries(topTiposMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([tipo, qtd]) => ({ tipo, qtd }));

    res.status(200).json(stringifyBigInts({
      contagens,
      topTipos,
      representacao: { representacao, proprio },
    }));
  } catch (error) {
    logger.error(`Erro ao gerar resumo de casos local: ${error.message}`);
    res.status(500).json({ error: "Erro ao gerar resumo." });
  }
};

export const obterDetalhesCaso = async (req, res) => {
  const { id } = req.params;

  // Validação: Se o ID não for número nem UUID (ex: "arquivados"), retorna 400 e evita erro 500 no banco
  const isValidId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) || /^\d+$/.test(id);
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
          return res.status(404).json({ error: "Caso não encontrado." });
        }
        throw result.error;
      }
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
          unidade: { select: { sistema: true } },
          assistencia_casos: {
            where: {
              OR: [
                { destinatario_id: req.user.id },
                { remetente_id: req.user.id }
              ],
              status: "aceito",
            },
            include: {
              destinatario: { select: { nome: true } },
              remetente: { select: { nome: true } }
            }
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
    const isAdmin = req.user.cargo.toLowerCase() === "admin";
    const isOwner =
      data.defensor_id === req.user.id || data.servidor_id === req.user.id;
    const isShared = (data.assistencia_casos || []).length > 0;

    if (
      !isAdmin &&
      !isOwner &&
      !isShared &&
      (data.defensor_id || data.servidor_id)
    ) {
      const holderName =
        data.defensor?.nome || data.servidor?.nome || "outro usuário";
      return res.status(423).json({
        error: "Caso bloqueado",
        message: `Este caso já está vinculado ao defensor(a) ${holderName}.`,
        holder: holderName,
      });
    }

    // Vínculo Automático
    if (!isAdmin && !data.defensor_id && !data.servidor_id && !isShared) {
      const updateData = {};
      if (req.user.cargo.toLowerCase().includes("defensor")) {
        updateData.defensor_id = req.user.id;
        updateData.defensor_at = new Date();
        data.defensor_id = req.user.id;
      } else {
        updateData.servidor_id = req.user.id;
        updateData.servidor_at = new Date();
        data.servidor_id = req.user.id;
      }

      await prisma.casos.update({
        where: { id: BigInt(id) },
        data: updateData,
      });
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
      data.dados_formulario.documentNames =
        data.dados_formulario.document_names;
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

export const atualizarStatusCaso = async (req, res) => {
  const { id } = req.params;
  let { status, descricao_pendencia, numero_solar } = req.body;
  try {
    // Normalização de status para evitar erros de Enum no Prisma
    if (status === "aguardando_docs") status = "aguardando_documentos";

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (descricao_pendencia !== undefined)
      updateData.descricao_pendencia = descricao_pendencia;
    if (numero_solar !== undefined) updateData.numero_solar = numero_solar;

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ error: "Nenhum dado enviado para atualização." });
    }

    let data;
    if (isSupabaseConfigured) {
      const result = await supabase
        .from("casos")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      // Fallback Prisma
      data = await prisma.casos.update({
        where: { id: BigInt(id) },
        data: updateData,
      });
    }

    const casoAtualizadoComUrls = await attachSignedUrls(data);
    res.status(200).json(stringifyBigInts(casoAtualizadoComUrls));
  } catch (error) {
    logger.error(`Erro ao atualizar caso ${id}: ${error.message}`);

    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Este número Solar já está vinculado a outro caso." });
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
  const { memoria_calculo, debito_valor, percentual_salario } = req.body;

  try {
    const updateData = {};
    if (memoria_calculo !== undefined)
      updateData.memoria_calculo = memoria_calculo;
    if (debito_valor !== undefined) updateData.debito_valor = debito_valor;
    if (percentual_salario !== undefined)
      updateData.percentual_salario = percentual_salario;

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
    logger.error(
      `Erro ao salvar dados jurídicos do caso ${id}: ${error.message}`,
    );
    res.status(500).json({ error: "Erro ao salvar dados jurídicos." });
  }
};

export const salvarFeedback = async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;
  try {
    let casoEncontrado;

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from("casos")
        .update({ feedback })
        .eq("id", id);
      if (updateError) throw updateError;

      const { data, error: fetchError } = await supabase
        .from("casos")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;
      casoEncontrado = data;
    } else {
      // Fallback Prisma
      casoEncontrado = await prisma.casos.update({
        where: { id: BigInt(id) },
        data: { feedback },
      });
    }

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
    // Restrição: Apenas administradores podem regenerar os fatos
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas administradores podem regenerar os fatos.",
      });
    }

    let caso;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("casos")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("Caso não encontrado");
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
      });
      if (!caso) throw new Error("Caso não encontrado");
    }

    const dados = caso.dados_formulario || caso;
    if (!dados.relato_texto && caso.relato_texto)
      dados.relato_texto = caso.relato_texto;
    const dosFatosTexto = await generateDosFatos(dados);

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
          dados_extraidos: currentExtra,
        },
      });
      casoAtualizado = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        include: { partes: true, ia: true, juridico: true, documentos: true },
      });
    }

    // Reanexa URLs assinadas para que links de download/áudio não quebrem na tela
    const casoComUrls = await attachSignedUrls(casoAtualizado);
    res.status(200).json(stringifyBigInts(casoComUrls));
  } catch (error) {
    res.status(500).json({ error: "Falha ao regenerar texto." });
  }
};

export const gerarTermoDeclaracao = async (req, res) => {
  const { id } = req.params;
  try {
    // Restrição: Apenas administradores podem gerar ou regerar o termo
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({
        error:
          "Acesso negado. Apenas administradores podem realizar esta operação.",
      });
    }

    const casoRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: { partes: true, ia: true },
    });
    if (!casoRaw) throw new Error("Caso não encontrado");
    const caso = mapCasoRelations(casoRaw);

    const dados = caso.dados_formulario || caso;

    // Build term declaration data payload
    const termoData = {
      ...dados,
      nome_assistido: (dados.nome || caso.nome_assistido || "").toUpperCase(),
      representante_nome: (dados.representante_nome || "").toUpperCase(),
      cpf_assistido: dados.cpf || caso.cpf_assistido,
      relato_texto: (caso.relato_texto || "").replace(/\n/g, "\r\n"),
      filhos_info: (
        dados.filhos_info ||
        dados.nome ||
        caso.nome_assistido ||
        ""
      ).toUpperCase(),
      data_atual: new Date().toLocaleDateString("pt-BR"),
      protocolo: caso.protocolo,
      tipo_acao: caso.tipo_acao,
      // Helpers para o template .docx
      eh_representacao: dados.assistido_eh_incapaz === "sim",
      endereco_assistido:
        dados.endereco_assistido || dados.representante_endereco_residencial,
      telefone_assistido: dados.telefone || caso.telefone_assistido,
      profissao:
        dados.assistido_ocupacao ||
        dados.representante_ocupacao ||
        "Não informada",
      estado_civil: dados.assistido_estado_civil || "Não informado",
    };

    // Generate the term declaration document
    const docxBuffer = await generateTermoDeclaracao(termoData);

    // Upload to storage (Supabase or Local)
    const termoPath = `${caso.protocolo}/termo_declaracao_${caso.protocolo}.docx`;

    if (isSupabaseConfigured) {
      await supabase.storage.from("peticoes").remove([termoPath]);
      const { error: uploadError } = await supabase.storage
        .from("peticoes")
        .upload(termoPath, docxBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          upsert: true,
        });
      if (uploadError)
        throw new Error(`Erro upload Supabase: ${uploadError.message}`);
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

    const casoAtualizadoRaw = await prisma.casos.update({
      where: { id: BigInt(id) },
      data: {
        ia: {
          update: { dados_extraidos: currentExtra },
        },
      },
      include: { partes: true, ia: true, juridico: true, documentos: true },
    });
    const casoAtualizado = await attachSignedUrls(
      mapCasoRelations(casoAtualizadoRaw),
    );
    res.status(200).json(stringifyBigInts(casoAtualizado));
  } catch (error) {
    logger.error(`Erro ao gerar termo de declaração: ${error.message}`);
    res.status(500).json({ error: "Falha ao gerar termo de declaração." });
  }
};

export const regerarMinuta = async (req, res) => {
  const { id } = req.params;
  try {
    // Restrição: Apenas administradores
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({
        error: "Acesso negado. Apenas administradores podem regerar a minuta.",
      });
    }

    const dataRaw = await prisma.casos.findUnique({
      where: { id: BigInt(id) },
      include: { partes: true, ia: true, juridico: true },
    });
    if (!dataRaw) throw new Error("Caso não encontrado");
    const caso = mapCasoRelations(dataRaw);

    // 1. Prepara os dados baseados no estado atual do caso no banco
    const dosFatosTexto = (caso.peticao_inicial_rascunho || "").replace(
      "DOS FATOS\n\n",
      "",
    );

    const normalizedData = {
      comarca:
        process.env.DEFENSORIA_DEFAULT_COMARCA || "Teixeira de Freitas/BA",
      defensoraNome:
        process.env.DEFENSORIA_DEFAULT_DEFENSORA ||
        "DEFENSOR(A) PÚBLICO(A) DO ESTADO DA BAHIA",
      triagemNumero: caso.protocolo,
    };

    // 2. Prepara os dados do formulário com o percentual recalculado e salário mínimo correto
    const baseData = caso.dados_formulario || caso;
    const valorMensalPensao = baseData.valor_mensal_pensao;
    const percentualSalarioMinimoCalculado =
      calcularPercentualSalarioMinimo(valorMensalPensao);
    const valorPensaoFormatado = formatCurrencyBr(valorMensalPensao);

    // Adiciona o percentual calculado e o salário mínimo correto aos dados do formulário
    const dadosComPercentual = {
      ...baseData,
      percentual_salario_minimo: percentualSalarioMinimoCalculado,
      percentual_definitivo_salario_min: percentualSalarioMinimoCalculado,
      salario_minimo_atual: salarioMinimoAtual,
      salario_minimo_formatado: formatCurrencyBr(salarioMinimoAtual),
      valor_salario_minimo: formatCurrencyBr(salarioMinimoAtual),
      valor_pensao: valorPensaoFormatado,
      valor_pensao_solicitado: valorPensaoFormatado,
    };

    let acaoRaw =
      caso.dados_formulario?.acaoEspecifica ||
      (caso.tipo_acao || "").split(" - ")[1]?.trim() ||
      (caso.tipo_acao || "").trim();

    // Normalização básica: converte para snake_case se vier com espaços ou camelCase
    let acaoKey = acaoRaw
      .toLowerCase()
      .replace(/\s+/g, "_")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    // Mapeamento manual para casos comuns que podem vir do PDF/Formulário
    if (
      acaoKey.includes("execucao") &&
      (acaoKey.includes("penhora") || acaoKey.includes("prisao"))
    ) {
      acaoKey = "execucao_alimentos";
    }

    // 3. Gera o novo payload e o buffer do Word
    const payload = buildDocxTemplatePayload(
      normalizedData,
      dosFatosTexto,
      dadosComPercentual,
      acaoKey,
    );

    const { getConfigAcaoBackend } =
      await import("../config/dicionarioAcoes.js");
    const configAcao = getConfigAcaoBackend(acaoKey);

    let docxPath; // URL da minuta primária ou única

    if (configAcao.gerarMultiplos) {
      const periodoParaCalculo =
        dadosComPercentual.periodo_debito_execucao ||
        dadosComPercentual.periodo_debito ||
        "";
      const docs = await generateMultiplosDocx(
        payload,
        acaoKey,
        periodoParaCalculo,
      );

      let url_peticao_penhora = null;
      let url_peticao_prisao = null;

      for (const doc of docs) {
        const pathMultiplo = `${caso.protocolo}/${doc.filename}`;

        if (isSupabaseConfigured) {
          const { error: uploadError } = await supabase.storage
            .from("peticoes")
            .upload(pathMultiplo, doc.buffer, {
              contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              upsert: true,
            });
          if (uploadError)
            throw new Error(`Erro upload Supabase: ${uploadError.message}`);
        } else {
          const localDir = path.resolve("uploads", "peticoes", caso.protocolo);
          await fs.mkdir(localDir, { recursive: true });
          await fs.writeFile(path.join(localDir, doc.filename), doc.buffer);
          logger.info(`[Local] Minuta (${doc.tipo}) regerada em ${localDir}`);
        }

        if (doc.tipo === "penhora") url_peticao_penhora = pathMultiplo;
        if (doc.tipo === "prisao") url_peticao_prisao = pathMultiplo;
      }

      docxPath = url_peticao_penhora;

      // 5. Atualiza a IA com as novas URLs múltiplas via JSONB flexível
      const currentExtra = safeJsonParse(caso.ia?.dados_extraidos, {});
      if (url_peticao_penhora)
        currentExtra.url_peticao_penhora = url_peticao_penhora;
      if (url_peticao_prisao)
        currentExtra.url_peticao_prisao = url_peticao_prisao;

      let iaUpdateData = {
        url_peticao: docxPath,
        url_peticao_penhora: url_peticao_penhora,
        url_peticao_prisao: url_peticao_prisao,
        dados_extraidos: currentExtra,
      };

      if (isSupabaseConfigured) {
        await supabase.from("casos_ia").update(iaUpdateData).eq("caso_id", id);
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
            contentType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
          });
        if (uploadError)
          throw new Error(`Erro upload Supabase: ${uploadError.message}`);
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
          .update({ url_peticao: docxPath, url_peticao_penhora: docxPath, dados_extraidos: currentExtra })
          .eq("caso_id", id);
      } else {
        await prisma.casos_ia.update({
          where: { caso_id: BigInt(id) },
          data: { url_peticao: docxPath, url_peticao_penhora: docxPath, dados_extraidos: currentExtra },
        });
      }
    }

    // 6. Retorna o caso atualizado com as novas URLs assinadas
    const casoAtualizado = await attachSignedUrls({
      ...caso,
      url_documento_gerado: docxPath,
    });

    res.status(200).json(stringifyBigInts(casoAtualizado));
  } catch (error) {
    logger.error(`Erro ao regerar minuta: ${error.message}`);
    res.status(500).json({ error: "Falha ao regerar a minuta em Word." });
  }
};

export const buscarPorCpf = async (req, res) => {
  const cpf = req.params.cpf || req.query.cpf;
  if (!cpf) return res.status(400).json({ error: "CPF não fornecido." });

  try {
    const cpfLimpo = cpf.replace(/\D/g, "");

    // Usamos Prisma diretamente para poder buscar em JSONs e relações profundamente
    let data = await prisma.casos.findMany({
      where: {
        OR: [
          { protocolo: cpf },
          {
            partes: {
              OR: [
                { cpf_assistido: cpf },
                { cpf_assistido: cpfLimpo },
                { cpf_requerido: cpf },
                { cpf_requerido: cpfLimpo },
              ],
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
                path: ["cpf"],
                equals: cpf,
              },
            },
          },
          {
            ia: {
              dados_extraidos: {
                path: ["cpf"],
                equals: cpfLimpo,
              },
            },
          },
        ],
      },
      include: {
        partes: true,
        ia: true,
        juridico: true,
        documentos: true,
      },
      orderBy: { created_at: "desc" },
    });

    // Hidrata e garante compatibilidade para mapCasoRelations processar as relations prontas
    const normalizedData = (data || []).map((casoRaw) => {
      // Como o include já traz partes, ia, etc, a mapCasoRelations lida com eles
      const caso = mapCasoRelations(casoRaw);

      if (!caso.dados_formulario || typeof caso.dados_formulario !== "object") {
        // Tenta remapear de ia.dados_extraidos se existir
        caso.dados_formulario =
          caso.casos_ia?.dados_extraidos || caso.ia?.dados_extraidos || {};
      }

      if (!caso.dados_formulario.document_names)
        caso.dados_formulario.document_names = {};
      if (!caso.dados_formulario.documentNames) {
        caso.dados_formulario.documentNames =
          caso.dados_formulario.document_names;
      }
      return caso;
    });

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
      const safeOriginalName = path.basename(file.originalname);
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
        const localPath = path.join(
          localDir,
          `${id}_${Date.now()}_${safeOriginalName}`,
        );
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
      finished_at: new Date(),
    };

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from("casos")
        .update(updateData)
        .eq("id", id);
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

export const agendarReuniao = async (req, res) => {
  const { id } = req.params;
  const { agendamento_data, agendamento_link } = req.body;

  // Define o status como 'agendado' se houver dados, ou 'pendente' se estiverem vazios
  const status = agendamento_data && agendamento_link ? "agendado" : "pendente";

  try {
    let data;
    if (isSupabaseConfigured) {
      const result = await supabase
        .from("casos")
        .update({
          agendamento_data,
          agendamento_link,
          agendamento_status: status,
        })
        .eq("id", id)
        .select()
        .single();
      if (result.error) throw result.error;
      data = result.data;
    } else {
      data = await prisma.casos.update({
        where: { id: BigInt(id) },
        data: {
          agendamento_data,
          agendamento_link,
          agendamento_status: status,
        },
      });
    }

    res.status(200).json(stringifyBigInts(data));
  } catch (err) {
    logger.error(`Erro ao agendar reunião para o caso ${id}: ${err.message}`);
    res.status(500).json({ error: "Erro ao agendar reunião." });
  }
};

export const reverterFinalizacao = async (req, res) => {
  if (!req.user || req.user.cargo !== "admin") {
    return res.status(403).json({
      error:
        "Acesso negado. Apenas administradores podem reverter a finalização.",
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
          logger.info(
            `Revertendo finalização: Excluindo capa do Supabase para o caso ${id}`,
          );
          await supabase.storage
            .from(storageBuckets.documentos)
            .remove([filePath]);
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
      const { error: updateError } = await supabase
        .from("casos")
        .update(updateData)
        .eq("id", id);
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
    logger.error(
      `Erro ao reverter finalização do caso ${id}: ${error.message}`,
    );
    res.status(500).json({ error: "Erro ao reverter finalização do caso." });
  }
};

export const resetarChaveAcesso = async (req, res) => {
  const { id } = req.params;
  try {
    let caso;
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from("casos")
        .select("tipo_acao")
        .eq("id", id)
        .single();
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
        select: { tipo_acao: true },
      });
    }

    if (!caso) throw new Error("Caso não encontrado");

    const { chaveAcesso } = generateCredentials(caso.tipo_acao);
    const chaveAcessoHash = hashKeyWithSalt(chaveAcesso);

    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from("casos")
        .update({ chave_acesso_hash: chaveAcessoHash })
        .eq("id", id);
      if (error) throw error;
    } else {
      await prisma.casos.update({
        where: { id: BigInt(id) },
        data: { chave_acesso_hash: chaveAcessoHash },
      });
    }

    res.status(200).json({ novaChave: chaveAcesso });
  } catch (error) {
    logger.error(`Erro ao resetar chave do caso ${id}: ${error.message}`);
    res.status(500).json({ error: "Erro ao resetar chave." });
  }
};
export const receberDocumentosComplementares = async (req, res) => {
  const { id } = req.params;
  // Tenta pegar do body (FormData) ou da query string (URL) para garantir
  const cpfRaw = req.body.cpf || req.query.cpf;
  const cpf = cpfRaw ? String(cpfRaw).replace(/\D/g, "") : null;
  const chave = req.body.chave || req.query.chave;
  const { nomes_arquivos } = req.body;

  try {
    logger.info(
      `[Upload Complementar] Iniciando. ID: ${id}, CPF recebido: ${!!cpf} `,
    );

    let caso = null;

    // 1. Tenta buscar por ID ou Protocolo na URL
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      );
    const isInt = /^\d+$/.test(id) && id !== "0";

    if (isSupabaseConfigured) {
      if (isUUID || isInt) {
        const { data } = await supabase
          .from("casos")
          .select("*")
          .eq("id", id)
          .single();
        caso = data;
      } else if (id !== "0") {
        const { data } = await supabase
          .from("casos")
          .select("*")
          .eq("protocolo", id)
          .single();
        caso = data;
      }
    } else {
      // Fallback Prisma
      if (isInt) {
        caso = await prisma.casos.findUnique({ where: { id: BigInt(id) } });
      } else if (id !== "0") {
        caso = await prisma.casos.findUnique({ where: { protocolo: id } });
      }
    }

    // 2. Fallback: Se não achou pelo ID (ex: frontend enviou 0), tenta por CPF + Chave
    if (!caso) {
      if (cpf && chave) {
        let casosCpf;
        if (isSupabaseConfigured) {
          const { data } = await supabase
            .from("casos")
            .select("*")
            .eq("cpf_assistido", cpf);
          casosCpf = data;
        } else {
          casosCpf = await prisma.casos.findMany({
            where: { cpf_assistido: cpf },
          });
        }

        if (casosCpf && casosCpf.length > 0) {
          caso = casosCpf.find((c) => verifyKey(chave, c.chave_acesso_hash));
        }
      } else {
        logger.warn(
          `[Upload Complementar] Falha: ID inválido (${id}) e credenciais não fornecidas no corpo da requisição.`,
        );
      }
    }

    if (!caso)
      throw new Error(
        "Caso não encontrado. Verifique se o CPF e a Chave estão corretos.",
      );

    const novosUrls = [];

    // 2. Processa os arquivos enviados
    if (req.files && req.files.documentos) {
      for (const docFile of req.files.documentos) {
        // Sanitiza nome
        const safeName = docFile.originalname
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const filePath = `${caso.protocolo}/complementar_${Date.now()}_${safeName}`;

        if (isSupabaseConfigured) {
          const docStream = fsSync.createReadStream(docFile.path);
          const { error: uploadError } = await supabase.storage
            .from(storageBuckets.documentos)
            .upload(filePath, docStream, {
              contentType: docFile.mimetype,
              duplex: "half",
            });
          if (uploadError)
            logger.error(
              `Erro upload complementar Supabase: ${uploadError.message}`,
            );
          else novosUrls.push(filePath);
        } else {
          // Fallback Local
          const localDir = path.resolve(
            "uploads",
            "documentos",
            caso.protocolo,
          );
          await fs.mkdir(localDir, { recursive: true });
          const localPath = path.join(
            localDir,
            `complementar_${Date.now()}_${safeName}`,
          );
          await fs.copyFile(docFile.path, localPath);
          novosUrls.push(
            `documentos/${caso.protocolo}/${path.basename(localPath)}`,
          );
          logger.info(`[Local] Documento complementar salvo em ${localPath}`);
        }

        // Limpa arquivo temporário
        try {
          await fs.unlink(docFile.path);
        } catch (e) {
          logger.warn(
            `Falha ao limpar arquivo temporário complementar: ${docFile.path}`,
            e.message,
          );
        }
      }
    }

    if (novosUrls.length === 0) {
      return res.status(400).json({ error: "Nenhum arquivo foi enviado." });
    }

    // 3. Atualiza metadados de nomes (dados_formulario.document_names)
    const nomesMap = safeJsonParse(nomes_arquivos, {});

    const currentDadosFormulario = caso.dados_formulario || {};
    const currentNames = currentDadosFormulario.document_names || {};

    const updatedNames = { ...currentNames, ...nomesMap };
    const updatedDadosFormulario = {
      ...currentDadosFormulario,
      document_names: updatedNames,
    };

    // 4. Prepara e atualiza o banco
    const updatePayload = {
      urls_documentos: [...(caso.urls_documentos || []), ...novosUrls],
      dados_formulario: updatedDadosFormulario,
      status: "documentacao_completa",
      updated_at: new Date(),
    };

    if (isSupabaseConfigured) {
      const { error: updateError } = await supabase
        .from("casos")
        .update(updatePayload)
        .eq("id", caso.id);
      if (updateError) throw updateError;
    } else {
      await prisma.casos.update({
        where: { id: caso.id },
        data: updatePayload,
      });
    }

    // [NOTIFICAÇÃO] Alerta o defensor sobre novos documentos
    const notifData = {
      caso_id: caso.id,
      mensagem: `Novos documentos entregues por ${caso.nome_assistido || "Assistido"}.`,
      tipo: "upload",
      lida: false,
      created_at: new Date(),
    };

    if (isSupabaseConfigured) {
      await supabase.from("notificacoes").insert(notifData);
    } else {
      // Opcional: Se houver model de notificações no Prisma
      // await prisma.notificacoes.create({ data: notifData });
    }

    // [PROCESSAMENTO EM BACKGROUND]
    // Agora que temos novos documentos, o caso não precisa esperar intervenção manual
    setImmediate(() => {
      processarCasoEmBackground(
        caso.protocolo,
        updatePayload.dados_formulario,
        updatePayload.urls_documentos,
        caso.url_audio,
        caso.url_peticao,
      );
    });

    res.status(200).json({
      message:
        "Documentos enviados com sucesso e caso na fila de processamento!",
    });
  } catch (error) {
    logger.error(`Erro upload complementar para caso ${id}: ${error.message}`);
    res
      .status(500)
      .json({ error: error.message || "Falha ao enviar documentos." });
  }
};

// --- DELETAR CASO (Apenas Admin) ---
export const deletarCaso = async (req, res) => {
  const { id } = req.params;
  try {
    // Verificação de permissão de admin
    if (!req.user || req.user.cargo !== "admin") {
      return res.status(403).json({
        error: "Acesso negado. Apenas administradores podem excluir casos.",
      });
    }

    let caso;
    if (isSupabaseConfigured) {
      const { data, error: fetchError } = await supabase
        .from("casos")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError || !data) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      caso = data;
    } else {
      const data = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
      });
      if (!data) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      caso = data;
    }

    // --- REMOVER ARQUIVOS DO STORAGE (Apenas se Supabase configurado) ---
    if (isSupabaseConfigured) {
      const filesToDelete = {
        [storageBuckets.audios]: [],
        [storageBuckets.peticoes]: [],
        [storageBuckets.documentos]: [],
      };

      const addFile = (bucket, path) => {
        const cleanPath = extractObjectPath(path);
        if (cleanPath) filesToDelete[bucket].push(cleanPath);
      };

      addFile(storageBuckets.audios, caso.url_audio);
      addFile(storageBuckets.peticoes, caso.url_peticao);
      addFile(storageBuckets.peticoes, caso.url_documento_gerado);
      addFile(storageBuckets.peticoes, caso.url_termo_declaracao);
      addFile(storageBuckets.documentos, caso.url_capa_processual);

      if (Array.isArray(caso.urls_documentos)) {
        caso.urls_documentos.forEach((doc) =>
          addFile(storageBuckets.documentos, doc),
        );
      }

      await Promise.all(
        Object.entries(filesToDelete).map(async ([bucket, files]) => {
          if (files.length > 0) {
            logger.info(
              `🗑️ Excluindo ${files.length} arquivos do bucket '${bucket}' vinculados ao caso ${id}`,
            );
            await supabase.storage.from(bucket).remove(files);
          }
        }),
      );
    } else {
      // Se local, poderíamos remover os arquivos da pasta uploads no futuro
      logger.info(`[Local] Ignorando limpeza de storage para o caso ${id}`);
    }

    // Excluir o caso do banco de dados
    if (isSupabaseConfigured) {
      const { error: deleteError } = await supabase
        .from("casos")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
    } else {
      await prisma.casos.delete({
        where: { id: BigInt(id) },
      });
    }

    res.json({ message: "Caso excluído com sucesso." });
  } catch (err) {
    logger.error(`Erro ao deletar caso ${id}: ${err.message}`);
    res.status(500).json({ error: "Erro ao excluir caso." });
  }
};

// --- REPROCESSAR CASO (Manual) ---
export const reprocessarCaso = async (req, res) => {
  const { id } = req.params;
  try {
    // Busca os dados originais do caso
    let caso;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("casos")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
      caso = data;
    } else {
      caso = await prisma.casos.findUnique({
        where: { id: BigInt(id) },
      });
      if (!caso) {
        return res.status(404).json({ error: "Caso não encontrado." });
      }
    }

    // Responde imediatamente para a interface não travar
    res
      .status(200)
      .json({ message: "Reprocessamento iniciado em background." });

    // Dispara o worker novamente
    setImmediate(async () => {
      try {
        await processarCasoEmBackground(
          caso.protocolo,
          caso.dados_formulario,
          caso.urls_documentos || [],
          caso.url_audio,
          caso.url_peticao,
        );
      } catch (err) {
        logger.error(`Erro ao reprocessar caso ${id}: ${err.message}`);
      }
    });
  } catch (error) {
    logger.error(`Erro ao solicitar reprocessamento: ${error.message}`);
    if (!res.headersSent)
      res.status(500).json({ error: "Erro interno ao reprocessar." });
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

    await supabase
      .from("casos")
      .update({ dados_formulario: dados })
      .eq("id", id);

    res.status(200).json({ message: "Documento renomeado com sucesso." });
  } catch (e) {
    res.status(500).json({ error: "Erro ao renomear documento." });
  }
};

export const solicitarReagendamento = async (req, res) => {
  const { id } = req.params;
  const { motivo, data_sugerida, cpf, chave } = req.body;

  try {
    // 1. Busca o caso para validar credenciais
    const { data: caso, error: fetchError } = await supabase
      .from("casos")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !caso) {
      return res.status(404).json({ error: "Caso não encontrado." });
    }

    // 2. Validação de Segurança (CPF e Chave)
    // Remove caracteres não numéricos do CPF para comparação
    const cpfLimpo = (cpf || "").replace(/\D/g, "");
    if (caso.cpf_assistido !== cpfLimpo) {
      return res.status(403).json({ error: "CPF inválido para este caso." });
    }

    const chaveValida = verifyKey(chave, caso.chave_acesso_hash);
    if (!chaveValida) {
      return res.status(403).json({ error: "Chave de acesso inválida." });
    }

    // 3. Salvar histórico se houver agendamento anterior ativo
    if (caso.agendamento_data) {
      const tipoReuniao = caso.status.includes("presencial")
        ? "presencial"
        : "online";

      await supabase.from("historico_agendamentos").insert({
        caso_id: id,
        data_agendamento: caso.agendamento_data,
        link_ou_local: caso.agendamento_link,
        tipo: tipoReuniao,
        status: "reagendado",
      });
    }

    // 4. Atualiza o status e salva nas colunas específicas
    const { error: updateError } = await supabase
      .from("casos")
      .update({
        status: "reagendamento_solicitado",
        motivo_reagendamento: motivo,
        data_sugerida_reagendamento: data_sugerida,
        agendamento_data: null, // Libera a agenda
        agendamento_link: null,
        updated_at: new Date(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // [NOTIFICAÇÃO] Alerta o defensor sobre solicitação de reagendamento
    const { error: notifError } = await supabase.from("notificacoes").insert({
      caso_id: id,
      mensagem: `Solicitação de reagendamento para o caso ${caso.nome_assistido || "Assistido"}.`,
      tipo: "reagendamento",
      lida: false,
      created_at: new Date().toISOString(),
    });

    if (notifError) {
      logger.error(
        `Falha ao criar notificação de reagendamento: ${notifError.message}`,
        { error: notifError },
      );
    }

    res.status(200).json({ message: "Solicitação enviada com sucesso." });
  } catch (error) {
    logger.error(`Erro ao solicitar reagendamento: ${error.message}`);
    res.status(500).json({ error: "Erro ao processar solicitação." });
  }
};

export const alternarArquivamento = async (req, res) => {
  const { id } = req.params;
  const { arquivado, motivo } = req.body; // espera true ou false

  // Validação: Motivo obrigatório ao arquivar
  if (arquivado === true && (!motivo || motivo.trim().length < 5)) {
    return res.status(400).json({
      error: "Motivo de arquivamento é obrigatório (mín. 5 caracteres).",
    });
  }

  try {
    const updateData = { arquivado };
    if (arquivado) {
      updateData.motivo_arquivamento = motivo;
    } else {
      updateData.motivo_arquivamento = null; // Limpa o motivo ao restaurar
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
          include: { unidade: true } 
        },
        remetente: true 
      },
    });

    if (!assistencia || assistencia.destinatario_id !== userId) {
      return res
        .status(403)
        .json({ error: "Solicitação não encontrada ou não autorizada." });
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
      await registrarLog(
        userId,
        "assistencia_aceita",
        "casos",
        assistencia.caso_id,
        {
          remetente_nome: assistencia.remetente.nome,
          destinatario_nome: req.user.nome,
          unidade: assistencia.caso.unidade?.nome,
          tipo_acao: assistencia.caso.tipo_acao,
          mensagem: `Colaboração aceita: ${req.user.nome} agora ajuda no caso #${assistencia.caso_id} (${assistencia.caso.tipo_acao}) da unidade ${assistencia.caso.unidade?.nome}`
        }
      );
    }

    // 4. Notifica o remetente sobre a resposta
    await prisma.notificacoes.create({
      data: {
        usuario_id: assistencia.remetente_id,
        titulo: aceito ? "Colaboração Aceita" : "Colaboração Recusada",
        mensagem: `${req.user.nome} ${aceito ? "aceitou" : "recusou"} o pedido de ajuda no caso #${assistencia.caso_id}.`,
        tipo: "assistencia_resposta",
        referencia_id: assistencia_id
      },
    });

    res.status(200).json({ status: novoStatus });
  } catch (error) {
    logger.error(`Erro ao responder assistência: ${error.message}`);
    res.status(500).json({ error: "Erro ao processar resposta." });
  }
};
