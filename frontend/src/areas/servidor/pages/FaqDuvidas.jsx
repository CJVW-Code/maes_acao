import React, { useState } from "react";
import { HelpCircle, X, ChevronDown, ChevronUp } from "lucide-react";

const duvidasFrequentes = [
  {
    pergunta: "Posso criar outro pedido se percebi erro depois do envio?",
    resposta:
      "Evite criar protocolo duplicado. O ideal é complementar ou corrigir o atendimento existente conforme o fluxo interno, para não gerar duplicidade, retrabalho ou atraso na análise.",
  },
  {
    pergunta: 'O que acontece ao marcar "Enviar documentos depois"?',
    resposta:
      "O sistema permite concluir o cadastro sem anexar os documentos naquele momento, mas o caso só deve ser considerado apto para andamento após a juntada da documentação obrigatória.",
  },
  {
    pergunta: "Quando escolher Fixação de Pensão Alimentícia?",
    resposta:
      "Use quando ainda não houver sentença, decisão judicial ou acordo homologado fixando alimentos. É a ação inicial para estabelecer o valor da pensão.",
  },
  {
    pergunta: "Quando escolher Execução de Alimentos?",
    resposta:
      "Use quando já existir sentença, decisão ou acordo homologado fixando alimentos e houver parcelas em atraso a cobrar.",
  },
  {
    pergunta: "Qual a diferença prática entre Fixação e Execução?",
    resposta:
      "Na fixação, o sistema coleta dados para pedir a definição da pensão. Na execução, coleta dados do processo anterior, período da dívida, valor do débito e documentos que comprovam o título executivo.",
  },
  {
    pergunta: 'O que informar no campo "Vara da Petição Atual"?',
    resposta:
      "Informe a vara para onde a nova petição será direcionada, conforme a organização da comarca selecionada. O campo deve receber apenas o número da vara, quando aplicável.",
  },
  {
    pergunta: 'Na execução, o que é "Processo Original"?',
    resposta:
      "É o processo em que os alimentos foram fixados. Sempre que possível, preencha número do processo, cidade originária, vara e tipo da decisão.",
  },
  {
    pergunta: 'O que é "Tipo da Decisão" na execução?',
    resposta:
      "Indica a origem do título que fixou os alimentos, como sentença, decisão interlocutória, acordo homologado ou outro documento judicial equivalente.",
  },
  {
    pergunta: 'Como preencher "Início do Débito" e "Fim do Débito"?',
    resposta:
      "Informe o primeiro e o último mês/ano cobrados, no formato MM/AAAA. Esses campos delimitam o período da dívida que será executada.",
  },
  {
    pergunta: 'O que informar em "Valor Total do Débito"?',
    resposta:
      "Informe o valor total apurado da dívida no período indicado. Na execução, esse campo deve receber o total acumulado, não apenas o valor mensal da pensão.",
  },
  {
    pergunta: "Quando preencher os dados do empregador da outra parte?",
    resposta:
      "Preencha quando houver informação de vínculo formal. Nome, endereço e e-mail da empresa podem auxiliar em ofícios, desconto em folha ou localização patrimonial.",
  },
  {
    pergunta: "O que orientar sobre guarda e direito de convivência?",
    resposta:
      "Na fixação, se também houver necessidade de regularizar guarda ou visitas, descreva com quem a criança mora, como ocorre a convivência atual e qual arranjo se pretende pedir.",
  },
  {
    pergunta: "Quais documentos são essenciais na Fixação?",
    resposta: (
      <div className="space-y-3">
        <p>Para reduzir pendências, confira se foram anexados:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Responsável:</strong> RG/CNH, comprovante de residência e
            comprovante de renda.
          </li>
          <li>
            <strong>Criança ou adolescente:</strong> certidão de nascimento.
          </li>
          <li>
            <strong>Documentos opcionais úteis:</strong> CPF/RG da criança,
            comprovantes de despesas, comprovantes escolares, recibos médicos e
            provas sobre renda da outra parte.
          </li>
        </ul>
      </div>
    ),
  },
  {
    pergunta: "Quais documentos são essenciais na Execução?",
    resposta: (
      <div className="space-y-3">
        <p>
          Além dos documentos pessoais e da criança, a execução exige atenção ao
          título que fixou os alimentos.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Obrigatório:</strong> cópia da sentença, decisão ou acordo
            homologado que fixou a pensão.
          </li>
          <li>
            <strong>Cálculos:</strong> anexe o cálculo do rito da prisão e/ou
            do rito da penhora, quando disponível.
          </li>
          <li>
            <strong>Dados do débito:</strong> confira período cobrado,
            percentual ou critério fixado e valor total da dívida.
          </li>
        </ul>
      </div>
    ),
  },
  {
    pergunta: "CPF/RG da criança é obrigatório?",
    resposta:
      "No formulário atual, CPF e RG dos filhos são opcionais para fixação e execução de alimentos. A certidão de nascimento permanece como documento obrigatório.",
  },
  {
    pergunta: "Onde anexar cálculos da execução?",
    resposta:
      'Use os campos "Cálculo Rito da Prisão" e "Cálculo Rito da Penhora", conforme o cálculo disponível. Também é possível anexar documentos complementares em "Outros Documentos".',
  },
  {
    pergunta: "Erro comum: escolher execução sem título judicial",
    resposta:
      "Se não existe decisão, sentença ou acordo homologado fixando alimentos, a ação correta tende a ser fixação, não execução.",
  },
  {
    pergunta: "Erro comum: preencher execução sem período do débito",
    resposta:
      "A execução precisa indicar claramente quais meses estão sendo cobrados. Sem início e fim do débito, a minuta fica incompleta para análise.",
  },
  {
    pergunta: "Erro comum: deixar a outra parte sem contato ou endereço",
    resposta:
      "O formulário exige pelo menos telefone ou endereço do requerido. Quanto mais dados forem informados, melhor para localização, citação e andamento do caso.",
  },
];

export function FaqDuvidas() {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState(null);

  const toggleFaq = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
      {isOpen && (
        <div className="card mb-4 w-80 md:w-96 max-h-[70vh] overflow-y-auto shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-4 border-b border-soft pb-2">
            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
              <HelpCircle size={20} /> Dúvidas Frequentes
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="btn-ghost p-1 rounded-full"
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-3">
            {duvidasFrequentes.map((item, index) => (
              <div
                key={index}
                className="border border-border rounded-card overflow-hidden bg-surface transition-colors duration-300 shadow-soft"
              >
                {/* O botão / slot da pergunta */}
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full flex justify-between items-center p-3 text-left hover:bg-app/50 transition-colors"
                >
                  <span className="font-semibold text-primary">
                    {item.pergunta}
                  </span>
                  {openIndex === index ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </button>

                {openIndex === index && (
                  <div className="p-3 bg-app text-xs text-muted leading-relaxed border-t border-border">
                    <div>{item.resposta}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-accent w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
      >
        {isOpen ? <X size={28} /> : <HelpCircle size={28} />}
      </button>
    </div>
  );
}
