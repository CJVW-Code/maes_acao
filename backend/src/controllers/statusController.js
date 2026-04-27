/* eslint-disable no-unused-vars */
import {  isSupabaseConfigured } from "../config/supabase.js";
import { prisma } from "../config/prisma.js";

import logger from "../utils/logger.js";

export const consultarStatus = async (req, res) => {
  const { cpf } = req.query;

  if (!cpf) {
    return res.status(400).json({ error: "CPF é obrigatório para consulta." });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, "");

  try {
    const casos = await prisma.casos.findMany({
      where: {
        partes: { cpf_assistido: cpfLimpo }
      },
      include: {
        partes: true
      },
      orderBy: { created_at: "desc" }
    });

    if (!casos || casos.length === 0) {
      return res.status(404).json({ error: "CPF inválido ou sem casos vinculados." });
    }

    const respostaCasos = casos.map(caso => {
      return {
        id: caso.id,
        protocolo: caso.protocolo,
        status: caso.status,
        nome_assistido: caso.partes?.nome_assistido || "Não informado",
        nome_representante: caso.partes?.nome_representante || caso.partes?.nome_assistido || "Não informado",
      };
    });

    res.status(200).json(stringifyBigInts(respostaCasos));
  } catch (err) {
    logger.error(`Erro crítico ao consultar status: ${err.message}`);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

export const consultarPorCpf = async (req, res) => {
  const { cpf } = req.params;

  if (!cpf) {
    return res.status(400).json({ error: "CPF é obrigatório." });
  }

  const cpfLimpo = String(cpf).replace(/\D/g, "");

  try {
    const casos = await prisma.casos.findMany({
      where: {
        OR: [
          { protocolo: cpfLimpo },
          { partes: { cpf_assistido: cpfLimpo } }
        ]
      },
      include: {
        partes: true
      },
      orderBy: { created_at: "desc" }
    });

    if (!casos || casos.length === 0) {
      return res.status(404).json({ error: "Nenhum caso encontrado." });
    }

    const respostaCasos = casos.map(caso => {
      return {
        id: caso.id,
        protocolo: caso.protocolo,
        status: caso.status,
        nome_assistido: caso.partes?.nome_assistido || "Não informado",
        nome_representante: caso.partes?.nome_representante || caso.partes?.nome_assistido || "Não informado",
      };
    });

    res.status(200).json(stringifyBigInts(respostaCasos));
  } catch (err) {
    logger.error(`Erro crítico ao consultar por CPF: ${err.message}`);
    res.status(500).json({ error: "Ocorreu um erro interno no servidor." });
  }
};

const stringifyBigInts = (obj) => {
  if (obj === null || obj === undefined) return obj;
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

