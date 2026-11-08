export interface ServerConfig {
  frontendOrigins: string[];
  host: string;
  port: number;
}

export function readServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const configuredOrigins = (environment.FRONTEND_ORIGINS ?? environment.FRONTEND_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const rawFrontendOrigins = configuredOrigins.length > 0
    ? configuredOrigins
    : [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://127.0.0.1:4173",
      "http://localhost:4173",
    ];
  if (environment.NODE_ENV === "production" && configuredOrigins.length === 0) {
    throw new Error("FRONTEND_ORIGIN o FRONTEND_ORIGINS es obligatorio en producción");
  }
  const frontendOrigins = rawFrontendOrigins.map((origin) => {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(`Origen de frontend inválido: ${origin}`);
    }
    if (environment.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new Error(`El origen debe usar HTTPS en producción: ${origin}`);
    }
    return parsed.origin;
  });

  const port = Number(environment.PORT ?? 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT debe ser un puerto TCP válido");
  }

  return {
    frontendOrigins: [...new Set(frontendOrigins)],
    host: environment.HOST ?? "127.0.0.1",
    port,
  };
}
