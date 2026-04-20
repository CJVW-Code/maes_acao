import React from "react";
import { useConfirm } from "../../../contexts/ConfirmContext";
import { AlertCircle, FileText } from "lucide-react";
import { DocumentUpload } from "../../../components/DocumentUpload";
export const StepRelatoDocs = React.memo(({
  relato,
  prefersAudio,
  enviarDocumentosDepois,
  outrosFilhos,
  representanteNome,
  handleFieldChange,
  formErrors,
  isRepresentacao,
  handleFilesChange,
  configAcao,
}) => {
  const { confirm } = useConfirm();

  return (
    <section className="form-section">
      <div className="flex items-center gap-3 border-b border-soft pb-4">
        <FileText className="text-primary" size={24} />
        <h2 className="heading-2">5. Conte sua História e Anexe Provas</h2>
      </div>

      {!configAcao?.ocultarRelato && (
        <div>
          <div className="flex justify-between items-end mb-2">
            <label htmlFor="relato" className="label font-bold mb-0">
              Relato dos Fatos (O que aconteceu?)
            </label>
          </div>
          <textarea
            id="relato"
            placeholder={
              prefersAudio
                ? "Se desejar, faça um breve resumo aqui (opcional)..."
                : "Conte detalhadamente o que aconteceu, por que você precisa da justiça, como está a situação atual..."
            }
            value={relato}
            onChange={handleFieldChange}
            name="relato"
            rows="10"
            className={`input w-full ${formErrors.relato ? "border-error ring-1 ring-error" : ""}`}
          ></textarea>

          {/* Barra de Progresso */}
          {!prefersAudio && (
            <div className="w-full h-2 bg-app rounded-full mt-2 overflow-hidden border border-soft">
              <div
                className={`h-full transition-all duration-500 ${
                  (formState.relato || "").length >= 250
                    ? "bg-success"
                    : "bg-error"
                }`}
                style={{
                  width: `${Math.min(((relato || "").length / 250) * 100, 100)}%`,
                }}
              />
            </div>
          )}

          <div className="flex justify-between mt-1 px-1">
            <span className="text-xs text-error font-medium">
              {formErrors.relato}
            </span>
            {!prefersAudio && (
              <span
                className={`text-xs font-medium ${(formState.relato || "").length < 250 ? "text-error" : "text-success"}`}
              >
                {(relato || "").length} / 250 caracteres
              </span>
            )}
          </div>
        </div>
      )}

      {/* OPÇÃO DE ENVIAR DEPOIS */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="w-5 h-5 accent-amber-600"
            checked={enviarDocumentosDepois}
            onChange={async (e) => {
              const checked = e.target.checked;
              if (checked) {
                const ok = await confirm(
                  "Ao marcar esta opção, você poderá enviar o formulário sem os documentos agora. No entanto, o seu atendimento SÓ SERÁ INICIADO após o envio dos documentos via WhatsApp ou presencialmente. Deseja continuar?",
                  "Atenção: Envio posterior de documentos",
                );
                if (ok) {
                  handleFieldChange({
                    target: { name: "enviarDocumentosDepois", value: true },
                  });
                }
              } else {
                handleFieldChange({
                  target: { name: "enviarDocumentosDepois", value: false },
                });
              }
            }}
          />
          <div>
            <span className="font-bold text-amber-900 block">
              Enviar documentos depois
            </span>
            <span className="text-xs text-amber-700">
              Entendo que meu caso só será processado após a entrega dos
              documentos.
            </span>
          </div>
        </label>
      </div>

      {/* COMPONENTE DE UPLOAD DE DOCUMENTOS */}
      {!enviarDocumentosDepois && (
        <div
          id="documents-upload-section"
          className={`${formErrors.documentos ? "border border-error rounded-xl p-1" : ""}`}
        >
          <DocumentUpload
            isRepresentacao={isRepresentacao}
            outrosFilhos={outrosFilhos}
            nomes={{
              assistido: representanteNome,
              responsavel: representanteNome,
              crianca: isRepresentacao ? representanteNome : null,
            }}
            onFilesChange={handleFilesChange}
          />
        </div>
      )}

      {enviarDocumentosDepois && (
        <div className="bg-surface p-6 rounded-xl border-2 border-dashed border-soft text-center space-y-2">
          <AlertCircle className="mx-auto text-muted" size={40} />
          <p className="text-sm text-muted font-medium">
            Você optou por enviar os documentos depois. <br />
            Prossiga com o envio do caso abaixo.
          </p>
          <button
            type="button"
            onClick={() =>
              handleFieldChange({
                target: { name: "enviarDocumentosDepois", value: false },
              })
            }
            className="text-xs text-primary font-bold hover:underline"
          >
            Quero anexar os documentos agora
          </button>
        </div>
      )}
      {formErrors.documentos && (
        <p className="text-sm text-red-500 font-bold text-center">
          {formErrors.documentos}
        </p>
      )}
    </section>
  );
});
