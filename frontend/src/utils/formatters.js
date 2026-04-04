export const stripNonDigits = (value = "") => value.replace(/\D/g, "");

export const formatCpf = (value = "") => {
  const digits = stripNonDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const formatDateMask = (value = "") => {
  const digits = stripNonDigits(value).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

export const formatMonthYearMask = (value = "") => {
  const digits = stripNonDigits(value).slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
};

export const formatPhone = (value = "") => {
  const digits = stripNonDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export const formatRgNumber = (value = "") => {
  const digits = value.replace(/[^0-9xX]/g, "").toUpperCase().slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }
  if (digits.length <= 10) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}-${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}.${digits.slice(8, 10)}-${digits.slice(10)}`;
};

export const formatCurrencyMask = (value = "") => {
  if (value === null || value === undefined || value === "") return "";
  let digits = String(value).replace(/\D/g, "");
  if (digits === "") return "";

  // Remove leading zeros
  digits = digits.replace(/^0+/, "");

  if (digits.length === 0) return "0,00";
  if (digits.length === 1) return `0,0${digits}`;
  if (digits.length === 2) return `0,${digits}`;

  const cents = digits.slice(-2);
  let integer = digits.slice(0, -2);

  integer = integer.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1.");

  return `${integer},${cents}`;
};

export const formatDateToBr = (isoDate = "") => {
  if (!isoDate) return "";
  if (isoDate.includes("/")) return isoDate; // Já está no formato BR
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
};

export const parseBrDateToIso = (brDate = "") => {
  if (!brDate || !brDate.includes("/")) return brDate;
  const [day, month, year] = brDate.split("/");
  if (!day || !month || !year || year.length < 4) return "";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

export const sanitizeDecimalInput = (
  value = "",
  { decimalPlaces = 2, maxIntegerDigits = 9 } = {},
) => {
  if (value === null || value === undefined || value === "") return "";
  const allowed = String(value).replace(/[^0-9,]/g, "");
  const [intPartRaw, ...decimalParts] = allowed.split(",");
  const integerPart = (intPartRaw || "").slice(0, maxIntegerDigits);
  if (decimalParts.length === 0) {
    return integerPart;
  }
  const decimalPart = decimalParts.join("").slice(0, decimalPlaces);
  return `${integerPart},${decimalPart}`;
};

export const normalizeDecimalForSubmit = (value = "", decimals = 2) => {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  if (Number.isNaN(number)) {
    return "";
  }
  return number.toFixed(decimals);
};

export const validateCpfAlgorithm = (cpf) => {
  const cleanCpf = String(cpf).replace(/[^\d]+/g, "");
  if (cleanCpf.length !== 11 || /^(\d)\1+$/.test(cleanCpf)) return false;

  let soma = 0;
  let resto;

  for (let i = 1; i <= 9; i++) {
    soma = soma + parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
  }
  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCpf.substring(9, 10))) return false;

  soma = 0;
  for (let i = 1; i <= 10; i++) {
    soma = soma + parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
  }
  resto = (soma * 10) % 11;

  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(cleanCpf.substring(10, 11))) return false;

  return true;
};
