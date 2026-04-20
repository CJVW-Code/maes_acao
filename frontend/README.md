Listed directory templates
Viewed dicionarioTags.js:1-84

Infelizmente, **não consigo ler o conteúdo interno dos arquivos `.docx`** pois são binários. Para fazer uma verificação precisa das tags, você precisa me mandar as tags que estão neles.

A forma mais rápida é você abrir cada `.docx` no Word e pressionar `Ctrl+H` (Substituir) — todas as `{tags}` vão aparecer — ou me mandar um print do documento com as tags visíveis.

---

Enquanto isso, olhando o `dicionarioTags.js`, já identifico alguns problemas críticos para o plano:

---

### O Problema dos Cumulados

Os modelos `executacao_alimentos_cumulado.docx` e `cumprimento_cumulado.docx` precisam de **dois valores de débito separados** (penhora + prisão), enquanto os demais precisam de apenas um.

Mas olhando o `TAGS_OFICIAIS`, temos apenas:
```javascript
'valor_debito',         // → Único valor total
'valor_debito_extenso', // → Único valor em extenso
```

**Faltam** as tags específicas do cumulado:
```javascript
// ❌ AUSENTES no dicionarioTags.js
'valor_debito_penhora',
'valor_debito_penhora_extenso',
'valor_debito_prisao',
'valor_debito_prisao_extenso',
```

Isso significa que mesmo que o template tenha essas tags, o fluxo atual **vai deixá-las em branco**.

---

### Minha sugestão antes de criar o plano completo:

Me mande as tags dos seguintes arquivos para eu fazer o mapeamento exato:
1.  `executacao_alimentos_cumulado.docx`
2.  `cumprimento_cumulado.docx`
3.  `cumprimento_penhora.docx`
4.  `cumprimento_prisao.docx`

A forma mais rápida: abra cada um no Word, vá em `Página Inicial → Substituir (Ctrl+H)`, digite `{` no campo "Localizar" e clique em "Localizar Tudo". Todas as tags aparecerão selecionadas de uma vez.