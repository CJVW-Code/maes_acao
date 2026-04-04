import React, { useState } from "react";
import { HelpCircle, X, ChevronDown, ChevronUp } from "lucide-react";
const duvidasFrequentes = [
  {
    pergunta: "Como sei se meus documentos foram enviados corretamente?",
    resposta:
      "Após clicar em 'Enviar' no final da página, você verá uma nova tela de confirmação com o seu número de Protocolo e sua Chave de Acesso.",
  },
  {
    pergunta:
      "Preenchi algo errado ou esqueci um documento. Como faço para consertar?",
    resposta:
      "Se você já enviou o formulário e gerou o protocolo, não crie um novo pedido. Aguarde o contato da nossa equipe pelo WhatsApp ou telefone informado. Nós avisaremos o que faltou e você poderá enviar. Criar um novo pedido pode atrasar o atendimento.",
  },
  {
    pergunta: "Como faço para acompanhar o andamento do meu caso?",
    resposta:
      "Guarde bem a sua Chave de Acesso! Com ela e o seu CPF, você pode acessar a área 'Consultar Status do Caso' aqui mesmo nesta página para ver se o seu caso está 'Em análise', 'Aguardando Documentos' ou se uma 'Reunião foi Agendada'.",
  },
  {
    pergunta: "A Defensoria cobra algum valor por este atendimento online?",
    resposta:
      "Não! Todos os serviços da Defensoria Pública são 100% gratuitos. Se você receber mensagens, e-mails ou boletos pedindo qualquer tipo de pagamento em nome da Defensoria, é golpe. Ignore e denuncie.",
  },
  {
    pergunta: "O que é Fixação de Alimentos?",
    resposta: `A fixação de alimentos é o processo judicial para estabelecer o valor da pensão alimentícia. Ao contrário do que o nome sugere, "alimentos" não se referem apenas à comida, mas a tudo o que é necessário para a manutenção digna de quem recebe: educação, saúde, lazer, vestuário e moradia. O juiz define esse valor equilibrando dois pratos da balança: a necessidade de quem pede e a possibilidade financeira de quem paga.`,
  },
  {
    pergunta: "Quais são os documentos essenciais para solicitar atendimento?",
    resposta: (
      <div className="space-y-3">
        <p>
          Para que a Defensoria possa processar o seu pedido, você precisará
          anexar fotos ou PDFs de:
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong>Documentos Pessoais:</strong> RG/CPF.
          </li>
          <li>
            <strong>Documentos da criança ou adolescente:</strong> RG/CPF .
          </li>
          <li>
            <strong>Certidões:</strong> Certidão de Nascimento dos filhos,
            Certidão de casamento do Representante Legal do menor (pai, mãe ou
            tutor) – se for o caso.
          </li>
          <li>
            <strong>Comprovante de Renda:</strong> Pode ser o contracheque, a
            Carteira de Trabalho (CTPS) indicando o salário, extrato bancário
            dos ultimos 3 meses ou comprovante de recebimento de benefícios
            sociais (como o Bolsa Família).
          </li>
          <li>
            <strong>Comprovante de Residência:</strong> Conta de água, luz ou
            telefone recente (últimos 3 meses).
          </li>
        </ul>
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
          <strong>Atenção:</strong> O comprovante de residência deve estar
          obrigatoriamente no seu nome (do assistido). Se você mora de aluguel
          ou na casa de terceiros e não possui contas em seu nome, você deve
          preencher e assinar uma Declaração de Residência.
        </div>
      </div>
    ),
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
                {/* O Botão / Slot da Pergunta */}
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
