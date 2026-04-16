import React, { useState } from "react";
import { Eye } from "lucide-react";
import { formatTipoAcaoLabel } from "../../../../utils/caseUtils";

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
      .join(" | ");
  }
  return String(value);
};

const formatDateDisplay = (dateString) => {
  if (!dateString) return "Não informado";
  if (dateString.includes("/")) return dateString;
  const [year, month, day] = dateString.split("-");
  if (!year || !month || !day) return dateString;
  return `${day}/${month}/${year}`;
};

const formatVara = (val) => {
  let v = String(val || "").trim().toUpperCase();
  if (!v || v === "______" || v === "NÃO INFORMADO") return v;
  // Se começar com número e não tiver o símbolo ordinal (ª ou º), adiciona ª
  if (/^\d+/.test(v) && !/^\d+[ªº]/.test(v)) {
    v = v.replace(/^(\d+)/, "$1ª");
  }
  return v;
};

// Busca o primeiro valor não vazio dentre os argumentos
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
  const isRepresentacao = caso.assistido_eh_incapaz === "sim" || dados.assistido_eh_incapaz === "sim";
  const isExecucao =
    (caso.tipo_acao || "").toLowerCase().includes("execu") ||
    (dados.acaoEspecifica || "").toLowerCase().includes("execucao") ||
    !!caso.processoOrigemNumero || !!dados.processoOrigemNumero;

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

  // Campos do assistido principal usando as novas tags
  const nomePrincipal = isRepresentacao 
    ? pickFirst(dados.NOME, caso.nome_assistido)
    : pickFirst(dados.REPRESENTANTE_NOME, caso.nome_representante, caso.nome_assistido);
    
  const cpfPrincipal = isRepresentacao 
    ? pickFirst(dados.cpf, dados.cpf_assistido, caso.cpf_assistido)
    : pickFirst(dados.representante_cpf, caso.cpf_assistido, dados.cpf);
  const telefonePrincipal = pickFirst(dados.requerente_telefone, dados.telefone, caso.telefone_assistido);

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-start">
        <h2 className="heading-2">Dados do assistido</h2>
        <div className="px-2 py-1 rounded bg-surface border border-soft text-[10px] font-bold uppercase tracking-wider text-muted">
          {isRepresentacao ? "Caso de Representação" : "Ação Direta"}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {renderDataField("Nome completo", nomePrincipal)}
        {renderDataField("CPF", cpfPrincipal)}
        {isRepresentacao && renderDataField("Genitora/Representante", dados.REPRESENTANTE_NOME)}
        {renderDataField("Telefone principal", telefonePrincipal)}
        {renderDataField("Tipo de ação", formatTipoAcaoLabel(caso.tipo_acao))}
        {renderDataField("Protocolo", caso.protocolo)}
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
            {/* === DADOS DO ASSISTIDO (criança) OU DO AUTOR ADULTO === */}
            <div className="space-y-4">
              <h3 className="heading-3 text-primary">
                {isRepresentacao
                  ? "Dados do Assistido (Criança/Adolescente)"
                  : "Dados do Autor da Ação"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome completo", isRepresentacao ? pickFirst(dados.NOME, dados.nome, caso.nome_assistido) : pickFirst(dados.REPRESENTANTE_NOME, caso.nome_representante, caso.nome_assistido))}
                {renderDataField("CPF", isRepresentacao ? pickFirst(dados.cpf, dados.cpf_assistido, caso.cpf_assistido) : pickFirst(dados.representante_cpf, caso.cpf_assistido, dados.cpf))}
                {renderDataField("Data de nascimento", formatDateDisplay(isRepresentacao ? pickFirst(dados.nascimento, dados.assistido_data_nascimento, caso.assistido_data_nascimento) : pickFirst(dados.representante_data_nascimento, caso.representante_data_nascimento, caso.assistido_data_nascimento)))}
                {renderDataField("Nacionalidade", isRepresentacao ? "Brasileira" : pickFirst(dados.representante_nacionalidade, caso.representante_nacionalidade, "Brasileira"))}
                {!isRepresentacao && renderDataField("Estado civil", pickFirst(dados.representante_estado_civil, caso.representante_estado_civil))}
                {!isRepresentacao && renderDataField("Profissão", pickFirst(dados.representante_ocupacao, caso.representante_ocupacao))}
                {renderDataField("Endereço residencial", pickFirst(dados.requerente_endereco_residencial, dados.endereco_assistido, caso.endereco_assistido))}
                {!isRepresentacao && renderDataField("Endereço profissional", pickFirst(dados.representante_endereco_profissional, dados.executado_endereco_profissional))}
                {renderDataField("E-mail", pickFirst(dados.requerente_email, dados.email_assistido, caso.email_assistido))}
                {renderDataField("Telefone", pickFirst(dados.requerente_telefone, dados.telefone_assistido, caso.telefone_assistido))}
                {renderDataField("RG", isRepresentacao ? "Não coletado" : `${pickFirst(dados.representante_rg, dados.assistido_rg_numero, caso.assistido_rg_numero) || ""} ${pickFirst(dados.emissor_rg_exequente, dados.assistido_rg_orgao, caso.assistido_rg_orgao) || ""}`.trim())}
              </div>
            </div>

            {/* === FILHOS EXTRAS (quando há mais de 1) === */}
            {outrosFilhos.length > 0 &&
              outrosFilhos.map((filho, index) => (
                <div key={index} className="space-y-4 pt-4 border-t border-soft">
                  <h3 className="heading-3 text-primary">
                    Dados do Assistido {index + 2} (Criança/Adolescente)
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {renderDataField("Nome completo", filho.nome)}
                    {renderDataField("CPF", filho.cpf)}
                    {renderDataField("Data de nascimento", formatDateDisplay(filho.dataNascimento))}
                    {renderDataField("Nacionalidade", filho.nacionalidade || "Brasileira")}
                    {renderDataField("RG", `${filho.rgNumero || ""} ${filho.rgOrgao || ""}`.trim())}
                  </div>
                </div>
              ))}

            {/* === REPRESENTANTE LEGAL (só em casos de representação) === */}
            {isRepresentacao && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">Dados do Representante Legal (Genitora)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Nome completo", dados.REPRESENTANTE_NOME)}
                  {renderDataField("CPF", dados.representante_cpf)}
                  {renderDataField("Data de nascimento", formatDateDisplay(dados.representante_data_nascimento))}
                  {renderDataField("Nacionalidade", dados.representante_nacionalidade)}
                  {renderDataField("Estado civil", dados.representante_estado_civil)}
                  {renderDataField("Profissão", dados.representante_ocupacao)}
                  {renderDataField("Endereço residencial", dados.requerente_endereco_residencial)}
                  {renderDataField("Endereço profissional", dados.representante_endereco_profissional)}
                  {renderDataField("E-mail", dados.requerente_email)}
                  {renderDataField("Telefone", dados.requerente_telefone)}
                  {renderDataField("RG", `${dados.representante_rg || ""} ${dados.emissor_rg_exequente || ""}`.trim())}
                  {renderDataField("Nome da mãe (avó materna)", dados.nome_mae_representante)}
                  {renderDataField("Nome do pai (avô materno)", dados.nome_pai_representante)}
                </div>
              </div>
            )}

            {/* === PARTE CONTRÁRIA (REQUERIDO) === */}
            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">Dados da Parte Contrária (Requerido)</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {renderDataField("Nome completo", pickFirst(dados.REQUERIDO_NOME, dados.nome_requerido, caso.nome_requerido))}
                {renderDataField("CPF", pickFirst(dados.executado_cpf, dados.cpf_requerido, caso.cpf_requerido))}
                {renderDataField("Endereço conhecido", pickFirst(dados.executado_endereco_residencial, dados.endereco_requerido, caso.endereco_requerido))}
                {renderDataField("Telefone", pickFirst(dados.executado_telefone, dados.telefone_requerido, caso.telefone_requerido))}
                {renderDataField("E-mail", pickFirst(dados.executado_email, dados.email_requerido))}
                {renderDataField("Profissão", pickFirst(dados.executado_ocupacao, dados.profissao_requerido))}
                {renderDataField("Endereço de trabalho", pickFirst(dados.executado_endereco_profissional, dados.requerido_endereco_profissional))}
                {renderDataField("RG", `${pickFirst(dados.rg_executado, dados.requerido_rg_numero, caso.rg_executado) || ""} ${pickFirst(dados.emissor_rg_executado, dados.requerido_rg_orgao, caso.emissor_rg_executado) || ""}`.trim())}
                {renderDataField("Mãe do requerido", pickFirst(dados.nome_mae_executado, caso.nome_mae_executado))}
                {renderDataField("Pai do requerido", pickFirst(dados.nome_pai_executado, caso.nome_pai_executado))}
                {renderDataField("Dados adicionais", pickFirst(dados.dados_adicionais_requerido, caso.dados_adicionais_requerido))}
              </div>
            </div>

            {/* === EMPREGO DO REQUERIDO === */}
            {dados.requerido_tem_emprego_formal === "sim" && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">Dados de Emprego (Requerido)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Tem emprego formal?", dados.requerido_tem_emprego_formal)}
                  {renderDataField("Nome da Empresa", dados.empregador_nome)}
                  {renderDataField("Endereço da Empresa", dados.empregador_endereco)}
                  {renderDataField("E-mail da Empresa", dados.empregador_email)}
                </div>
              </div>
            )}

            {/* === EXECUÇÃO / TÍTULO JUDICIAL === */}
            {isExecucao && (
              <div className="space-y-4 pt-4 border-t border-soft">
                <h3 className="heading-3 text-primary">Dados da Execução e Título Judicial</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {renderDataField("Vara da Petição Atual", formatVara(dados.VARA))}
                  {renderDataField("Percentual do salário mínimo (%)", dados.percentual_salario_minimo)}
                  {renderDataField("Número do Processo Originário", dados.processoOrigemNumero)}
                  {renderDataField("Cidade onde tramitou", dados.cidadeOriginaria)}
                  {renderDataField("Vara onde tramitou", formatVara(dados.varaOriginaria))}
                  {renderDataField("Tipo de Decisão", dados.tipo_decisao)}
                  {renderDataField("Dia de Pagamento fixado", dados.dia_pagamento)}
                  {renderDataField("Período do Débito", dados.periodo_meses_ano)}
                  {renderDataField("Valor Total do Débito", pickFirst(dados.valor_debito, dados.valorTotalDebitoExecucao))}
                  {renderDataField("Multa (10%)", dados.valor_multa)}
                  {renderDataField("Juros", dados.valor_juros)}
                  {renderDataField("Honorários", dados.valor_honorarios)}
                </div>
              </div>
            )}

            {/* === OUTROS DETALHES / PENSÃO === */}
            <div className="space-y-4 pt-4 border-t border-soft">
              <h3 className="heading-3 text-primary">
                {isExecucao ? "Outros Detalhes" : "Detalhes do Pedido e do Caso"}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                {!isExecucao &&
                  renderDataField(
                    "Valor da Pensão Solicitado",
                    pickFirst(dados.valor_pensao, dados.valor_pensao_atual),
                  )}
                {renderDataField("Dados Bancários para Depósito", pickFirst(dados.dados_bancarios_exequente, dados.dados_bancarios_deposito))}
                {renderDataField("Cidade para assinatura", dados.CIDADEASSINATURA)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
