import { Users, Search } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
import { EnderecoInput } from "./EnderecoInput";
import {
  nacionalidadeOptions,
  estadoCivilOptions,
  outrosDadosRequeridoConfig,
  orgaoEmissorOptions,
} from "../../../utils/formOptions";

export const StepRequerido = ({
  formState,
  handleFieldChange,
  handleCpfChangeAndValidate,
  handlePhoneChange,
  handleRgChange,
  handleDateChange,
  toggleRequeridoDetalhe,
  formErrors,
  today,
}) => {
  return (
    <section className="card space-y-4 border-l-4 border-l-red-500">
      <div className="flex items-center gap-2 border-b border-soft pb-2">
        <Users className="text-red-400" />
        <h2 className="heading-2">3. Contra quem é a ação? (Requerido)</h2>
      </div>
      <p className="text-sm text-muted">
        Preencha com o máximo de informações que você souber.
      </p>
      <p className="text-thirt text-sm">
        Informando o Número para contato aumenta em 40% as chances do processo
        progredir mais rápido.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="nomeRequerido" className="label">Nome Completo da outra parte *</label>
          <input
            id="nomeRequerido"
            type="text"
            placeholder="Nome Completo da outra parte *"
            name="REQUERIDO_NOME"
            value={formState.REQUERIDO_NOME}
            onChange={handleFieldChange}
            className="input"
            aria-invalid={Boolean(formErrors.nomeRequerido)}
          />
          {formErrors.nomeRequerido && (
            <p className="text-xs text-red-500 mt-1">
              {formErrors.nomeRequerido}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="cpfRequerido" className="label">CPF (se souber)</label>
          <input
            id="cpfRequerido"
            type="text"
            inputMode="numeric"
            placeholder="CPF (se souber)"
            name="executado_cpf"
            value={formState.executado_cpf}
            onChange={handleCpfChangeAndValidate("executado_cpf")}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requeridoNomeMae" className="label">Nome da mãe do requerido</label>
          <input
            id="requeridoNomeMae"
            type="text"
            placeholder="Mãe (se souber)"
            name="nome_mae_executado"
            value={formState.nome_mae_executado}
            onChange={handleFieldChange}
            className="input"
          />
        </div>
        <div>
          <label htmlFor="requeridoNomePai" className="label">Nome do pai do requerido</label>
          <input
            id="requeridoNomePai"
            type="text"
            placeholder="Pai (se souber)"
            name="nome_pai_executado"
            value={formState.nome_pai_executado}
            onChange={handleFieldChange}
            className="input"
          />
        </div>
      </div>

      <div>
        <EnderecoInput
          label="Endereço Residencial do Requerido (Pelo menos um contato é obrigatório) *"
          name="executado_endereco_residencial"
          value={formState.executado_endereco_residencial}
          onChange={handleFieldChange}
          className="w-full"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="telefoneRequerido" className="label">Telefone *</label>
          <input
            id="telefoneRequerido"
            type="text"
            inputMode="tel"
            placeholder="Telefone (pelo menos um contato é obrigatório) *"
            name="executado_telefone"
            value={formState.executado_telefone}
            onChange={handlePhoneChange("executado_telefone")}
            className="input"
            aria-invalid={Boolean(formErrors.requeridoContato)}
          />
        </div>
        <div>
          <label htmlFor="emailRequerido" className="label">Email</label>
          <input
            id="emailRequerido"
            type="email"
            placeholder="Email (pelo menos um contato é obrigatório) *"
            name="executado_email"
            value={formState.executado_email}
            onChange={handleFieldChange}
            className="input"
          />
        </div>
      </div>
      {formErrors.requeridoContato && (
        <p className="text-xs text-red-500">{formErrors.requeridoContato}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="text"
          placeholder="Profissão (se souber)"
          name="executado_ocupacao"
          value={formState.executado_ocupacao}
          onChange={handleFieldChange}
          className="input"
        />
        <select
          name="executado_nacionalidade"
          value={formState.executado_nacionalidade}
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
          name="executado_estado_civil"
          value={formState.executado_estado_civil}
          onChange={handleFieldChange}
          className="input"
        >
          {estadoCivilOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="requeridoEnderecoTrabalho" className="label">Endereço de Trabalho (se souber)</label>
        <input
          id="requeridoEnderecoTrabalho"
          type="text"
          placeholder="Endereço de Trabalho (se souber)"
          name="executado_endereco_profissional"
          value={formState.executado_endereco_profissional}
          onChange={handleFieldChange}
          className="input"
        />
      </div>

      <div className="border border-dashed border-soft rounded-xl p-4 space-y-3 bg-app/40">
        <p className="label mb-0">
          Quais dessas informações adicionais você possui?
        </p>
        <div className="space-y-2">
          {outrosDadosRequeridoConfig.map((item) => {
            const selecionado = formState.requeridoOutrosSelecionados?.includes(
              item.key,
            ) || false;
            return (
              <div
                key={item.key}
                className="bg-surface rounded-lg border border-soft/60 p-3 space-y-2"
              >
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    checked={selecionado}
                    onChange={() => toggleRequeridoDetalhe(item.key)}
                  />
                  <span>{item.label}</span>
                </label>
                {selecionado && (
                  <>
                    {item.renderType === "rg" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="RG"
                          name="rg_executado"
                          value={formState.rg_executado}
                          onChange={handleRgChange("rg_executado")}
                          className="input"
                        />
                        <SearchableSelect
                          name="emissor_rg_executado"
                          placeholder="Órgão Emissor"
                          options={orgaoEmissorOptions}
                          value={formState.emissor_rg_executado}
                          onChange={handleFieldChange}
                        />
                      </div>
                    )}
                    {item.renderType === "filiacao" && null}
                    {item.renderType === "date" && (
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="DD/MM/AAAA"
                        name={item.field}
                        value={formState[item.field]}
                        onChange={handleDateChange(item.field)}
                        className="input"
                      />
                    )}
                    {item.renderType === "text" && (
                      <input
                        type="text"
                        name={item.field}
                        value={formState[item.field]}
                        onChange={handleFieldChange}
                        className="input"
                        placeholder={item.placeholder}
                      />
                    )}
                    {item.renderType === "textarea" && (
                      <textarea
                        name={item.field}
                        value={formState[item.field]}
                        onChange={handleFieldChange}
                        className="input"
                        rows="2"
                        placeholder={item.placeholder}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
