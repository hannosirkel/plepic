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
  readonly smtp: {
    readonly host: string;
    readonly port: 587;
    readonly username: string;
    readonly password: string;
    readonly envelopeFrom: string;
  };
  readonly contactMailRecipient: string;
  readonly turnstileSecretKey: string;
  readonly orderConfirmationLegal: OrderConfirmationLegalConfig;
}

export interface OrderConfirmationLegalConfig {
  readonly merchantLegalName: string;
  readonly merchantRegisteredAddress: string;
  readonly merchantContactAddress: string;
  readonly returnAddress: string;
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
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "SMTP_ENVELOPE_FROM",
  "CONTACT_MAIL_RECIPIENT",
  "TURNSTILE_SECRET_KEY",
  "MERCHANT_LEGAL_NAME",
  "MERCHANT_REGISTERED_ADDRESS",
  "MERCHANT_CONTACT_ADDRESS",
  "MERCHANT_RETURN_ADDRESS",
] as const;

function requireEnvironmentValue(environment: RuntimeEnvironment, name: string): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required backend environment variable: ${name}`);
  }

  return value;
}

function requireEmailAddress(environment: RuntimeEnvironment, name: string): string {
  const value = requireEnvironmentValue(environment, name);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || /[\r\n]/.test(value)) {
    throw new Error(`${name} must be a single email address`);
  }
  return value;
}

function requireSingleLineValue(environment: RuntimeEnvironment, name: string): string {
  const value = requireEnvironmentValue(environment, name);
  if (/[\r\n]/.test(value)) {
    throw new Error(`${name} must be a single line`);
  }
  return value;
}

export function readOrderConfirmationLegalConfig(
  environment: RuntimeEnvironment,
): OrderConfirmationLegalConfig {
  return {
    merchantLegalName: requireSingleLineValue(environment, "MERCHANT_LEGAL_NAME"),
    merchantRegisteredAddress: requireSingleLineValue(
      environment,
      "MERCHANT_REGISTERED_ADDRESS",
    ),
    merchantContactAddress: requireEmailAddress(environment, "MERCHANT_CONTACT_ADDRESS"),
    returnAddress: requireSingleLineValue(environment, "MERCHANT_RETURN_ADDRESS"),
  };
}

/**
 * Read the backend's deployment-supplied configuration without adding
 * environment-specific defaults to the application image.
 */
export function readBackendRuntimeConfig(environment: RuntimeEnvironment): BackendRuntimeConfig {
  for (const name of requiredEnvironmentVariables) {
    requireEnvironmentValue(environment, name);
  }

  const smtpPort = requireEnvironmentValue(environment, "SMTP_PORT");

  if (smtpPort !== "587") {
    throw new Error("SMTP_PORT must be exactly 587 for STARTTLS submission");
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
    smtp: {
      host: requireEnvironmentValue(environment, "SMTP_HOST"),
      port: 587,
      username: requireEnvironmentValue(environment, "SMTP_USERNAME"),
      password: requireEnvironmentValue(environment, "SMTP_PASSWORD"),
      envelopeFrom: requireEmailAddress(environment, "SMTP_ENVELOPE_FROM"),
    },
    contactMailRecipient: requireEmailAddress(environment, "CONTACT_MAIL_RECIPIENT"),
    turnstileSecretKey: requireEnvironmentValue(environment, "TURNSTILE_SECRET_KEY"),
    orderConfirmationLegal: readOrderConfirmationLegalConfig(environment),
  };
}
