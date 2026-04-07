import React, { useState } from "react";
import { Eye } from "lucide-react";

const formatValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "Nao informado";
  }
  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "Nao informado";
    return value.join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "Nao informado";
    return entries
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${formatValue(v)}`)
      .join(" • ");
  }
  return String(value);
};

const formatDateDisplay = (dateString) => {
  if (!dateString) return "Nao informado";
  if (dateString.includes("/")) return dateString;
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

const pickFirst = (...values) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== "");

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
  const isExecucao =
    (caso.tipo_acao || "").toLowerCase().includes("execu") ||
    (dados.acaoEspecifica || "").toLowerCase().includes("execucao");

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
        {renderDataField("Telefone principal", caso.telefone_assistido || dados.telefone)}
        {renderDataField("Tipo de acao", caso.tipo_acao?.replace("_", " "))}
      </div>

      <div className="pt-4">
        <button
          onClick={() => setShowReview(!showReview)}
          className="btn btn-secondary w-full justify-start"
        >
          <Eye size={18} />
          {showReview ? "Ocultar dados preenchidos" : "Revisar dados preenchidos"}
        </button>

        {showReview && (
          <div className="mt-4 space-y-6 border-t border-soft pt-6 animate-fade-in">
            <div className="space-y-4">
              <h3 className="heading-3 text-primary">
                {isRepresentacao
                  ? "Dados do Assistido (Crianca/Adolescente)"
                  : "Dados do Autor da Acao"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome completo", pickFirst(dados.nome, caso.nome_assistido))}
                {renderDataField("CPF", pickFirst(dados.cpf, caso.cpf_assistido))}
                {renderDataField("Data de nascimento", formatDateDisplay(pickFirst(dados.data_nascimento_assistido, dados.assistido_data_nascimento)))}
                {renderDataField("Nacionalidade", dados.assistido_nacionalidade)}
                {renderDataField("Estado civil", dados.assistido_estado_civil)}
                {renderDataField("Profissao", dados.assistido_ocupacao)}
                {renderDataField("Endereco residencial", dados.endereco_assistido)}
                {renderDataField("Endereco profissional", dados.assistido_endereco_profissional)}
                {renderDataField("Email", dados.email_assistido)}
                {renderDataField("Telefone", dados.telefone)}
                {renderDataField("RG", `${dados.assistido_rg_numero || ""} ${dados.assistido_rg_orgao || ""}`.trim())}
              </div>
            </div>

            {outrosFilhos.length > 0 &&
              outrosFilhos.map((filho, index) => (
                <div key={index} className="space-y-4 pt-4 border-t border-soft">
                  <h3 className="heading-3 text-primary">
                    Dados do Assistido {index + 2} (Crianca/Adolescente)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {renderDataField("Nome completo", filho.nome)}
                    {renderDataField("CPF", filho.cpf)}
                    {renderDataField("Data de nascimento", formatDateDisplay(filho.dataNascimento))}
                    {renderDataField("Nacionalidade", filho.nacionalidade)}
                    {renderDataField("RG", `${filho.rgNumero || ""} ${filho.rgOrgao || ""}`.trim())}
                  </div>
                </div>
              ))}

            {isRepresentacao && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">Dados do Representante Legal</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Nome completo", dados.representante_nome)}
                  {renderDataField("CPF", dados.representante_cpf)}
                  {renderDataField("Data de nascimento", formatDateDisplay(dados.representante_data_nascimento))}
                  {renderDataField("Nacionalidade", dados.representante_nacionalidade)}
                  {renderDataField("Estado civil", dados.representante_estado_civil)}
                  {renderDataField("Profissao", dados.representante_ocupacao)}
                  {renderDataField("Endereco residencial", dados.representante_endereco_residencial)}
                  {renderDataField("Endereco profissional", dados.representante_endereco_profissional)}
                  {renderDataField("Email", dados.representante_email)}
                  {renderDataField("Telefone", dados.representante_telefone)}
                  {renderDataField("RG", `${dados.representante_rg_numero || ""} ${dados.representante_rg_orgao || ""}`.trim())}
                  {renderDataField("Nome da mae", dados.representante_nome_mae)}
                  {renderDataField("Nome do pai", dados.representante_nome_pai)}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">Dados da Parte Contraria (Requerido)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome completo", dados.nome_requerido)}
                {renderDataField("CPF", dados.cpf_requerido)}
                {renderDataField("Endereco conhecido", dados.endereco_requerido)}
                {renderDataField("Telefone", pickFirst(dados.telefone_requerido, dados.requerido_telefone))}
                {renderDataField("Email", pickFirst(dados.email_requerido, dados.requerido_email))}
                {renderDataField("Profissao", dados.requerido_ocupacao)}
                {renderDataField("Endereco de trabalho", dados.requerido_endereco_profissional)}
                {renderDataField("RG", `${dados.requerido_rg_numero || ""} ${dados.requerido_rg_orgao || ""}`.trim())}
                {renderDataField("Mae do requerido", dados.requerido_nome_mae)}
                {renderDataField("Pai do requerido", dados.requerido_nome_pai)}
                {renderDataField("Dados adicionais", pickFirst(dados.requerido_outros_detalhes, dados.dados_adicionais_requerido))}
              </div>
            </div>

            {isExecucao && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">Dados da Execucao e Titulo Judicial</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Vara da Peticao Atual", dados.vara)}
                  {renderDataField("Percentual do salario minimo (%)", pickFirst(dados.percentual_salario_minimo, dados.percentualSalarioMinimo))}
                  {renderDataField("Ou Valor Mensal Fixo (R$)", pickFirst(dados.valor_mensal_fixado, dados.valorMensalFixado))}
                  {renderDataField("Numero do Processo Originario", pickFirst(dados.numero_processo_originario, dados.numeroProcessoOriginario))}
                  {renderDataField("Cidade onde tramitou", pickFirst(dados.cidade_originaria, dados.cidadeOriginaria))}
                  {renderDataField("Vara onde tramitou", pickFirst(dados.vara_originaria, dados.varaOriginaria))}
                  {renderDataField("Tipo de Decisao", pickFirst(dados.tipo_decisao, dados.tipoDecisao))}
                  {renderDataField("Dia de Pagamento fixado", pickFirst(dados.dia_pagamento_fixado, dados.diaPagamentoFixado))}
                  {renderDataField("Inicio do Debito (Mes/Ano)", pickFirst(dados.data_inicio_debito, dados.dataInicioDebito))}
                  {renderDataField("Fim do Debito (Mes/Ano)", pickFirst(dados.data_fim_debito, dados.dataFimDebito))}
                  {renderDataField("Periodo do Debito", pickFirst(dados.periodo_debito, dados.periodo_debito_execucao))}
                  {renderDataField("Valor Total do Debito", pickFirst(dados.valor_total_debito_execucao, dados.valorTotalDebitoExecucao, dados.valor_divida))}
                  {renderDataField("Multa (10%)", dados.valor_multa)}
                  {renderDataField("Juros", dados.valor_juros)}
                  {renderDataField("Honorarios", dados.valor_honorarios)}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">
                {isExecucao ? "Outros Detalhes" : "Detalhes do Pedido e do Caso"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {!isExecucao &&
                  renderDataField(
                    "Valor da Pensao Solicitado",
                    pickFirst(dados.valor_pensao, dados.valor_mensal_pensao),
                  )}
                {renderDataField("Dados Bancarios para Deposito", dados.dados_bancarios_deposito)}
                {renderDataField("Cidade para assinatura", pickFirst(dados.cidade_assinatura, dados.cidadeAssinatura))}
                {renderDataField("Descricao da Guarda", dados.descricao_guarda)}
                {renderDataField("Situacao Financeira de quem cuida", dados.situacao_financeira_genitora)}
                {renderDataField("Requerido tem emprego formal?", dados.requerido_tem_emprego_formal)}
                {renderDataField("Nome da Empresa", dados.empregador_requerido_nome)}
                {renderDataField("Endereco da Empresa", dados.empregador_requerido_endereco)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
