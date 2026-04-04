import React from "react";
import { motion } from "motion/react";
import { User, X, Plus, Phone, Search } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import {
  formatCpf,
  stripNonDigits,
  validateCpfAlgorithm,
  formatRgNumber,
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
}) => {
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
            name="nome"
            value={formState.nome}
            onChange={handleFieldChange}
            {...validar("Informe o nome completo.")}
            className="input"
          />
          <div>
            <input
              type="text"
              inputMode="numeric"
              placeholder="CPF *"
              name="cpf"
              value={formState.cpf}
              onChange={handleCpfChangeAndValidate("cpf")}
              {...(!isRepresentacao ? validar("Informe o CPF.") : {})}
              className={`input ${formErrors.cpf ? "border-error ring-1 ring-error" : ""}`}
            />
            {formErrors.cpf && (
              <span className="text-xs text-error mt-1 ml-1">
                {formErrors.cpf}
              </span>
            )}
          </div>
        </div>

        <div
          className={`grid grid-cols-1 ${forcaRepresentacao ? "md:grid-cols-2" : "md:grid-cols-3"} gap-4`}
        >
          <div>
            <label htmlFor="dataNascimentoAssistido" className="label text-sm font-medium mb-1 block text-text">
              Data de Nascimento *
            </label>
            <input
              id="dataNascimentoAssistido"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              name="dataNascimentoAssistido"
              value={formState.dataNascimentoAssistido}
              onChange={handleDateChange("dataNascimentoAssistido")}
              className={`input ${formErrors.dataNascimentoAssistido ? "border-error ring-1 ring-error" : ""}`}
              {...validar("Informe a data de nascimento.")}
            />
            {formErrors.dataNascimentoAssistido && (
              <span className="text-xs text-error mt-1 ml-1">
                {formErrors.dataNascimentoAssistido}
              </span>
            )}
          </div>
          {!isRepresentacao && (
            <select
              name="assistidoNacionalidade"
              value={formState.assistidoNacionalidade}
              onChange={handleFieldChange}
              className="input"
            >
              {nacionalidadeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {!isRepresentacao && (
            <select
              name="assistidoEstadoCivil"
              value={formState.assistidoEstadoCivil}
              onChange={handleFieldChange}
              className="input"
            >
              {estadoCivilOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          {!isRepresentacao && (
            <input
              type="text"
              placeholder="Sua Profissão"
              name="assistidoOcupacao"
              value={formState.assistidoOcupacao}
              onChange={handleFieldChange}
              className="input"
            />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {!isRepresentacao && (
            <input
              type="text"
              placeholder="Seu Endereço Profissional (se houver)"
              name="assistidoEnderecoProfissional"
              value={formState.assistidoEnderecoProfissional}
              onChange={handleFieldChange}
              className="input"
            />
          )}
          {!isRepresentacao && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                inputMode="numeric"
                placeholder="RG (Opcional)"
                name="assistidoRgNumero"
                value={formState.assistidoRgNumero}
                onChange={handleRgChange("assistidoRgNumero")}
                className="input"
              />
              <SearchableSelect
                name="assistidoRgOrgao"
                placeholder="Órgão Emissor (ex: SSP, DETRAN)"
                options={orgaoEmissorOptions}
                value={formState.assistidoRgOrgao}
                onChange={handleFieldChange}
                className="md:col-span-2"
              />
            </div>
          )}
          {!isRepresentacao && (
            <input
              type="text"
              placeholder="Endereço Residencial Completo *"
              name="enderecoAssistido"
              value={formState.enderecoAssistido}
              onChange={handleFieldChange}
              {...validar("Informe o endereço completo.")}
              className="input w-full"
            />
          )}
        </div>

        {!isRepresentacao && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Email (opcional)"
              name="emailAssistido"
              value={formState.emailAssistido}
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
                name="telefone"
                value={formState.telefone}
                onChange={handlePhoneChange("telefone")}
                {...validar("Informe um telefone para contato.")}
                className="input pl-10"
              />
            </div>
          </div>
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
                <label htmlFor={`filho-dataNascimento-${index}`} className="label text-sm font-medium mb-1 block text-text md:col-span-2">
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
              name="representanteNome"
              value={formState.representanteNome}
              onChange={handleFieldChange}
              className="input"
              {...validar("Informe o nome do representante.")}
            />
            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Seu CPF *"
                name="representanteCpf"
                value={formState.representanteCpf}
                onChange={handleCpfChangeAndValidate("representanteCpf")}
                className={`input ${formErrors.representanteCpf ? "border-error ring-1 ring-error" : ""}`}
                {...validar("Informe o CPF do representante.")}
              />
              {formErrors.representanteCpf && (
                <span className="text-xs text-error mt-1 ml-1">
                  {formErrors.representanteCpf}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label htmlFor="representanteDataNascimento" className="label text-sm font-medium mb-1 block text-text md:hidden">
              Sua Data de Nascimento
            </label>
            <input
              id="representanteDataNascimento"
              type="text"
              inputMode="numeric"
              placeholder="DD/MM/AAAA"
              name="representanteDataNascimento"
              value={formState.representanteDataNascimento}
              onChange={handleDateChange("representanteDataNascimento")}
              className={`input ${formErrors.representanteDataNascimento ? "border-error ring-1 ring-error" : ""}`}
              {...validar("Informe sua data de nascimento.")}
            />
            <select
              name="representanteNacionalidade"
              value={formState.representanteNacionalidade}
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
              name="representanteEstadoCivil"
              value={formState.representanteEstadoCivil}
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
              name="representanteOcupacao"
              value={formState.representanteOcupacao}
              onChange={handleFieldChange}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Seu Endereço Residencial *"
              name="representanteEnderecoResidencial"
              value={formState.representanteEnderecoResidencial}
              onChange={handleFieldChange}
              className="input"
            />
            <input
              type="text"
              placeholder="Seu Endereço Profissional (se houver)"
              name="representanteEnderecoProfissional"
              value={formState.representanteEnderecoProfissional}
              onChange={handleFieldChange}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="email"
              placeholder="Seu Email"
              name="representanteEmail"
              value={formState.representanteEmail}
              onChange={handleFieldChange}
              className="input"
            />
            <input
              type="text"
              inputMode="tel"
              placeholder="Seu Telefone"
              name="representanteTelefone"
              value={formState.representanteTelefone}
              onChange={handlePhoneChange("representanteTelefone")}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Seu RG (Opcional)"
              name="representanteRgNumero"
              value={formState.representanteRgNumero}
              onChange={handleRgChange("representanteRgNumero")}
              className="input"
            />
            <SearchableSelect
              name="representanteRgOrgao"
              placeholder="Sua Órgão Emissor"
              options={orgaoEmissorOptions}
              value={formState.representanteRgOrgao}
              onChange={handleFieldChange}
              className="md:col-span-2"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Nome de sua Mãe"
              name="representanteNomeMae"
              value={formState.representanteNomeMae}
              onChange={handleFieldChange}
              className="input"
            />
            <input
              type="text"
              placeholder="Nome de seu Pai"
              name="representanteNomePai"
              value={formState.representanteNomePai}
              onChange={handleFieldChange}
              className="input"
            />
          </div>
        </div>
      )}
    </section>
  );
};
