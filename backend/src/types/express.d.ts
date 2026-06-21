import type { Locale } from "../lib/i18n";
import type { Role } from "../lib/jwt";

declare global {
  namespace Express {
    interface Request {
      locale: Locale;
      user?: { id: string; role: Role; email: string };
    }
  }
}

export {};
