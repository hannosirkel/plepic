import { ConfigError } from "../config/env.js";

const EUR_MINOR_SCALE = 100;
const ROUNDING_TOLERANCE = 1e-8;

function requireEuro(currency: string): void {
  if (currency.toUpperCase() !== "EUR") {
    throw new ConfigError("Medusa returned an unsupported money currency");
  }
}

/** Converts Medusa v2 major-unit EUR values into the UI's integer-cent model. */
export function medusaMajorToMinor(value: unknown, currency: string): number {
  requireEuro(currency);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ConfigError("Medusa returned an unusable money amount");
  }
  const scaled = value * EUR_MINOR_SCALE;
  const rounded = Math.round(scaled);
  if (!Number.isSafeInteger(rounded) || Math.abs(scaled - rounded) > ROUNDING_TOLERANCE) {
    throw new ConfigError("Medusa returned an unusable money amount");
  }
  return rounded;
}

/** Converts the UI's integer-cent model to Medusa v2 major-unit EUR values. */
export function minorToMedusaMajor(value: unknown, currency: string): number {
  requireEuro(currency);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new ConfigError("The checkout has an unusable money amount");
  }
  return value / EUR_MINOR_SCALE;
}
