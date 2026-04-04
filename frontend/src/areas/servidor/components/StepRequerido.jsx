import { Users, Search } from "lucide-react";
import { SearchableSelect } from "../../../components/ui/SearchableSelect";
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
            name="nomeRequerido"
            value={formState.nomeRequerido}
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
            name="cpfRequerido"
            value={formState.cpfRequerido}
            onChange={handleCpfChangeAndValidate("cpfRequerido")}
            className="input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="enderecoRequerido" className="label">Endereço Residencial *</label>
        <input
          id="enderecoRequerido"
          type="text"
          placeholder="Endereço Residencial (pelo menos um contato é obrigatório) *"
          name="enderecoRequerido"
          value={formState.enderecoRequerido}
          onChange={handleFieldChange}
          className="input"
          aria-invalid={Boolean(formErrors.requeridoContato)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="requeridoTelefone" className="label">Telefone *</label>
          <input
            id="requeridoTelefone"
            type="text"
            inputMode="tel"
            placeholder="Telefone (pelo menos um contato é obrigatório) *"
            name="requeridoTelefone"
            value={formState.requeridoTelefone}
            onChange={handlePhoneChange("requeridoTelefone")}
            className="input"
            aria-invalid={Boolean(formErrors.requeridoContato)}
          />
        </div>
        <div>
          <label htmlFor="requeridoEmail" className="label">Email</label>
          <input
            id="requeridoEmail"
            type="email"
            placeholder="Email (pelo menos um contato é obrigatório) *"
            name="requeridoEmail"
            value={formState.requeridoEmail}
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
          name="requeridoOcupacao"
          value={formState.requeridoOcupacao}
          onChange={handleFieldChange}
          className="input"
        />
        <select
          name="requeridoNacionalidade"
          value={formState.requeridoNacionalidade}
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
          name="requeridoEstadoCivil"
          value={formState.requeridoEstadoCivil}
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
        <label htmlFor="requeridoEnderecoProfissional" className="label">Endereço de Trabalho (se souber)</label>
        <input
          id="requeridoEnderecoProfissional"
          type="text"
          placeholder="Endereço de Trabalho (se souber)"
          name="requeridoEnderecoProfissional"
          value={formState.requeridoEnderecoProfissional}
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
                          name="requeridoRgNumero"
                          value={formState.requeridoRgNumero}
                          onChange={handleRgChange("requeridoRgNumero")}
                          className="input"
                        />
                        <SearchableSelect
                          name="requeridoRgOrgao"
                          placeholder="Órgão Emissor"
                          options={orgaoEmissorOptions}
                          value={formState.requeridoRgOrgao}
                          onChange={handleFieldChange}
                        />
                      </div>
                    )}
                    {item.renderType === "filiacao" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          name="requeridoNomeMae"
                          value={formState.requeridoNomeMae}
                          onChange={handleFieldChange}
                          className="input"
                          placeholder="Nome da mãe do requerido"
                        />
                        <input
                          type="text"
                          name="requeridoNomePai"
                          value={formState.requeridoNomePai}
                          onChange={handleFieldChange}
                          className="input"
                          placeholder="Nome do pai do requerido"
                        />
                      </div>
                    )}
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
