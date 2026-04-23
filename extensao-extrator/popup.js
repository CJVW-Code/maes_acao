const recipeEditor = document.getElementById("recipeEditor");
const output = document.getElementById("output");
const statusNode = document.getElementById("status");
const endpointInput = document.getElementById("endpoint");
const inputJson = document.getElementById("inputJson");

const STORAGE_KEYS = {
  recipe: "extrator_recipe",
  endpoint: "extrator_endpoint",
  lastPayload: "extrator_last_payload",
  inputJson: "extrator_input_json"
};

function setStatus(message) {
  statusNode.textContent = message || "";
}

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

async function loadState() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  recipeEditor.value = pretty(
    stored[STORAGE_KEYS.recipe] || globalThis.ExtractorRecipes.DEFAULT_RECIPE
  );
  endpointInput.value = stored[STORAGE_KEYS.endpoint] || "";
  inputJson.value = stored[STORAGE_KEYS.inputJson] || "";
  output.textContent = stored[STORAGE_KEYS.lastPayload]
    ? pretty(stored[STORAGE_KEYS.lastPayload])
    : "Nenhuma extração executada.";
}

async function persistState() {
  const recipe = JSON.parse(recipeEditor.value);
  await chrome.storage.local.set({
    [STORAGE_KEYS.recipe]: recipe,
    [STORAGE_KEYS.endpoint]: endpointInput.value.trim(),
    [STORAGE_KEYS.inputJson]: inputJson.value
  });
  return recipe;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("Nenhuma aba ativa encontrada.");
  }
  return tab;
}

async function extractFromCurrentTab() {
  setStatus("Extraindo...");

  const recipe = await persistState();
  const tab = await getActiveTab();
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "extract-page-data",
    recipe
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Falha ao executar a extração.");
  }

  output.textContent = pretty(response.payload);
  await chrome.storage.local.set({
    [STORAGE_KEYS.lastPayload]: response.payload
  });
  setStatus("Extração concluída.");
  return response.payload;
}

async function fillCurrentTab() {
  setStatus("Preenchendo...");

  const recipe = await persistState();
  const tab = await getActiveTab();
  const parsedInput = JSON.parse(inputJson.value);
  const response = await chrome.tabs.sendMessage(tab.id, {
    type: "fill-page-data",
    recipe,
    payload: parsedInput
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Falha ao preencher a página.");
  }

  const result = {
    preenchimento: response.report,
    payloadNormalizado: response.payload
  };
  output.textContent = pretty(result);
  await chrome.storage.local.set({
    [STORAGE_KEYS.lastPayload]: result
  });
  setStatus(`Preenchidos: ${response.report.filled.length}`);
}

async function copyOutput() {
  await navigator.clipboard.writeText(output.textContent);
  setStatus("JSON copiado.");
}

async function downloadOutput() {
  const filename = `extracao-${Date.now()}.json`;
  const blob = new Blob([output.textContent], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Arquivo preparado para download.");
}

async function sendWebhook() {
  const endpoint = endpointInput.value.trim();
  if (!endpoint) {
    throw new Error("Informe a URL do webhook.");
  }

  const payload = JSON.parse(output.textContent);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook respondeu com status ${response.status}.`);
  }

  setStatus("Payload enviado.");
}

document.getElementById("extractBtn").addEventListener("click", async () => {
  try {
    await extractFromCurrentTab();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById("fillBtn").addEventListener("click", async () => {
  try {
    await fillCurrentTab();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  try {
    await copyOutput();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById("downloadBtn").addEventListener("click", async () => {
  try {
    await downloadOutput();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById("sendBtn").addEventListener("click", async () => {
  try {
    await sendWebhook();
  } catch (error) {
    setStatus(error.message);
  }
});

document.getElementById("resetRecipe").addEventListener("click", () => {
  recipeEditor.value = pretty(globalThis.ExtractorRecipes.DEFAULT_RECIPE);
  setStatus("Receita padrão restaurada.");
});

document.getElementById("sampleBtn").addEventListener("click", () => {
  inputJson.value = pretty({
    schema: {
      casos_partes: {
        nome_assistido: "MARIA DA SILVA",
        cpf_assistido: "12345678901",
        nome_mae_assistido: "ANA DA SILVA",
        data_nascimento_assistido: "01/02/1990",
        telefone_assistido: "71999998888",
        email_assistido: "maria@email.com",
        rg_assistido: "1234567",
        emissor_rg_assistido: "SSP",
        estado_civil: "solteira",
        nacionalidade: "brasileira",
        naturalidade: "SALVADOR",
        naturalidade_estado: "BA",
        profissao: "AUXILIAR ADMINISTRATIVA"
      },
      casos_juridico: {
        renda_individual: "1412.00",
        renda_familiar: "2200.00"
      }
    }
  });
  setStatus("Exemplo carregado.");
});

loadState().catch((error) => {
  setStatus(error.message);
});
