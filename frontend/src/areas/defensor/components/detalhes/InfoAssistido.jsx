import React, { useState } from "react";
import { Eye } from "lucide-react";

// Funções de formatação (Tiradas do DetalhesCaso.jsx)
const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Não informado";
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "Não informado";
    return value.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "Não informado";
    return entries
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${formatValue(v)}`)
      .join(" • ");
  }
  return String(value);
};

const formatDateDisplay = (dateString) => {
  if (!dateString) return "Não informado";
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

export const InfoAssistido = ({ caso }) => {
  const [showReview, setShowReview] = useState(false);

  const renderDataField = (label, value) => (
    <div>
      <p className="text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="font-semibold break-words">{formatValue(value)}</p>
    </div>
  );

  const dados = caso.dados_formulario || {};
  const isRepresentacao = dados.assistido_eh_incapaz === "sim";
  const isFixacaoAlimentos = (caso.tipo_acao || "")
    .toLowerCase()
    .includes("fixação de pensão alimentícia");

  let outrosFilhos = [];
  try {
    if (dados.outros_filhos_detalhes) {
      outrosFilhos =
        typeof dados.outros_filhos_detalhes === "string"
          ? JSON.parse(dados.outros_filhos_detalhes)
          : dados.outros_filhos_detalhes;
    }
  } catch (e) {
    console.error("Erro ao processar dados de outros filhos:", e);
  }

  return (
    <div className="card space-y-4">
      <h2 className="heading-2">Dados do assistido</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {renderDataField("Nome completo", caso.nome_assistido)}
        {renderDataField("CPF", caso.cpf_assistido)}
        {renderDataField("Nome representante legal", dados.representante_nome)}
        {renderDataField("CPF representante legal", dados.representante_cpf)}
        {renderDataField("Whatsapp para contato", caso.whatsapp_contato)}
        {renderDataField("Tipo de ação", caso.tipo_acao?.replace("_", " "))}
      </div>

      <div className="pt-4">
        <button
          onClick={() => setShowReview(!showReview)}
          className="btn btn-secondary w-full justify-start"
        >
          <Eye size={18} />
          {showReview
            ? "Ocultar dados preenchidos"
            : "Revisar dados preenchidos"}
        </button>

        {showReview && (
          <div className="mt-4 space-y-6 border-t border-soft pt-6 animate-fade-in">
            {/* Seção do Beneficiário */}
            <div className="space-y-4">
              <h3 className="heading-3 text-primary">
                {isRepresentacao
                  ? "Dados do Assistido (Criança/Adolescente)"
                  : "Dados do Autor da Ação"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome Completo", dados.nome)}
                {renderDataField("CPF", dados.cpf)}
                {renderDataField(
                  "Data de Nascimento",
                  formatDateDisplay(dados.assistido_data_nascimento),
                )}
                {!isFixacaoAlimentos &&
                  renderDataField(
                    "Nacionalidade",
                    dados.assistido_nacionalidade,
                  )}
                {renderDataField("Estado Civil", dados.assistido_estado_civil)}
                {!isFixacaoAlimentos &&
                  renderDataField(
                    "Endereço Residencial",
                    dados.endereco_assistido,
                  )}
                {!isFixacaoAlimentos &&
                  renderDataField("Email", dados.email_assistido)}
                {renderDataField("Telefone de Contato", dados.telefone)}
                {renderDataField(
                  "WhatsApp para Reunião",
                  dados.whatsapp_contato,
                )}
                {renderDataField(
                  "RG",
                  `${dados.assistido_rg_numero || ""} ${dados.assistido_rg_orgao || ""}`.trim(),
                )}
              </div>
            </div>

            {/* Seção de Filhos Adicionais */}
            {outrosFilhos.length > 0 &&
              outrosFilhos.map((filho, index) => (
                <div
                  key={index}
                  className="space-y-4 pt-4 border-t border-soft"
                >
                  <h3 className="heading-3 text-primary">
                    Dados do Assistido {index + 2} (Criança/Adolescente)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {renderDataField("Nome Completo", filho.nome)}
                    {renderDataField("CPF", filho.cpf)}
                    {renderDataField(
                      "Data de Nascimento",
                      filho.dataNascimento,
                    )}
                    {renderDataField("Nacionalidade", filho.nacionalidade)}
                    {renderDataField(
                      "RG",
                      `${filho.rgNumero || ""} ${filho.rgOrgao || ""}`.trim(),
                    )}
                  </div>
                </div>
              ))}

            {/* Seção do Representante */}
            {isRepresentacao && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">
                  Dados do Representante Legal
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Nome Completo", dados.representante_nome)}
                  {renderDataField("CPF", dados.representante_cpf)}
                  {renderDataField(
                    "Nacionalidade",
                    dados.representante_nacionalidade,
                  )}
                  {renderDataField(
                    "Estado Civil",
                    dados.representante_estado_civil,
                  )}
                  {renderDataField("Profissão", dados.representante_ocupacao)}
                  {renderDataField(
                    "Endereço Residencial",
                    dados.representante_endereco_residencial,
                  )}
                  {renderDataField(
                    "Endereço Profissional",
                    dados.representante_endereco_profissional,
                  )}
                  {renderDataField("Email", dados.representante_email)}
                  {renderDataField("Telefone", dados.representante_telefone)}
                  {renderDataField(
                    "RG",
                    `${dados.representante_rg_numero || ""} ${dados.representante_rg_orgao || ""}`.trim(),
                  )}
                </div>
              </div>
            )}

            {/* Seção do Requerido */}
            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">
                Dados da Parte Contrária (Requerido)
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome Completo", dados.nome_requerido)}
                {renderDataField("CPF", dados.cpf_requerido)}
                {renderDataField(
                  "Endereço conhecido",
                  dados.endereco_requerido,
                )}
                {renderDataField("Telefone", dados.requerido_telefone)}
                {renderDataField("Email", dados.requerido_email)}
                {renderDataField("Profissão", dados.requerido_ocupacao)}
                {renderDataField(
                  "Endereço de Trabalho",
                  dados.requerido_endereco_profissional,
                )}
                {renderDataField(
                  "Dados Adicionais",
                  dados.dados_adicionais_requerido,
                )}
              </div>
            </div>

            {/* Seção de Detalhes do Caso */}
            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">
                Detalhes do Pedido e do Caso
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField(
                  "Valor da Pensão Solicitado",
                  dados.valor_mensal_pensao,
                )}
                {renderDataField(
                  "Dados Bancários para Depósito",
                  dados.dados_bancarios_deposito,
                )}
                {renderDataField("Descrição da Guarda", dados.descricao_guarda)}
                {renderDataField(
                  "Situação Financeira de quem cuida",
                  dados.situacao_financeira_genitora,
                )}
                {renderDataField(
                  "Requerido tem emprego formal?",
                  dados.requerido_tem_emprego_formal,
                )}
                {renderDataField(
                  "Nome da Empresa",
                  dados.empregador_requerido_nome,
                )}
                {renderDataField(
                  "Endereço da Empresa",
                  dados.empregador_requerido_endereco,
                )}
                {dados.numero_processo_originario &&
                  renderDataField(
                    "Processo Original",
                    dados.numero_processo_originario,
                  )}
                {dados.periodo_debito_execucao &&
                  renderDataField(
                    "Período do Débito",
                    dados.periodo_debito_execucao,
                  )}
                {dados.valor_total_debito_execucao &&
                  renderDataField(
                    "Valor Total do Débito",
                    dados.valor_total_debito_execucao,
                  )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
