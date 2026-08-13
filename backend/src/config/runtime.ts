export interface BackendRuntimeConfig {
  readonly databaseUrl: string;
  readonly http: {
    readonly storeCors: string;
    readonly adminCors: string;
    readonly authCors: string;
    readonly jwtSecret: string;
    readonly cookieSecret: string;
  };
  readonly stripe: {
    readonly apiKey: string;
    readonly webhookSecret: string;
    readonly paymentMethodConfiguration: string;
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
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PAYMENT_METHOD_CONFIGURATION_ID",
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
    stripe: {
      apiKey: requireEnvironmentValue(environment, "STRIPE_SECRET_KEY"),
      webhookSecret: requireEnvironmentValue(environment, "STRIPE_WEBHOOK_SECRET"),
      paymentMethodConfiguration: requireEnvironmentValue(
        environment,
        "STRIPE_PAYMENT_METHOD_CONFIGURATION_ID",
      ),
    },
  };
}
