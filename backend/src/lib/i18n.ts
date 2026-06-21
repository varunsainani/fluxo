// Backend message catalog. Full key parity across en / es / pt.
// Used to localize error/validation messages by req.locale.

export type Locale = "en" | "es" | "pt";

export const LOCALES: Locale[] = ["en", "es", "pt"];

type Catalog = Record<string, string>;

const en: Catalog = {
  // Generic errors (SPEC §7 codes)
  "error.validation": "The submitted data is invalid.",
  "error.unauthorized": "You must be signed in to do that.",
  "error.forbidden": "You don't have permission to do that.",
  "error.notFound": "Resource not found.",
  "error.conflict": "That resource already exists.",
  "error.workflowInactive": "This workflow is not active.",
  "error.rateLimited": "Too many requests. Please slow down.",
  "error.internal": "Something went wrong on our end.",

  // Auth
  "auth.invalidCredentials": "Invalid email or password.",
  "auth.emailTaken": "An account with that email already exists.",
  "auth.tokenMissing": "Authentication token is missing.",
  "auth.tokenInvalid": "Your session is invalid or has expired.",
  "auth.refreshMissing": "No refresh session found.",
  "auth.refreshInvalid": "Your session has expired. Please sign in again.",
  "auth.adminOnly": "This area is restricted to administrators.",
  "auth.demoUnavailable": "The demo account is not available.",
  "auth.demoInvalidRole": "Unknown demo role requested.",

  // Resources
  "workflow.notFound": "Workflow not found.",
  "execution.notFound": "Execution not found.",
  "datastore.notFound": "Datastore not found.",
  "datastore.nameTaken": "A datastore with that name already exists.",
  "notification.notFound": "Notification not found.",
  "connection.notFound": "Connection not found.",
  "connection.nameTaken": "A connection with that name already exists.",
  "user.notFound": "User not found.",

  // Validation field messages
  "validation.required": "This field is required.",
  "validation.email": "Enter a valid email address.",
  "validation.minLength": "Must be at least {min} characters.",
  "validation.maxLength": "Must be at most {max} characters.",
  "validation.string": "Must be text.",
  "validation.number": "Must be a number.",
  "validation.boolean": "Must be true or false.",
  "validation.object": "Must be an object.",
  "validation.array": "Must be a list.",
  "validation.enum": "Must be one of the allowed values.",
  "validation.json": "Must be valid JSON.",
};

const es: Catalog = {
  "error.validation": "Los datos enviados no son válidos.",
  "error.unauthorized": "Debes iniciar sesión para hacer eso.",
  "error.forbidden": "No tienes permiso para hacer eso.",
  "error.notFound": "Recurso no encontrado.",
  "error.conflict": "Ese recurso ya existe.",
  "error.workflowInactive": "Este flujo de trabajo no está activo.",
  "error.rateLimited": "Demasiadas solicitudes. Reduce el ritmo.",
  "error.internal": "Algo salió mal de nuestro lado.",

  "auth.invalidCredentials": "Correo o contraseña incorrectos.",
  "auth.emailTaken": "Ya existe una cuenta con ese correo.",
  "auth.tokenMissing": "Falta el token de autenticación.",
  "auth.tokenInvalid": "Tu sesión no es válida o ha expirado.",
  "auth.refreshMissing": "No se encontró ninguna sesión.",
  "auth.refreshInvalid": "Tu sesión ha expirado. Vuelve a iniciar sesión.",
  "auth.adminOnly": "Esta área está restringida a administradores.",
  "auth.demoUnavailable": "La cuenta de demostración no está disponible.",
  "auth.demoInvalidRole": "Rol de demostración desconocido.",

  "workflow.notFound": "Flujo de trabajo no encontrado.",
  "execution.notFound": "Ejecución no encontrada.",
  "datastore.notFound": "Almacén de datos no encontrado.",
  "datastore.nameTaken": "Ya existe un almacén de datos con ese nombre.",
  "notification.notFound": "Notificación no encontrada.",
  "connection.notFound": "Conexión no encontrada.",
  "connection.nameTaken": "Ya existe una conexión con ese nombre.",
  "user.notFound": "Usuario no encontrado.",

  "validation.required": "Este campo es obligatorio.",
  "validation.email": "Introduce un correo electrónico válido.",
  "validation.minLength": "Debe tener al menos {min} caracteres.",
  "validation.maxLength": "Debe tener como máximo {max} caracteres.",
  "validation.string": "Debe ser texto.",
  "validation.number": "Debe ser un número.",
  "validation.boolean": "Debe ser verdadero o falso.",
  "validation.object": "Debe ser un objeto.",
  "validation.array": "Debe ser una lista.",
  "validation.enum": "Debe ser uno de los valores permitidos.",
  "validation.json": "Debe ser un JSON válido.",
};

const pt: Catalog = {
  "error.validation": "Os dados enviados são inválidos.",
  "error.unauthorized": "Você precisa estar autenticado para fazer isso.",
  "error.forbidden": "Você não tem permissão para fazer isso.",
  "error.notFound": "Recurso não encontrado.",
  "error.conflict": "Esse recurso já existe.",
  "error.workflowInactive": "Este fluxo de trabalho não está ativo.",
  "error.rateLimited": "Muitas solicitações. Diminua o ritmo.",
  "error.internal": "Algo deu errado do nosso lado.",

  "auth.invalidCredentials": "E-mail ou senha inválidos.",
  "auth.emailTaken": "Já existe uma conta com esse e-mail.",
  "auth.tokenMissing": "O token de autenticação está ausente.",
  "auth.tokenInvalid": "Sua sessão é inválida ou expirou.",
  "auth.refreshMissing": "Nenhuma sessão encontrada.",
  "auth.refreshInvalid": "Sua sessão expirou. Faça login novamente.",
  "auth.adminOnly": "Esta área é restrita a administradores.",
  "auth.demoUnavailable": "A conta de demonstração não está disponível.",
  "auth.demoInvalidRole": "Função de demonstração desconhecida.",

  "workflow.notFound": "Fluxo de trabalho não encontrado.",
  "execution.notFound": "Execução não encontrada.",
  "datastore.notFound": "Armazenamento de dados não encontrado.",
  "datastore.nameTaken": "Já existe um armazenamento de dados com esse nome.",
  "notification.notFound": "Notificação não encontrada.",
  "connection.notFound": "Conexão não encontrada.",
  "connection.nameTaken": "Já existe uma conexão com esse nome.",
  "user.notFound": "Usuário não encontrado.",

  "validation.required": "Este campo é obrigatório.",
  "validation.email": "Informe um endereço de e-mail válido.",
  "validation.minLength": "Deve ter pelo menos {min} caracteres.",
  "validation.maxLength": "Deve ter no máximo {max} caracteres.",
  "validation.string": "Deve ser texto.",
  "validation.number": "Deve ser um número.",
  "validation.boolean": "Deve ser verdadeiro ou falso.",
  "validation.object": "Deve ser um objeto.",
  "validation.array": "Deve ser uma lista.",
  "validation.enum": "Deve ser um dos valores permitidos.",
  "validation.json": "Deve ser um JSON válido.",
};

const catalogs: Record<Locale, Catalog> = { en, es, pt };

function interpolate(template: string, vars?: Record<string, unknown>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? "" : String(v);
  });
}

/**
 * Localize a message key. Falls back: requested locale -> en -> raw key.
 */
export function t(locale: string | undefined, key: string, vars?: Record<string, unknown>): string {
  const loc: Locale = (LOCALES as string[]).includes(locale ?? "") ? (locale as Locale) : "en";
  const template = catalogs[loc][key] ?? catalogs.en[key] ?? key;
  return interpolate(template, vars);
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}
