import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import dotenv from "dotenv";

// Configuração de timeout para chamadas de IA (em milissegundos)
const IA_TIMEOUT_MS = 30000; // 30 segundos

dotenv.config();

// Inicialização dos Clientes
const geminiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const groqClient = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

// Função auxiliar para escapar caracteres especiais em Regex (segurança)
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * SERVIÇO 1: VISÃO (OCR) - Exclusivo Gemini 2.5 Flash
 * Processa imagens de documentos.
 * Nota: OCR geralmente não passa por sanitização prévia pois a entrada é binária (imagem).
 */
export const visionOCR = async (
  bufferImagem,
  mimeType,
  promptContexto = "",
) => {
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
      const isRateLimit = error.status === 429 || error.message?.includes("429") || error.message?.includes("Too Many Requests");

      if (isRateLimit && tentativa < MAX_RETRIES - 1) {
        const delay = 6000 * (tentativa + 1); // 6s, 12s
        console.warn(`⏳ [OCR] Rate limit (429). Retry ${tentativa + 1}/${MAX_RETRIES} em ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      console.error("❌ Erro no OCR (Gemini):", error.message);
      throw new Error("Falha ao ler o documento visualmente.");
    }
  }
};

/**
 * SERVIÇO 2: REDAÇÃO JURÍDICA BLINDADA (Sanitização PII + Híbrido)
 * * @param {string} systemPrompt - Instruções de persona e estilo.
 * @param {string} userPrompt - O pedido com os dados do caso.
 * @param {number} temperature - Criatividade (0.3 recomendado para jurídico).
 * @param {object} piiMap - Objeto mapeando { "Valor Real": "[PLACEHOLDER]" }.
 */
export const generateLegalText = async (
  systemPrompt,
  userPrompt,
  temperature = 0.3,
  piiMap = {},
) => {
  // --- ETAPA 1: SANITIZAÇÃO (ANONIMIZAÇÃO) ---
  // Substitui dados reais por placeholders ANTES de sair do servidor

  let safeSystemPrompt = systemPrompt;
  let safeUserPrompt = userPrompt;

  // Ordena chaves por tamanho (decrescente) para evitar substituições parciais incorretas
  // Ex: Substituir "Maria da Silva" antes de substituir apenas "Maria"
  const piiKeys = Object.keys(piiMap).sort((a, b) => b.length - a.length);

  piiKeys.forEach((realValue) => {
    // Ignora valores vazios ou muito curtos para evitar falsos positivos
    if (!realValue || realValue.length < 3) return;

    const placeholder = piiMap[realValue];
    // Cria regex global e case-insensitive para substituir todas as ocorrências
    const regex = new RegExp(escapeRegExp(realValue), "gi");

    safeSystemPrompt = safeSystemPrompt.replace(regex, placeholder);
    safeUserPrompt = safeUserPrompt.replace(regex, placeholder);
  });

  // --- 🛡️ LOG DE AUDITORIA DE SEGURANÇA 🛡️ ---
  // Isso prova no terminal que os dados reais NÃO estão saindo
  console.log("\n🔒 [AUDITORIA LGPD] Payload Seguro Enviado para IA:");
  console.log("---------------------------------------------------");
  console.log("DADOS SENSÍVEIS DETECTADOS E MASCARADOS:", piiKeys.length);
  // console.log("SYS:", safeSystemPrompt.substring(0, 50) + "..."); // Opcional
  console.log(
    "USER PROMPT (TRECHO):",
    safeUserPrompt.substring(0, 300) + "...",
  );
  console.log("---------------------------------------------------\n");
  let generatedText = "";

  // --- ETAPA 2: CHAMADA À IA (Com texto anonimizado e timeout) ---

  // Função para criar uma Promise de timeout
  const createTimeoutPromise = (timeoutMs, errorMessage) => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);
    });
  };

  try {
    // TENTATIVA 1: Groq (Llama 3.3) - Prioridade: Velocidade
    try {
      const groqPromise = groqClient.chat.completions.create({
        messages: [
          { role: "system", content: safeSystemPrompt },
          { role: "user", content: safeUserPrompt },
        ],
        model: "llama-3.3-70b-versatile",
        temperature: temperature,
        max_tokens: 4096,
      });

      // Adiciona timeout à chamada Groq
      const groqWithTimeout = Promise.race([
        groqPromise,
        createTimeoutPromise(
          IA_TIMEOUT_MS,
          "Timeout: Chamada Groq excedeu o limite de tempo",
        ),
      ]);

      const completion = await groqWithTimeout;
      generatedText = completion.choices[0]?.message?.content || "";
    } catch (groqError) {
      console.warn(
        "⚠️ Groq instável ou Rate Limit. Ativando Fallback para Gemini...",
        groqError.message,
      );

      // TENTATIVA 2: Gemini 2.5 Flash (Fallback: Segurança)
      try {
        const model = geminiClient.getGenerativeModel({
          model: "gemini-2.5-flash",
        });

        // Gemini não usa roles separados, concatenamos
        const fullPrompt = `${safeSystemPrompt}\n\n--- INSTRUÇÃO DO USUÁRIO ---\n${safeUserPrompt}`;

        // Adiciona timeout à chamada Gemini
        const geminiCall = model.generateContent(fullPrompt);
        const geminiWithTimeout = Promise.race([
          geminiCall,
          createTimeoutPromise(
            IA_TIMEOUT_MS,
            "Timeout: Chamada Gemini excedeu o limite de tempo",
          ),
        ]);

        const result = await geminiWithTimeout;
        const response = await result.response;
        generatedText = response.text();
      } catch (geminiError) {
        console.error("❌ Erro na chamada Gemini:", geminiError.message);
        throw new Error(
          "Ambos os serviços de IA falharam ou excederam o tempo limite.",
        );
      }
    }
  } catch (error) {
    console.error("❌ Erro Crítico IA:", error.message);
    throw new Error(
      "Serviço de Inteligência Artificial indisponível no momento.",
    );
  }

  // --- ETAPA 3: DESANITIZAÇÃO (RESTAURAÇÃO) ---
  // Troca os placeholders de volta pelos dados reais no texto gerado pela IA

  piiKeys.forEach((realValue) => {
    const placeholder = piiMap[realValue];
    // Busca o placeholder (ex: [NOME_AUTOR]) e devolve o nome real
    const regex = new RegExp(escapeRegExp(placeholder), "gi");
    generatedText = generatedText.replace(regex, realValue);
  });

  return generatedText;
};
