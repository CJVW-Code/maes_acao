# Plano de Implementação: Regionais e Padronização

Este documento detalha as alterações para introduzir a camada de **Regional** e padronizar o seletor de cidades, mantendo o sistema de locking inalterado.

## 1. Mapeamento das Regionais
Seguiremos a estrutura fornecida, com Salvador como regional independente:

- **Salvador** (Sede)
- **1ª Regional:** Feira de Santana (Sede)
- **2ª Regional:** Vitória da Conquista (Sede)
- **3ª Regional:** Ilhéus (Sede)
- **4ª Regional:** Itabuna
- **5ª Regional:** Juazeiro
- **6ª Regional:** Jequié
- **7ª Regional:** Santo Antônio de Jesus
- **8ª Regional:** Alagoinhas
- **9ª Regional:** Barreiras
- **10ª Regional:** Paulo Afonso
- **11ª Regional:** Eunápolis
- **12ª Regional:** Valença
- **13ª Regional:** Camaçari
- **14ª Regional:** Teixeira de Freitas (Sede)
- **15ª Regional:** Jacobina

## 2. Alterações no Banco de Dados (Prisma)
- Adicionar campo `regional` na tabela `unidades`.
- Criar script de semente (seed) para vincular as unidades existentes às suas respectivas regionais conforme a lista acima.

## 3. Backend e Acesso (RBAC)
- **Middleware `requireSameUnit`:** Atualizar para permitir que o cargo `coordenador` acesse qualquer unidade dentro da sua `regional`.
- **Controllers:** Ajustar as listagens de casos para que coordenadores vejam o consolidado da regional.
- **Configuração Flexível:** Criar `backend/src/config/mapeamentoRegionais.js` para facilitar futuras mudanças de sede ou regional.

## 4. Frontend e Padronização
- **Triagem:** Substituir o campo de texto livre de "Cidade Assinatura" por um `Combobox` pesquisável.
- **Integração:** O seletor consumirá as unidades cadastradas no banco, garantindo que o `unidade_id` seja sempre exato.

## 5. Manutenção do Core
- **Locking:** O sistema de bloqueio automático e permanente ao abrir casos **não será alterado**.
- **Dashboard:** Os indicadores de ociosidade e os ícones de cadeado **serão mantidos**.

---
**Status:** Aguardando Aprovação
