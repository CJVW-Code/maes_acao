import Tesseract from "tesseract.js";

export const extractTextFromImage = async (imagePath) => {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, "por", {
      logger: (m) => console.log(m),
    });
    return text;
  } catch (error) {
    console.error("Erro no OCR:", error);
    throw new Error("Falha ao extrair texto do documento");
  }
};
