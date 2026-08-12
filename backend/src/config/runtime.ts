export interface BackendRuntimeConfig {
  readonly databaseUrl: string;
  readonly http: {
    readonly storeCors: string;
    readonly adminCors: string;
    readonly authCors: string;
    readonly jwtSecret: string;
    readonly cookieSecret: string;
  };
}

type RuntimeEnvironment = Readonly<Record<string, string | undefined>>;

const requiredEnvironmentVariables = [
  "DATABASE_URL",
  "JWT_SECRET",
  "COOKIE_SECRET",
  "STORE_CORS",
  "ADMIN_CORS",
  "AUTH_CORS",
] as const;

function requireEnvironmentValue(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required backend environment variable: ${name}`);
  }

  return value;
}

/**
 * Read the backend's deployment-supplied configuration without adding
 * environment-specific defaults to the application image.
 */
export function readBackendRuntimeConfig(environment: RuntimeEnvironment): BackendRuntimeConfig {
  for (const name of requiredEnvironmentVariables) {
    requireEnvironmentValue(environment, name);
  }

  return {
    databaseUrl: requireEnvironmentValue(environment, "DATABASE_URL"),
    http: {
      storeCors: requireEnvironmentValue(environment, "STORE_CORS"),
      adminCors: requireEnvironmentValue(environment, "ADMIN_CORS"),
      authCors: requireEnvironmentValue(environment, "AUTH_CORS"),
      jwtSecret: requireEnvironmentValue(environment, "JWT_SECRET"),
      cookieSecret: requireEnvironmentValue(environment, "COOKIE_SECRET"),
    },
  };
}
