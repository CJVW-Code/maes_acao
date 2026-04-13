import React from "react";
import { motion } from "motion/react";
import { User, X, Plus, Phone, Search } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { EnderecoInput } from "./EnderecoInput";
import {
  formatCpf,
  stripNonDigits,
  validateCpfAlgorithm,
  formatRgNumber,
  formatDateMask,
} from "../../../utils/formatters";
import {
  nacionalidadeOptions,
  estadoCivilOptions,
  orgaoEmissorOptions,
} from "../../../utils/formOptions";

export const StepDadosPessoais = ({
  formState,
  dispatch,
  handleFieldChange,
  handleCpfChangeAndValidate,
  handleRgChange,
  handleDateChange,
  handlePhoneChange,
  validar,
  formErrors,
  setFormErrors, // Precisamos disso para os CPFs dos filhos extras
  forcaRepresentacao,
  isRepresentacao,
  today,
  labelAutor,
  configAcao,
}) => {
  const isCpfOpcional = configAcao?.isCpfRepresentanteOpcional || false;

  return (
    <section className="card space-y-6 border-l-4 border-l-green-500">
      <div className="flex items-center gap-2 border-b border-soft pb-2">
        <User className="text-green-400" />
        <h2 className="heading-2">2. Quem está pedindo a ação?</h2>
      </div>

      {/* Pergunta Chave de Representação */}
      {!forcaRepresentacao && (
        <fieldset className="bg-surface p-4 rounded-lg border border-soft">
          <legend className="block text-sm font-semibold mb-2">
            Para quem é este processo?
          </legend>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-surface rounded-lg border border-soft hover:border-primary transition">
              <input
                type="radio"
                name="assistidoEhIncapaz"
                value="nao"
                checked={formState.assistidoEhIncapaz === "nao"}
                onChange={handleFieldChange}
                className="w-4 h-4 text-primary"
              />
              <span>Para mim mesmo(a)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-surface p-3 rounded-lg border border-soft hover:border-primary transition">
              <input
                type="radio"
                name="assistidoEhIncapaz"
                value="sim"
                checked={formState.assistidoEhIncapaz === "sim"}
                onChange={handleFieldChange}
                className="w-4 h-4 text-primary"
              />
              <span>Para meu filho(a) ou tutelado (Representação)</span>
            </label>
          </div>
        </fieldset>
      )}

      {/* Dados do Autor/Assistido */}
      <div className="space-y-4">
        <h3 className="heading-3 text-primary">{labelAutor}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Nome Completo *"
            name={isRepresentacao ? "NOME" : "REPRESENTANTE_NOME"}
            value={
              isRepresentacao ? formState.NOME : formState.REPRESENTANTE_NOME
            }
            onChange={handleFieldChange}
            {...validar("Informe o nome completo.")}
            className="input"
          />
          <div>
            <input
              type="text"
              inputMode="numeric"
              placeholder={
                isRepresentacao || isCpfOpcional ? "CPF (Opcional)" : "CPF *"
              }
              name={isRepresentacao ? "cpf" : "representante_cpf"}
              value={
                isRepresentacao ? formState.cpf : formState.representante_cpf
              }
              onChange={handleCpfChangeAndValidate(
                isRepresentacao ? "cpf" : "representante_cpf",
              )}
              {...(!isRepresentacao && !isCpfOpcional
                ? validar("Informe o CPF.")
                : {})}
              className={`input ${formErrors[isRepresentacao ? "cpf" : "representante_cpf"] ? "border-error ring-1 ring-error" : ""}`}
            />
            {formErrors[isRepresentacao ? "cpf" : "representante_cpf"] && (
              <span className="text-xs text-error mt-1 ml-1">
                {formErrors[isRepresentacao ? "cpf" : "representante_cpf"]}
              </span>
            )}
          </div>
        </div>

        <div
          className={`grid grid-cols-1 ${forcaRepresentacao ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4`}
        >
          <div>
            <label
              htmlFor="dataNascimentoAssistido"
              className="label text-sm font-medium mb-1 block text-text"
            >
              Data de Nascimento *
            </label>
            <input
              id={
                isRepresentacao ? "nascimento" : "representante_data_nascimento"
              }
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              name={
                isRepresentacao ? "nascimento" : "representante_data_nascimento"
              }
              value={
                isRepresentacao
                  ? formState.nascimento
                  : formState.representante_data_nascimento
              }
              onChange={handleDateChange(
                isRepresentacao
                  ? "nascimento"
                  : "representante_data_nascimento",
              )}
              className={`input ${formErrors[isRepresentacao ? "nascimento" : "representante_data_nascimento"] ? "border-error ring-1 ring-error" : ""}`}
              {...validar("Informe a data de nascimento.")}
            />
            {formErrors.representante_data_nascimento && (
              <span className="text-xs text-error mt-1 ml-1">
                {formErrors.representante_data_nascimento}
              </span>
            )}
          </div>

          {!isRepresentacao && (
            <>
              <select
                name="representante_nacionalidade"
                value={formState.representante_nacionalidade}
                onChange={handleFieldChange}
                className="input mt-auto"
              >
                {nacionalidadeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <select
                name="representante_estado_civil"
                value={formState.representante_estado_civil}
                onChange={handleFieldChange}
                className="input mt-auto"
              >
                {estadoCivilOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder="Sua Profissão"
                name="representante_ocupacao"
                value={formState.representante_ocupacao}
                onChange={handleFieldChange}
                className="input"
              />
            </>
          )}
        </div>

        {!isRepresentacao && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <input
                type="text"
                placeholder="Seu Endereço Profissional (se houver)"
                name="representante_endereco_profissional"
                value={formState.representante_endereco_profissional}
                onChange={handleFieldChange}
                className="input"
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:col-span-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="RG (Opcional)"
                  name="representante_rg"
                  value={formState.representante_rg}
                  onChange={handleRgChange("representante_rg")}
                  className="input"
                />
                <SearchableSelect
                  name="emissor_rg_exequente"
                  placeholder="Órgão Emissor (ex: SSP, DETRAN)"
                  options={orgaoEmissorOptions}
                  value={formState.emissor_rg_exequente}
                  onChange={handleFieldChange}
                  className="md:col-span-2"
                />
              </div>
            </div>

            <EnderecoInput
              label="Endereço Residencial Completo *"
              name="requerente_endereco_residencial"
              value={formState.requerente_endereco_residencial}
              onChange={handleFieldChange}
              className="w-full mt-4"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <input
                type="email"
                placeholder="Email (opcional)"
                name="requerente_email"
                value={formState.requerente_email}
                onChange={handleFieldChange}
                className="input"
              />
              <div className="relative">
                <Phone
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  size={18}
                />
                <input
                  type="text"
                  inputMode="tel"
                  placeholder="Telefone/WhatsApp para contato *"
                  name="requerente_telefone"
                  value={formState.requerente_telefone}
                  onChange={handlePhoneChange("requerente_telefone")}
                  {...validar("Informe um telefone para contato.")}
                  className="input pl-10"
                />
              </div>
            </div>
          </>
        )}

        {/* Campo WhatsApp Removido conforme solicitação */}
      </div>

      {/* --- SEÇÃO DE MÚLTIPLOS FILHOS --- */}
      {isRepresentacao && (
        <div className="mt-6 space-y-4">
          {formState.outrosFilhos.map((filho, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="bg-surface-alt p-4 rounded-lg border border-soft relative group"
            >
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-sm text-primary">
                  Filho(a) {index + 2}
                </h4>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "REMOVE_FILHO", index })}
                  className="text-error hover:text-error p-1"
                  title="Remover"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nome Completo *"
                  value={filho.nome}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_FILHO",
                      index,
                      field: "nome",
                      value: e.target.value,
                    })
                  }
                  className="input"
                  {...validar("Informe o nome do filho.")}
                />
                <div>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="CPF *"
                    value={filho.cpf}
                    onChange={(e) => {
                      const rawValue = e.target.value;
                      const formattedValue = formatCpf(rawValue);
                      const fieldName = `filho_cpf_${index}`;

                      dispatch({
                        type: "UPDATE_FILHO",
                        index,
                        field: "cpf",
                        value: formattedValue,
                      });

                      const cleanCpf = stripNonDigits(rawValue);
                      if (cleanCpf.length === 11) {
                        if (!validateCpfAlgorithm(cleanCpf)) {
                          setFormErrors((prev) => ({
                            ...prev,
                            [fieldName]: "CPF inválido.",
                          }));
                        } else {
                          setFormErrors((prev) => {
                            const updated = { ...prev };
                            delete updated[fieldName];
                            return updated;
                          });
                        }
                      } else {
                        setFormErrors((prev) => {
                          const updated = { ...prev };
                          delete updated[fieldName];
                          return updated;
                        });
                      }
                    }}
                    className={`input ${formErrors[`filho_cpf_${index}`] ? "border-error ring-1 ring-error" : ""}`}
                    {...validar("Informe o CPF do filho.")}
                  />
                  {formErrors[`filho_cpf_${index}`] && (
                    <span className="text-xs text-error mt-1 ml-1">
                      {formErrors[`filho_cpf_${index}`]}
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <label
                  htmlFor={`filho-dataNascimento-${index}`}
                  className="label text-sm font-medium mb-1 block text-text md:col-span-2"
                >
                  Data de Nascimento do Filho(a) *
                </label>
                <input
                  id={`filho-dataNascimento-${index}`}
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM/AAAA"
                  value={filho.dataNascimento}
                  onChange={(e) =>
                    dispatch({
                      type: "UPDATE_FILHO",
                      index,
                      field: "dataNascimento",
                      value: formatDateMask(e.target.value),
                    })
                  }
                  className="input"
                  {...validar("Informe a data de nascimento.")}
                />
              </div>
              {/* Campo RG Removido para filhos */}
            </motion.div>
          ))}

          <button
            type="button"
            onClick={() => dispatch({ type: "ADD_FILHO" })}
            className="btn btn-ghost border border-dashed border-primary text-primary w-full flex items-center justify-center gap-2 hover:bg-primary/5"
          >
            <Plus size={18} />
            Adicionar mais um filho(a)
          </button>
        </div>
      )}

      {/* Dados do Representante */}
      {isRepresentacao && (
        <div className="bg-surface-alt p-4 rounded-lg border-l-4 border-primary space-y-4 mt-4 bg-amber-500/5">
          <h3 className="heading-3 text-primary">
            Dados do Representante Legal (Você)
          </h3>
          <p className="text-sm text-muted mb-2">
            Preencha com seus dados (mãe, pai, tutor) que está agindo em nome da
            criança acima.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Seu Nome Completo *"
              name="REPRESENTANTE_NOME"
              value={formState.REPRESENTANTE_NOME}
              onChange={handleFieldChange}
              className="input"
              {...validar("Informe o nome do representante.")}
            />
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder={isCpfOpcional ? "Seu CPF (Opcional)" : "Seu CPF *"}
                name="representante_cpf"
                value={formState.representante_cpf}
                onChange={handleCpfChangeAndValidate("representante_cpf")}
                className={`input ${formErrors.representante_cpf ? "border-error ring-1 ring-error" : ""}`}
                {...(!isCpfOpcional
                  ? validar("Informe o CPF do representante.")
                  : {})}
              />
              {formErrors.representante_cpf && (
                <span className="text-xs text-error mt-1 ml-1">
                  {formErrors.representante_cpf}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label
              htmlFor="representanteDataNascimento"
              className="label text-sm font-medium mb-1 block text-text md:hidden"
            >
              Sua Data de Nascimento
            </label>
            <input
              id="representanteDataNascimento"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              name="representante_data_nascimento"
              value={formState.representante_data_nascimento}
              onChange={handleDateChange("representante_data_nascimento")}
              className={`input ${formErrors.representanteDataNascimento ? "border-error ring-1 ring-error" : ""}`}
              {...validar("Informe sua data de nascimento.")}
            />
            <select
              name="representante_nacionalidade"
              value={formState.representante_nacionalidade}
              onChange={handleFieldChange}
              className="input"
            >
              {nacionalidadeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              name="representante_estado_civil"
              value={formState.representante_estado_civil}
              onChange={handleFieldChange}
              className="input"
            >
              {estadoCivilOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Sua Profissão"
              name="representante_ocupacao"
              value={formState.representante_ocupacao}
              onChange={handleFieldChange}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
            <EnderecoInput
              label="Seu Endereço Residencial *"
              name="requerente_endereco_residencial"
              value={formState.requerente_endereco_residencial}
              onChange={handleFieldChange}
              className="w-full"
            />
            <input
              type="text"
              placeholder="Seu Endereço Profissional (se houver)"
              name="representante_endereco_profissional"
              value={formState.representante_endereco_profissional}
              onChange={handleFieldChange}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Seu Email"
              name="requerente_email"
              value={formState.requerente_email}
              onChange={handleFieldChange}
              className="input"
            />
            <input
              type="text"
              inputMode="tel"
              placeholder="Seu Telefone"
              name="requerente_telefone"
              value={formState.requerente_telefone}
              onChange={handlePhoneChange("requerente_telefone")}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Seu RG (Opcional)"
              name="representante_rg"
              value={formState.representante_rg}
              onChange={handleRgChange("representante_rg")}
              className="input"
            />
            <SearchableSelect
              name="emissor_rg_exequente"
              placeholder="Sua Órgão Emissor"
              options={orgaoEmissorOptions}
              value={formState.emissor_rg_exequente}
              onChange={handleFieldChange}
              className="md:col-span-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nome de sua Mãe"
              name="nome_mae_representante"
              value={formState.nome_mae_representante}
              onChange={handleFieldChange}
              className="input"
            />
            <input
              type="text"
              placeholder="Nome de seu Pai"
              name="nome_pai_representante"
              value={formState.nome_pai_representante}
              onChange={handleFieldChange}
              className="input"
            />
          </div>
        </div>
      )}
    </section>
  );
};
