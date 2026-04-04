import Tesseract from "tesseract.js";

export const extractTextFromImage = async (imagePath) => {
  try {
    const inputLabel = Buffer.isBuffer(imagePath)
      ? "Buffer de memória"
      : imagePath;
    console.log(`Iniciando OCR (Tesseract) para: ${inputLabel}`);

    // Timeout de 60 segundos para evitar que o processo trave em imagens corrompidas ou muito pesadas
    const timeoutMs = 60000;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(new Error("Timeout: Tesseract excedeu o tempo limite de 60s")),
        timeoutMs,
      ),
    );

    const ocrPromise = Tesseract.recognize(imagePath, "por", {
      // Reduz o log para evitar spam no terminal, mostrando apenas a cada 20%
      logger: (m) => {
        if (
          m.status === "recognizing text" &&
          Math.round(m.progress * 100) % 20 === 0
        ) {
          console.log(
            `[Tesseract] ${m.status}: ${(m.progress * 100).toFixed(0)}%`,
          );
        }
      },
    });

    const {
      data: { text },
    } = await Promise.race([ocrPromise, timeoutPromise]);

    console.log("OCR concluído com sucesso.");
    return text;
  } catch (error) {
    console.error(`Erro no OCR (Tesseract): ${error.message}`);
    throw error; // Repassa o erro para o controller tratar (logar e continuar com o próximo arquivo)
  }
};
