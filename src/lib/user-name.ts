export const MAX_USER_NAME_LENGTH = 80;

export function normalizeUserName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function validateUserName(value: unknown): string | null {
  if (typeof value !== "string") return "Nome do usuário inválido.";
  if (normalizeUserName(value).length > MAX_USER_NAME_LENGTH)
    return `O nome do usuário deve ter no máximo ${MAX_USER_NAME_LENGTH} caracteres.`;
  return null;
}
