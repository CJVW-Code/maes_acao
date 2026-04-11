import express from "express";
import {
  criarNovoCaso,
  listarCasos,
  resumoCasos,
  obterDetalhesCaso,
  finalizarCasoSolar,
  reverterFinalizacao,
  regenerarDosFatos,
  buscarPorCpf,
  resetarChaveAcesso,
  atualizarStatusCaso,
  deletarCaso,
  agendarReuniao,
  gerarTermoDeclaracao,
  regerarMinuta,
  receberDocumentosComplementares,
  reprocessarCaso,
  renomearDocumento,
  solicitarReagendamento,
  alternarArquivamento,
  salvarFeedback,
  salvarDadosJuridicos,
  listarNotificacoes,
  marcarNotificacaoLida,
  solicitarAssistencia,
  responderAssistencia,
} from "../controllers/casosController.js";
import { lockCaso, unlockCaso } from "../controllers/lockController.js";
import { obterHistoricoCaso } from "../controllers/consultaAuditoria.js";
import { authMiddleware } from "../middleware/auth.js";
import { auditMiddleware } from "../middleware/auditMiddleware.js";
import { upload } from "../middleware/upload.js"; 
import { requireWriteAccess } from "../middleware/requireWriteAcess.js";

const router = express.Router();

// Configuração para upload de múltiplos arquivos (Criação)
const uploadCriacao = upload.fields([
  { name: "audio", maxCount: 1 },
  { name: "documentos", maxCount: 20 },
]);

// Rotas Públicas
router.post("/novo", uploadCriacao, criarNovoCaso);
router.get("/buscar-cpf", buscarPorCpf);
router.post(
  "/:id/upload-complementar",
  upload.fields([{ name: "documentos" }]),
  receberDocumentosComplementares,
);
router.post("/:id/reagendar", solicitarReagendamento);

// FILTRO DE SEGURANÇA E AUDITORIA 
router.use(authMiddleware);
router.use(auditMiddleware);

// Rotas Protegidas
router.get("/", listarCasos);
router.get("/resumo", resumoCasos);
router.get("/notificacoes", listarNotificacoes);
router.patch("/notificacoes/:id/lida", marcarNotificacaoLida);

router.get("/:id", obterDetalhesCaso);
router.use(requireWriteAccess);
router.post("/:id/gerar-fatos", regenerarDosFatos);
router.post("/:id/gerar-termo", gerarTermoDeclaracao);
router.post("/:id/finalizar", upload.single("capa"), finalizarCasoSolar);
router.post("/:id/reverter-finalizacao", reverterFinalizacao);
router.post("/:id/resetar-chave", resetarChaveAcesso);
router.patch("/:id/status", atualizarStatusCaso);
router.delete("/:id", deletarCaso);
router.patch("/:id/feedback", salvarFeedback);
router.patch("/:id/agendar", agendarReuniao);
router.post("/:id/regerar-minuta", regerarMinuta);
router.post("/:id/reprocessar", reprocessarCaso);
router.patch("/:id/documento/renomear", renomearDocumento);
router.patch("/:id/arquivar", alternarArquivamento);
router.patch("/:id/juridico", salvarDadosJuridicos);
router.post("/:id/solicitar-assistencia", solicitarAssistencia);
router.post("/assistencia/:assistencia_id/responder", responderAssistencia);
router.get("/:id/historico", obterHistoricoCaso);

// Rotas de Locking
router.patch("/:id/lock", lockCaso);
router.patch("/:id/unlock", unlockCaso);

export default router;
