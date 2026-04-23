function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getBySelector(selector, attribute) {
  if (!selector) return "";

  const element = document.querySelector(selector);
  if (!element) return "";

  if (attribute) {
    return cleanText(element.getAttribute(attribute));
  }

  if (
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
  ) {
    return element.checked ? "Sim" : "Não";
  }

  if (element.tagName === "SELECT") {
    const selectedOption = element.options[element.selectedIndex];
    return cleanText(selectedOption?.textContent || "");
  }

  if ("value" in element && element.value) {
    return cleanText(element.value);
  }

  return cleanText(element.textContent);
}

function getBySelectorAll(selector, index = 0, attribute) {
  if (!selector) return "";

  const elements = Array.from(document.querySelectorAll(selector));
  const element = elements[index];
  if (!element) return "";

  if (attribute) {
    return cleanText(element.getAttribute(attribute));
  }

  if (
    element instanceof HTMLInputElement &&
    (element.type === "checkbox" || element.type === "radio")
  ) {
    return element.checked ? "Sim" : "Não";
  }

  if (element.tagName === "SELECT") {
    const selectedOption = element.options[element.selectedIndex];
    return cleanText(selectedOption?.textContent || "");
  }

  if ("value" in element && element.value) {
    return cleanText(element.value);
  }

  return cleanText(element.textContent);
}

function findLabelValue(labels = []) {
  const candidates = Array.from(
    document.querySelectorAll("label, th, td, dt, dd, span, div, strong, b")
  );

  for (const label of labels) {
    const normalizedLabel = cleanText(label).toLowerCase();

    for (const node of candidates) {
      const nodeText = cleanText(node.textContent).toLowerCase();
      if (!nodeText || !nodeText.includes(normalizedLabel)) continue;

      if (node.nextElementSibling) {
        const nextText = cleanText(node.nextElementSibling.textContent);
        if (nextText) return nextText;
      }

      const parent = node.parentElement;
      if (parent) {
        const rowTexts = Array.from(parent.children)
          .map((child) => cleanText(child.textContent))
          .filter(Boolean);

        if (rowTexts.length >= 2) {
          const index = rowTexts.findIndex((text) =>
            text.toLowerCase().includes(normalizedLabel)
          );
          if (index >= 0 && rowTexts[index + 1]) {
            return rowTexts[index + 1];
          }
        }
      }
    }
  }

  return "";
}

function getByRegex(pattern) {
  if (!pattern) return "";
  const match = document.body.innerText.match(new RegExp(pattern, "i"));
  return cleanText(match?.[1] || "");
}

function resolveStrategy(strategy) {
  switch (strategy.type) {
    case "selector":
      return getBySelector(strategy.selector, strategy.attribute);
    case "selectorAll":
      return getBySelectorAll(strategy.selector, strategy.index, strategy.attribute);
    case "label":
      return findLabelValue(strategy.labels || []);
    case "regex":
      return getByRegex(strategy.pattern);
    case "meta": {
      const selector = `meta[name="${strategy.name}"], meta[property="${strategy.name}"]`;
      return getBySelector(selector, "content");
    }
    default:
      return "";
  }
}

function extractFields(recipe) {
  const result = {};
  const fields = recipe?.fields || {};

  Object.entries(fields).forEach(([fieldName, config]) => {
    const strategies = config.strategies || [];
    for (const strategy of strategies) {
      const value = resolveStrategy(strategy);
      if (value) {
        result[fieldName] = value;
        break;
      }
    }
  });

  return result;
}

function dispatchFieldEvents(element) {
  ["input", "change", "keyup", "blur"].forEach((eventName) => {
    element.dispatchEvent(new Event(eventName, { bubbles: true }));
  });
}

function setInputValue(element, value) {
  if (!element) return false;
  element.value = value == null ? "" : String(value);
  dispatchFieldEvents(element);
  return true;
}

function setCheckboxValue(element, value) {
  if (!element) return false;
  const normalized = String(value || "").toLowerCase();
  element.checked = value === true || normalized === "sim" || normalized === "true";
  dispatchFieldEvents(element);
  return true;
}

function setSelectByText(element, value) {
  if (!element || !value) return false;
  const target = cleanText(value).toLowerCase();
  const option = Array.from(element.options).find(
    (item) => cleanText(item.textContent).toLowerCase() === target
  );

  if (!option) return false;

  element.value = option.value;
  dispatchFieldEvents(element);
  return true;
}

function applyFillMap(fillData, recipe) {
  const report = { filled: [], skipped: [] };
  const fillMap = recipe?.fillMap || {};

  Object.entries(fillMap).forEach(([sourceKey, target]) => {
    const value = fillData[sourceKey];
    if (value === undefined || value === null || String(value).trim() === "") {
      report.skipped.push({ field: sourceKey, reason: "sem_valor" });
      return;
    }

    let success = false;

    if (target.type === "input") {
      success = setInputValue(document.querySelector(target.selector), value);
    } else if (target.type === "inputAll") {
      const element = document.querySelectorAll(target.selector)[target.index || 0];
      success = setInputValue(element, value);
    } else if (target.type === "checkbox") {
      success = setCheckboxValue(document.querySelector(target.selector), value);
    } else if (target.type === "selectText") {
      success = setSelectByText(document.querySelector(target.selector), value);
    }

    if (success) {
      report.filled.push({ field: sourceKey, value: String(value) });
    } else {
      report.skipped.push({ field: sourceKey, reason: "campo_nao_encontrado_ou_valor_incompativel" });
    }
  });

  return report;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "extract-page-data" && message?.type !== "fill-page-data") return;

  try {
    const recipe = message.recipe || globalThis.ExtractorRecipes.DEFAULT_RECIPE;
    if (message?.type === "extract-page-data") {
      const rawFields = extractFields(recipe);
      const payload = globalThis.ExtractorRecipes.buildExtractionPayload(
        rawFields,
        {
          title: document.title,
          url: window.location.href
        },
        recipe
      );

      sendResponse({ ok: true, payload });
      return true;
    }

    const fillData = globalThis.ExtractorRecipes.convertDbJsonToSolarForm(
      message.payload || {}
    );
    const report = applyFillMap(fillData, recipe);
    sendResponse({ ok: true, payload: fillData, report });
  } catch (error) {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao extrair dados."
    });
  }

  return true;
});
