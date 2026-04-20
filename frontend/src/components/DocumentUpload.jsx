import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  Trash2,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import imageCompression from "browser-image-compression";
import heic2any from "heic2any";
import { useToast } from "../contexts/ToastContext";
// --- CONFIGURAÇÃO DOS SLOTS (GAVETAS) ---
const SLOTS_CONFIG = {
  crianca: [
    {
      id: "rg_crianca_frente",
      label: "RG da Criança (Frente)",
      accept: "image/*",
      required: true,
      context: "crianca",
    },
    {
      id: "rg_crianca_verso",
      label: "RG da Criança (Verso)",
      accept: "image/*",
      required: true,
      context: "crianca",
    },
    {
      id: "certidao_nascimento",
      label: "Certidão de Nascimento",
      accept: "image/*,.pdf",
      required: true,
      context: "crianca",
    },
  ],
  responsavel: [
    {
      id: "rg_responsavel_frente",
      label: "RG/CNH Responsável (Frente)",
      accept: "image/*",
      required: true,
      context: "responsavel",
    },
    {
      id: "rg_responsavel_verso",
      label: "RG/CNH Responsável (Verso)",
      accept: "image/*",
      required: true,
      context: "responsavel",
    },
    {
      id: "comprovante_residencia",
      label: "Comprovante de Residência",
      accept: "image/*,.pdf",
      required: true,
      context: "responsavel",
    },
    {
      id: "comprovante_renda",
      label: "Comprovante de Renda",
      accept: "image/*,.pdf",
      required: true,
      context: "responsavel",
    },
  ],
};

// --- FUNÇÕES AUXILIARES ---
const sanitizeName = (text) => {
  if (!text) return "DESCONHECIDO";
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove caracteres especiais
    .trim()
    .replace(/\s+/g, "_") // Espaços -> Underline
    .toUpperCase();
};

export const DocumentUpload = ({
  nomes = { assistido: "", responsavel: "", crianca: "" },
  isRepresentacao = false,
  outrosFilhos = [],
  onFilesChange, // Callback (files[], namesMap{})
}) => {
  const { toast } = useToast();
  // Estado principal: Armazena os arquivos por Slot ID
  const [slotFiles, setSlotFiles] = useState({});
  // Estado para documentos extras (lista dinâmica)
  const [extraFiles, setExtraFiles] = useState([]);
  // Estado para URLs de preview (thumbnails)
  const [previewUrls, setPreviewUrls] = useState({});
  // Estados de controle
  const [processing, setProcessing] = useState(false);

  // Modal de nomeação para extras
  const [modalOpen, setModalOpen] = useState(false);
  const [tempExtraFile, setTempExtraFile] = useState(null);
  const [extraNameInput, setExtraNameInput] = useState("");

  // Refs para inputs de arquivo ocultos
  const fileInputRefs = useRef({});

  // --- CLEANUP NO UNMOUNT (OOM FIX) ---
  const previewsRef = useRef({});
  useEffect(() => { previewsRef.current = previewUrls; }, [previewUrls]);
  const extraFilesRef = useRef([]);
  useEffect(() => { extraFilesRef.current = extraFiles; }, [extraFiles]);

  useEffect(() => {
    return () => {
      Object.values(previewsRef.current).forEach(url => URL.revokeObjectURL(url));
      extraFilesRef.current.forEach(item => {
        if (item.file?.previewUrl) URL.revokeObjectURL(item.file.previewUrl);
      });
    };
  }, []);

  // Ref para garantir estabilidade do callback e evitar loops infinitos
  const onFilesChangeRef = useRef(onFilesChange);
  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  // Gera slots dinâmicos para outros filhos
  const extraSlots = outrosFilhos.flatMap((filho, index) => {
    const slotKey = filho.id || index; // Usa ID estável se disponível
    const safeName = filho.nome
      ? ` (${filho.nome.split(" ")[0]})`
      : ` (Filho ${index + 2})`;
    const contextName = filho.nome || `Filho ${index + 2}`;
    return [
      {
        id: `rg_filho_${slotKey}_frente`,
        label: `RG${safeName} (Frente)`,
        accept: "image/*",
        required: true,
        context: "extra_child",
        contextName,
      },
      {
        id: `rg_filho_${slotKey}_verso`,
        label: `RG${safeName} (Verso)`,
        accept: "image/*",
        required: true,
        context: "extra_child",
        contextName,
      },
      {
        id: `certidao_filho_${slotKey}`,
        label: `Certidão Nascimento${safeName}`,
        accept: "image/*,.pdf",
        required: true,
        context: "extra_child",
        contextName,
      },
    ];
  });

  // Limpeza de slots órfãos (ex: quando um filho é removido)
  const getAllSlots = useCallback(() => {
    return [
      ...(isRepresentacao ? SLOTS_CONFIG.crianca : []),
      ...SLOTS_CONFIG.responsavel,
      ...extraSlots,
    ];
  }, [isRepresentacao, extraSlots]);

  const getSlotLabel = useCallback((slotId) => {
    const slot = getAllSlots().find((s) => s.id === slotId);
    return slot ? slot.label : "Documento";
  }, [getAllSlots]);

  useEffect(() => {
    const currentSlots = getAllSlots();
    const currentSlotIds = new Set(currentSlots.map((s) => s.id));

    setSlotFiles((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (!currentSlotIds.has(key)) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    setPreviewUrls((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((key) => {
        if (!currentSlotIds.has(key)) {
          if (next[key]) URL.revokeObjectURL(next[key]);
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [getAllSlots]);

  // Notifica o componente pai sempre que houver mudanças
  useEffect(() => {
    if (onFilesChangeRef.current) {
      const allFiles = [];
      const namesMap = {};

      // 1. Processa Slots Fixos
      Object.entries(slotFiles).forEach(([slotId, file]) => {
        allFiles.push(file);
        namesMap[file.name] = getSlotLabel(slotId);
      });

      // 2. Processa Extras
      extraFiles.forEach((item) => {
        allFiles.push(item.file);
        namesMap[item.file.name] = item.customName;
      });

      onFilesChangeRef.current(allFiles, namesMap);
    }
  }, [slotFiles, extraFiles, getSlotLabel]);

  // --- LÓGICA DE PROCESSAMENTO DE IMAGEM ---
  const processFile = async (file, slotId = null, customName = null) => {
    setProcessing(true);

    try {
      // 1. Validação de Tamanho Mínimo (Filtro de "Lixo")

      let finalFile = file;
      let isImage =
        file.type.startsWith("image/") ||
        file.name.toLowerCase().endsWith(".heic");
      let wasHeicConverted = false;

      // 2. Conversão HEIC (iPhone)
      if (
        file.name.toLowerCase().endsWith(".heic") ||
        file.type === "image/heic"
      ) {
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.8,
        });
        const blob = Array.isArray(convertedBlob)
          ? convertedBlob[0]
          : convertedBlob;
        finalFile = new File([blob], file.name.replace(/\.heic$/i, ".jpg"), {
          type: "image/jpeg",
        });
        isImage = true;
        wasHeicConverted = true;
      }

      // 3. Compressão de Imagem (Client-Side)
      if (isImage) {
        // Redução mais agressiva no mobile para evitar OOM
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const maxSizeMB = isMobile ? 0.7 : 1;

        // Se já foi convertido de HEIC e o tamanho já está razoável (< máximo estimável), não reprime pra poupar memória
        if (!(wasHeicConverted && finalFile.size < maxSizeMB * 1024 * 1024)) {
          const options = {
            maxSizeMB: maxSizeMB,
            maxWidthOrHeight: isMobile ? 1280 : 1920,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: isMobile ? 0.7 : 0.8,
          };
          try {
            const compressedBlob = await imageCompression(finalFile, options);
            finalFile = new File([compressedBlob], finalFile.name, {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
          } catch (err) {
            console.warn("Falha na compressão, usando original:", err);
            // Fallback de compressão: evitar crash se o original for gigantesco
            if (finalFile.size > 5 * 1024 * 1024) {
              throw new Error("A imagem é muito pesada e ocorreu um erro ao otimizar. Tente enviar uma foto com tamanho menor.");
            }
          }
        }
      }

      // 4. Renomeação Automática
      let newFileName = "";
      const ext = finalFile.name.split(".").pop();

      if (slotId) {
        // Lógica para Slots Fixos
        const slotConfig = [
          ...SLOTS_CONFIG.crianca,
          ...SLOTS_CONFIG.responsavel,
          ...extraSlots,
        ].find((s) => s.id === slotId);

        let contextName = "";
        if (slotConfig?.contextName) {
          contextName = slotConfig.contextName;
        } else {
          contextName =
            slotConfig?.context === "crianca"
              ? nomes.crianca || nomes.assistido
              : nomes.responsavel || nomes.assistido;
        }

        const prefix = slotId.toUpperCase();
        const personName = sanitizeName(contextName);
        newFileName = `${prefix}_${personName}.${ext}`;
      } else {
        // Lógica para Extras
        const safeCustomName = sanitizeName(customName);
        // Adiciona contador se já existir
        let counter = 1;
        let baseName = `${safeCustomName}.${ext}`;
        while (
          Object.values(slotFiles).some((f) => f.name === baseName) ||
          extraFiles.some((f) => f.file.name === baseName)
        ) {
          counter++;
          baseName = `${safeCustomName}_${counter}.${ext}`;
        }
        newFileName = baseName;
      }

      // Recria o arquivo com o novo nome
      const renamedFile = new File([finalFile], newFileName, {
        type: finalFile.type,
      });

      // 5. Gera Thumbnail (apenas para imagens)
      if (isImage) {
        const url = URL.createObjectURL(renamedFile);
        if (slotId) {
          setPreviewUrls((prev) => {
            if (prev[slotId]) URL.revokeObjectURL(prev[slotId]);
            return { ...prev, [slotId]: url };
          });
        } else {
          // Para extras, guardamos a URL no objeto do arquivo
          renamedFile.previewUrl = url;
        }
      }

      return renamedFile;
    } catch (err) {
      toast.error(err.message);
      return null;
    } finally {
      setProcessing(false);
    }
  };

  // --- HANDLERS ---

  const handleSlotChange = async (e, slotId) => {
    const file = e.target.files[0];
    if (!file) return;

    const processed = await processFile(file, slotId);
    if (processed) {
      setSlotFiles((prev) => ({ ...prev, [slotId]: processed }));
    }
    // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
    e.target.value = "";
  };

  const handleRemoveSlot = (slotId) => {
    setSlotFiles((prev) => {
      const newFiles = { ...prev };
      delete newFiles[slotId];
      return newFiles;
    });
    if (previewUrls[slotId]) {
      URL.revokeObjectURL(previewUrls[slotId]);
      setPreviewUrls((prev) => {
        const newUrls = { ...prev };
        delete newUrls[slotId];
        return newUrls;
      });
    }
  };

  const handleExtraSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setTempExtraFile(file);
    setExtraNameInput("");
    setModalOpen(true);
    e.target.value = "";
  };

  const confirmExtraUpload = async () => {
    if (!extraNameInput.trim()) {
      toast.warning("Por favor, dê um nome ao documento.");
      return;
    }
    const processed = await processFile(tempExtraFile, null, extraNameInput);
    if (processed) {
      setExtraFiles((prev) => [
        ...prev,
        { file: processed, customName: extraNameInput },
      ]);
      setModalOpen(false);
      setTempExtraFile(null);
    }
  };
  const removeExtra = (index) => {
    const fileToRemove = extraFiles[index].file;
    if (fileToRemove.previewUrl) URL.revokeObjectURL(fileToRemove.previewUrl);
    setExtraFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // --- RENDERIZADORES ---

  const renderSlot = (slot) => {
    const file = slotFiles[slot.id];
    const preview = previewUrls[slot.id];
    const isPDF = file?.type === "application/pdf";

    return (
      <div key={slot.id} className="relative">
        <input
          type="file"
          id={slot.id}
          accept={slot.accept}
          className="hidden"
          ref={(el) => (fileInputRefs.current[slot.id] = el)}
          onChange={(e) => handleSlotChange(e, slot.id)}
        />

        {!file ? (
          // ESTADO VAZIO
          <>
            <button
              type="button"
              onClick={() => {
                fileInputRefs.current[slot.id].click();
              }}
              className={`w-full h-32 p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer appearance-none bg-app/30 outline-none
              ${slot.required ? "border-soft hover:border-primary hover:bg-primary/5" : "border-soft hover:border-primary/50"}
            `}
            >
              <div className="bg-app p-2 rounded-full mb-2 text-muted">
                {slot.accept.includes("pdf") ? (
                  <FileText size={20} />
                ) : (
                  <Camera size={20} />
                )}
              </div>
              <p className="text-sm font-medium text-slate-700 leading-tight">
                <span className="text-main">{slot.label}</span>
              </p>
              {slot.required && (
                <span className="text-[10px] text-error font-bold mt-1">
                  OBRIGATÓRIO
                </span>
              )}
            </button>

          </>
        ) : (
          // ESTADO PREENCHIDO
          <div className="relative border border-success/30 bg-success/10 rounded-xl p-2 flex items-center gap-3 h-32 overflow-hidden">
            {/* Thumbnail ou Ícone */}
            <div className="shrink-0 w-20 h-20 bg-surface rounded-lg border border-success/20 flex items-center justify-center overflow-hidden">
              {isPDF ? (
                <FileText size={32} className="text-error" />
              ) : (
                preview && (
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-full h-full object-cover cursor-zoom-in"
                    onClick={() => window.open(preview, "_blank")}
                  />
                )
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-bold text-success uppercase truncate"
                title={file.name}
              >
                {slot.label}
              </p>
              <p className="text-[10px] text-success/80 truncate mt-1">
                {file.name}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="badge bg-success/20 text-success text-[10px] px-1.5 py-0.5 rounded border-success/20">
                  Pronto
                </span>
                <span className="text-[10px] text-muted">
                  {(file.size / 1024).toFixed(0)}KB
                </span>
              </div>
            </div>

            {/* Botão Remover */}
            <button
              type="button"
              onClick={() => handleRemoveSlot(slot.id)}
              className="absolute top-2 right-2 p-1.5 bg-surface rounded-full shadow-sm text-error hover:bg-error/10 transition-colors"
              title="Remover arquivo"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. GUIA VISUAL (EDUCATIVO) REMOVIDO 
      <div className="bg-app border border-soft rounded-xl p-4">
        <h3 className="text-sm font-bold text-main mb-3 flex items-center gap-2">
          <Camera size={18} />
          Como tirar uma boa foto?
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border-l-4 border-success p-3 rounded shadow-sm">
            <div className="flex items-center gap-2 text-success font-bold text-xs mb-2">
              <CheckCircle2 size={16} />
              <span className="uppercase">Certo</span>
            </div>
            <div className="h-24 bg-app rounded flex items-center justify-center mb-2 relative overflow-hidden">
              <img
                src="/guia/certo.png"
                alt="Exemplo correto"
                className="h-full object-contain"
              />
            </div>
            <p className="text-[10px] text-muted leading-tight">
              Coloque sobre uma mesa, em local iluminado. O texto deve estar
              legível.
            </p>
          </div>

          <div className="bg-surface border-l-4 border-error p-3 rounded shadow-sm">
            <div className="flex items-center gap-2 text-error font-bold text-xs mb-2">
              <X size={16} />
              <span className="uppercase">Errado</span>
            </div>
            <div className="h-24 bg-app rounded flex items-center justify-center mb-2 relative overflow-hidden">
              <img
                src="/guia/errado.png"
                alt="Exemplo errado"
                className="h-full object-contain"
              />
            </div>
            <p className="text-[10px] text-muted leading-tight">
              Não segure na mão, evite lugares escuros ou fotos tremidas.
            </p>
          </div>
        </div>
      </div>
      */}

      {/* MENSAGEM DE PROCESSAMENTO */}
      {processing && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
          <Loader2 size={48} className="text-primary animate-spin mb-4" />
          <p className="text-primary font-bold animate-pulse">
            Otimizando imagem...
          </p>
          <p className="text-xs text-muted">
            Isso garante que o envio será rápido.
          </p>
        </div>
      )}

      {/* 2. SLOTS (GAVETAS) */}
      <div className="space-y-6">
        {/* Grupo A: Criança (Apenas se for representação) */}
        {isRepresentacao && (
          <div>
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 border-b border-primary/20 pb-1">
              Documentos da Criança
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SLOTS_CONFIG.crianca.map(renderSlot)}
            </div>
          </div>
        )}

        {/* Grupo B: Responsável / Titular */}
        <div>
          <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 border-b border-primary/20 pb-1">
            {isRepresentacao ? "Documentos do Responsável" : "Seus Documentos"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SLOTS_CONFIG.responsavel.map(renderSlot)}
          </div>
        </div>

        {/* Grupo C: Outros Filhos */}
        {isRepresentacao && extraSlots.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 border-b border-primary/20 pb-1">
              Documentos dos Outros Filhos
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {extraSlots.map(renderSlot)}
            </div>
          </div>
        )}
      </div>

      {/* 3. OUTROS DOCUMENTOS */}
      <div className="pt-4 border-t border-soft">
        <h4 className="text-sm font-bold text-muted mb-3">
          Outros Documentos (Opcional)
        </h4>

        <input
          type="file"
          id="extra-upload"
          className="hidden"
          onChange={handleExtraSelect}
          accept="image/*,.pdf"
        />

        <button
          type="button"
          onClick={() => document.getElementById("extra-upload").click()}
          className="btn btn-secondary w-full border-dashed border-2 flex items-center justify-center gap-2 py-3"
        >
          <Plus size={20} />
          ADICIONAR DOCUMENTO EXTRA
        </button>

        {/* Lista de Extras */}
        {extraFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            {extraFiles.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-app p-3 rounded-lg border border-soft"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  {item.file.type.includes("image") && item.file.previewUrl ? (
                    <img
                      src={item.file.previewUrl}
                      alt=""
                      className="w-10 h-10 object-cover rounded border border-soft"
                    />
                  ) : (
                    <FileText size={24} className="text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-main truncate">
                      {item.customName}
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      {item.file.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeExtra(idx)}
                  className="text-error hover:text-error/80 p-2"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE NOMEAÇÃO */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-main mb-2">
              Nomear Documento
            </h3>
            <p className="text-sm text-muted mb-4">
              O que é este documento que você está enviando?
            </p>

            <input
              type="text"
              autoFocus
              placeholder="Ex: Receita Médica, Boletim Escolar..."
              className="input w-full mb-4"
              value={extraNameInput}
              onChange={(e) => setExtraNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmExtraUpload()}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalOpen(false);
                  setTempExtraFile(null);
                }}
                className="btn btn-ghost flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmExtraUpload}
                className="btn btn-primary flex-1"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
