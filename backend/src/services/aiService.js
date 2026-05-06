import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import OpenAI from "openai";
import dotenv from "dotenv";

// Configuração de timeout para chamadas de IA (em milissegundos)
const IA_TIMEOUT_MS = 30000; // 30 segundos

dotenv.config();

// Inicialização dos Clientes
const geminiClient = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// Função auxiliar para escapar caracteres especiais em Regex (segurança)
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * SERVIÇO 1: VISÃO (OCR) - Exclusivo Gemini 2.5 Flash
 * Processa imagens de documentos.
 */
export const visionOCR = async (bufferImagem, mimeType, promptContexto = "") => {
  if (!geminiClient) throw new Error("Cliente Gemini não configurado.");
  const model = geminiClient.getGenerativeModel({
    model: "gemini-2.5-flash",
  });

  const prompt = `ATENÇÃO: Extração de Dados de Documento Oficial.
    ${promptContexto}
    Retorne APENAS os dados solicitados, preferencialmente em JSON limpo.`;

  const imagePart = {
    inlineData: {
      data: bufferImagem.toString("base64"),
      mimeType: mimeType,
    },
  };

  const MAX_RETRIES = 3;
  for (let tentativa = 0; tentativa < MAX_RETRIES; tentativa++) {
    try {
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      const isRateLimit =
        error.status === 429 ||
        error.message?.includes("429") ||
        error.message?.includes("Too Many Requests");

      if (isRateLimit && tentativa < MAX_RETRIES - 1) {
        const delay = 6000 * (tentativa + 1); // 6s, 12s
        console.warn(
          `⏳ [OCR] Rate limit (429). Retry ${tentativa + 1}/${MAX_RETRIES} em ${delay / 1000}s...`,
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      console.error("❌ Erro no OCR (Gemini):", error.message);
      throw new Error("Falha ao ler o documento visualmente.", {
        cause: error,
      });
    }
  }
};

/**
 * SERVIÇO 2: REDAÇÃO JURÍDICA BLINDADA (Sanitização PII + Híbrido)
 * @param {string} systemPrompt - Instruções de persona e estilo.
 * @param {string} userPrompt - O pedido com os dados do caso.
 * @param {number} temperature - Criatividade (0.1 recomendado para jurídico).
 * @param {object} piiMap - Objeto mapeando { "Valor Real": "[PLACEHOLDER]" }.
 */
export const generateLegalText = async (
  systemPrompt,
  userPrompt,
  temperature = 0.1,
  piiMap = {},
) => {
  // --- ETAPA 1: SANITIZAÇÃO (ANONIMIZAÇÃO) ---
  let safeSystemPrompt = systemPrompt;
  let safeUserPrompt = userPrompt;

  const piiKeys = Object.keys(piiMap).sort((a, b) => b.length - a.length);

  piiKeys.forEach((realValue) => {
    if (!realValue || realValue.length < 3) return;
    const placeholder = piiMap[realValue];
    const regex = new RegExp(escapeRegExp(realValue), "gi");
    safeSystemPrompt = safeSystemPrompt.replace(regex, placeholder);
    safeUserPrompt = safeUserPrompt.replace(regex, placeholder);
  });

  console.log("\n🔒 [AUDITORIA LGPD] Payload Seguro Enviado para IA:");
  console.log("---------------------------------------------------");
  console.log("DADOS SENSÍVEIS DETECTADOS E MASCARADOS:", piiKeys.length);
  console.log("USER PROMPT (TRECHO):", safeUserPrompt.substring(0, 300) + "...");
  console.log("---------------------------------------------------\n");

  let generatedText = "";

  try {
    // TENTATIVA 1: Groq (Llama 3.3) - Prioridade: Velocidade
    const groqController = new AbortController();
    const groqTimeout = setTimeout(() => groqController.abort(), IA_TIMEOUT_MS);

    try {
      if (!groqClient) throw new Error("Cliente Groq não configurado.");

      const completion = await groqClient.chat.completions.create({
        messages: [
          { role: "system", content: safeSystemPrompt },
          { role: "user", content: safeUserPrompt },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: temperature,
        max_tokens: 1500,
        top_p: 0.8,
      }, { signal: groqController.signal });

      clearTimeout(groqTimeout);
      generatedText = completion.choices[0]?.message?.content || "";
    } catch (groqError) {
      clearTimeout(groqTimeout);
      
      const isAbort = groqError.name === 'AbortError' || groqError.message?.includes('abort');
      if (isAbort) {
        console.warn("⏱️ Timeout real na Groq (Abortado).");
      }

      console.warn(
        "⚠️ Groq instável ou Rate Limit. Ativando Fallback para OpenAI (4o-mini)...",
        groqError.message,
      );

      // TENTATIVA 2: OpenAI GPT-4o-mini (Fallback: Inteligência)
      const openaiController = new AbortController();
      const openaiTimeout = setTimeout(() => openaiController.abort(), IA_TIMEOUT_MS);

      try {
        if (!openaiClient) throw new Error("Cliente OpenAI não configurado.", { cause: groqError });
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: safeSystemPrompt },
            { role: "user", content: safeUserPrompt },
          ],
          temperature: temperature,
          max_tokens: 1500,
        }, { signal: openaiController.signal });

        clearTimeout(openaiTimeout);
        generatedText = completion.choices[0]?.message?.content || "";
      } catch (openaiError) {
        clearTimeout(openaiTimeout);
        const isAbortOpenAI = openaiError.name === 'AbortError' || openaiError.message?.includes('abort');
        
        console.error(`❌ Erro na chamada OpenAI ${isAbortOpenAI ? '(Timeout/Abortado)' : ''}:`, openaiError.message);
        throw new Error("Ambos os serviços de IA (Groq/OpenAI) falharam ou excederam o tempo limite.", {
          cause: openaiError,
        });
      }
    }
  } catch (error) {
    console.error("❌ Erro Crítico IA:", error.message);
    throw new Error("Serviço de Inteligência Artificial indisponível no momento.", {
      cause: error,
    });
  }

  // --- ETAPA 3: DESANITIZAÇÃO (RESTAURAÇÃO) ---
  piiKeys.forEach((realValue) => {
    const placeholder = piiMap[realValue];
    const regex = new RegExp(escapeRegExp(placeholder), "gi");
    generatedText = generatedText.replace(regex, realValue);
  });

  return generatedText;
};
