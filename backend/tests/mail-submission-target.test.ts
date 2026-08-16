import { readFileSync } from "node:fs";
import { join } from "node:path";

import nodemailer from "nodemailer";
import { describe, expect, it, vi } from "vitest";

import { SmtpSender, type SmtpOptions } from "../src/notifications/smtp.js";
import { readBackendRuntimeConfig } from "../src/config/runtime.js";
import { notificationModule } from "../src/config/notification.js";

/**
 * "Mail is only submitted to the configured host, and never to port 25."
 *
 * Both halves were narrower than the row reads — but not as narrow as an
 * earlier revision of this comment claimed, and the correction matters more
 * than the tests it justifies.
 *
 * The port half genuinely rested on one string comparison in
 * `readBackendRuntimeConfig`, exercised with the single value `"25"`.
 *
 * The host half was **already covered**. The earlier claim here — that it
 * "rested on nothing at all", because the only assertion read
 * `sender.transportOptions` while the factory was handed a `() => transport`
 * that discards its argument — is false. `smtp.ts` assigns that field and then
 * passes **the same object reference** to `transportFactory(...)`, so an
 * assertion on the field is an assertion on the factory's argument; and
 * `order-confirmation.test.ts` › "uses strict STARTTLS transport settings and
 * converts email DTO content into SMTP mail" asserts its full shape, `host`
 * included. A sender built with `direct: true` — the nodemailer setting that
 * turns submission into MX-lookup delivery straight to the Internet on port
 * 25, which is exactly what the deploys manifests deny at the network level —
 * would have failed that assertion, not passed it.
 *
 * What is left for this file is real but marginal, and is worth having on
 * those terms: field and argument are one object today by a single line of
 * `smtp.ts`, so the first test below asserts that identity explicitly and the
 * rest read the captured argument, which keeps them pointed at what the
 * transport is actually built from if that line ever changes. Alongside that
 * it names the nodemailer settings that would route mail elsewhere, and
 * broadens the port coverage from one spelling to twelve: ten refused
 * (`"25"`, `" 25"`, `"025"`, `"465"`, `"2525"`, `"1025"`, `"0587"`, `"587a"`,
 * `""`, `"smtp"`) and two accepted (`"587"` and `" 587 "`, the second there to
 * pin that trimming is what refuses `" 25"`).
 */

const smtpOptions: SmtpOptions = {
  host: "smtp.example.test",
  port: 587,
  username: "smtp-user",
  password: "smtp-password",
  envelopeFrom: "orders@example.test",
};

function captureTransportOptions(options: SmtpOptions): Record<string, unknown> {
  const factory = vi.fn().mockReturnValue({ sendMail: vi.fn() });
  new SmtpSender(options, factory as never);
  expect(factory).toHaveBeenCalledOnce();
  return (factory.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
}

describe("the transport is built for the configured submission host", () => {
  it("hands the factory the configured host and port, not a copy kept on the side", () => {
    const captured = captureTransportOptions(smtpOptions);

    expect(captured).toEqual({
      host: "smtp.example.test",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: "smtp-user", pass: "smtp-password" },
      tls: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
    });
  });

  it("follows the configured host when it changes, rather than a constant", () => {
    const captured = captureTransportOptions({ ...smtpOptions, host: "submission.other.test" });
    expect(captured.host).toBe("submission.other.test");
  });

  /**
   * The negative that matters. `toEqual` above already forbids an extra key,
   * but naming these makes the failure legible: each one is a documented
   * nodemailer setting that would take mail somewhere other than the
   * configured submission host.
   */
  it("declares no setting that would deliver mail anywhere but that host", () => {
    const captured = captureTransportOptions(smtpOptions);

    for (const forbidden of ["direct", "sendmail", "service", "url", "proxy", "socket", "streamTransport", "jsonTransport"]) {
      expect(Object.hasOwn(captured, forbidden), `transport declares "${forbidden}"`).toBe(false);
    }
  });

  it("requires STARTTLS with a verified certificate, so a downgrade is not a silent one", () => {
    const captured = captureTransportOptions(smtpOptions);
    expect(captured.requireTLS).toBe(true);
    expect(captured.secure).toBe(false);
    expect(captured.tls).toEqual({ rejectUnauthorized: true, minVersion: "TLSv1.2" });
  });

  /**
   * The field and the factory's argument are one object, which is why
   * `order-confirmation.test.ts` asserting on `sender.transportOptions` was
   * always an assertion about the transport rather than about a copy kept
   * beside it. Stated here so that a refactor separating the two fails a test
   * instead of silently invalidating that one.
   */
  it("hands the factory the very object it exposes, not a snapshot of it", () => {
    const factory = vi.fn().mockReturnValue({ sendMail: vi.fn() });
    const sender = new SmtpSender(smtpOptions, factory as never);

    expect(factory.mock.calls[0]?.[0]).toBe(sender.transportOptions);
  });

  /**
   * The default factory, driven rather than grepped. A previous revision
   * asserted the source text `transportFactory: TransportFactory =
   * nodemailer.createTransport`, which any reformatting breaks and which
   * states nothing about behaviour — the pattern this repository's test
   * guidance warns about.
   *
   * Driving it is possible because the default is a *default parameter*, read
   * off the module object on each construction, so a spy installed there
   * observes the real wiring. `createTransport` is also inert: nodemailer
   * builds a `Transporter` and opens no socket until `sendMail`, so nothing
   * here can reach the network. It is stubbed anyway, since a real transporter
   * would keep a pool alive past the test.
   */
  it("defaults to nodemailer's own createTransport, called with the configured options", () => {
    const spy = vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn(),
    } as never);

    try {
      const sender = new SmtpSender(smtpOptions);

      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0]?.[0]).toBe(sender.transportOptions);
      expect(spy.mock.calls[0]?.[0]).toMatchObject({ host: "smtp.example.test", port: 587 });
    } finally {
      spy.mockRestore();
    }
  });

  /**
   * A negative source scan rather than a restatement of one: no spelling of
   * `process.env` in this module, so nothing can redirect mail at runtime
   * behind the validated configuration's back.
   */
  it("reads no environment of its own", () => {
    const source = readFileSync(join(__dirname, "..", "src", "notifications", "smtp.ts"), "utf8");
    expect(source).not.toContain("process.env");
  });
});

describe("port 25 cannot be configured, by any spelling of it", () => {
  const environment = {
    DATABASE_URL: "postgres://app:password@database:5432/medusa",
    JWT_SECRET: "jwt",
    COOKIE_SECRET: "cookie",
    STORE_CORS: "",
    ADMIN_CORS: "",
    AUTH_CORS: "",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec",
    STRIPE_PAYMENT_METHOD_CONFIGURATION_ID: "pmc",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "587",
    SMTP_USERNAME: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    SMTP_ENVELOPE_FROM: "orders@example.test",
    CONTACT_MAIL_RECIPIENT: "contact@example.test",
    TURNSTILE_SECRET_KEY: "turnstile",
    MERCHANT_LEGAL_NAME: "Example Games OU",
    MERCHANT_REGISTERED_ADDRESS: "Example Street 1, Tallinn",
    MERCHANT_CONTACT_ADDRESS: "legal@example.test",
    MERCHANT_RETURN_ADDRESS: "Return Street 2, Tallinn",
  } as const;

  it("accepts submission and nothing else", () => {
    expect(readBackendRuntimeConfig({ ...environment }).smtp.port).toBe(587);

    // `requireEnvironmentValue` trims, so surrounding whitespace is not a
    // different port — asserted rather than assumed, because it is also why
    // `" 25"` below is refused rather than slipping past a literal compare.
    expect(readBackendRuntimeConfig({ ...environment, SMTP_PORT: " 587 " }).smtp.port).toBe(587);

    for (const port of ["25", " 25", "025", "465", "2525", "1025", "0587", "587a", "", "smtp"]) {
      expect(
        () => readBackendRuntimeConfig({ ...environment, SMTP_PORT: port }),
        `SMTP_PORT=${JSON.stringify(port)} was accepted`,
      ).toThrow();
    }
  });

  it("carries the validated host and port through to the notification module unchanged", () => {
    const runtime = readBackendRuntimeConfig({ ...environment });
    const module = notificationModule(runtime.smtp);
    const options = module.options.providers[0]?.options as Record<string, unknown>;

    expect(options.host).toBe("smtp.example.test");
    expect(options.port).toBe(587);
    expect(captureTransportOptions(runtime.smtp).host).toBe("smtp.example.test");
  });
});
