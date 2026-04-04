import OpenAI from "openai";
import fs from "fs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Nova função de retentativa
const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      // Esta linha simula o comportamento da biblioteca da OpenAI
      // A biblioteca usa 'node-fetch' por baixo dos panos
      const response = await openai.audio.transcriptions.create(
        options.body,
        options
      );
      return response;
    } catch (error) {
      // Se for um erro de conexão e ainda tivermos tentativas...
      if (error instanceof OpenAI.APIConnectionError && i < retries - 1) {
        console.warn(
          `Tentativa ${i + 1} falhou. Tentando novamente em ${delay}ms...`
        );
        await new Promise((res) => setTimeout(res, delay));
      } else {
        // Se não for um erro de conexão ou as tentativas acabaram, joga o erro
        throw error;
      }
    }
  }
};

export const transcribeAudio = async (audioPath) => {
  try {
    console.log("Iniciando transcrição de áudio (com retentativas)...");

    const transcription = await fetchWithRetry(
      "https://api.openai.com/v1/audio/transcriptions", // A URL é gerenciada pela lib, mas a lógica é esta
      {
        body: {
          file: fs.createReadStream(audioPath),
          model: "whisper-1",
          language: "pt",
        },
      }
    );

    console.log("Transcrição concluída com sucesso.");
    return transcription.text;
  } catch (error) {
    console.error("Erro na transcrição (após todas as tentativas):", error);
    throw new Error("Falha ao transcrever áudio");
  }
};
