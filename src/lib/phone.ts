const nonDigits = /\D/g;
// Caracteres aceitos na máscara. Qualquer outro indica um valor legado ou
// texto livre (por exemplo, "ramal 123") que não deve ser reescrito.
const unsupportedCharacters = /[^0-9+\s().-]/;
const internationalBrazilPrefix = /^\+\s*55/;
const maxLocalDigits = 11;

function onlyDigits(value: string): string {
  return value.replace(nonDigits, "");
}

function formatLocalPhone(digits: string): string {
  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);

  if (digits.length < 3) {
    return `(${areaCode}`;
  }

  if (digits.length <= 6) {
    return `(${areaCode}) ${subscriber}`;
  }

  const subscriberPrefixLength = digits.length === maxLocalDigits ? 5 : 4;

  return `(${areaCode}) ${subscriber.slice(0, subscriberPrefixLength)}-${subscriber.slice(subscriberPrefixLength)}`;
}

/**
 * Formata o telefone durante a digitação. Valores com caracteres fora da
 * máscara (letras, ramais etc.) são preservados para não corromper dados
 * legados. O prefixo "+" é mantido mesmo antes do primeiro dígito.
 */
export function formatPhone(value: string | null | undefined): string {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "";
  }

  if (unsupportedCharacters.test(text)) {
    return text;
  }

  if (text.startsWith("+")) {
    if (!/\d/.test(text)) {
      return "+";
    }

    const brazilPrefix = internationalBrazilPrefix.exec(text);

    if (!brazilPrefix) {
      return text;
    }

    const localDigits = onlyDigits(
      text.slice(brazilPrefix[0].length),
    ).slice(0, maxLocalDigits);

    return localDigits ? `+55 ${formatLocalPhone(localDigits)}` : "+55";
  }

  if (!/\d/.test(text)) {
    return "";
  }

  const digits = onlyDigits(text).slice(0, maxLocalDigits);

  if (digits.startsWith("0")) {
    return text;
  }

  return formatLocalPhone(digits);
}

/**
 * Normaliza apenas valores completos e inequívocos para exibição/edição.
 * Entradas ambíguas (internacional não-55, 8–9 dígitos, 0800, ramais) são
 * mantidas como estão para que salvar outro campo não reescreva o telefone.
 */
export function formatPhoneForDisplay(
  value: string | null | undefined,
): string {
  const text = typeof value === "string" ? value.trim() : "";

  if (!text) {
    return "";
  }

  if (unsupportedCharacters.test(text)) {
    return text;
  }

  const brazilPrefix = internationalBrazilPrefix.exec(text);

  if (brazilPrefix) {
    const localDigits = onlyDigits(text.slice(brazilPrefix[0].length));
    const isComplete =
      (localDigits.length === 10 || localDigits.length === 11) &&
      !localDigits.startsWith("0");

    return isComplete ? formatPhone(text) : text;
  }

  if (text.startsWith("+")) {
    return text;
  }

  const digits = onlyDigits(text);
  const isComplete =
    (digits.length === 10 || digits.length === 11) && !digits.startsWith("0");

  return isComplete ? formatPhone(text) : text;
}

export function phoneDigits(value: string | null | undefined): string {
  return typeof value === "string" ? onlyDigits(value) : "";
}
