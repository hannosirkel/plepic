import type { NotificationTypes } from "@medusajs/framework/types";
import { AbstractNotificationProviderService } from "@medusajs/framework/utils";
import nodemailer, { type Transporter } from "nodemailer";

export const SMTP_NOTIFICATION_PROVIDER_ID = "plepic-smtp";

export interface SmtpOptions {
  readonly host: string;
  readonly port: 587;
  readonly tlsServername?: string;
  readonly username: string;
  readonly password: string;
  readonly fromName: string;
  readonly envelopeFrom: string;
}

export interface MailMessage {
  readonly to: string;
  readonly replyTo?: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

type TransportFactory = (options: SmtpSender["transportOptions"]) => Pick<Transporter, "sendMail">;

export class SmtpSender {
  readonly transportOptions;
  readonly #transport: Pick<Transporter, "sendMail">;
  readonly #fromName: string;
  readonly #envelopeFrom: string;

  constructor(options: SmtpOptions, transportFactory: TransportFactory = nodemailer.createTransport) {
    this.transportOptions = {
      host: options.host,
      port: options.port,
      secure: false,
      requireTLS: true,
      auth: { user: options.username, pass: options.password },
      tls: {
        rejectUnauthorized: true,
        minVersion: "TLSv1.2",
        ...(options.tlsServername ? { servername: options.tlsServername } : {}),
      },
    } as const;
    this.#transport = transportFactory(this.transportOptions);
    this.#fromName = options.fromName;
    this.#envelopeFrom = options.envelopeFrom;
  }

  async send(message: MailMessage): Promise<{ id?: string }> {
    try {
      const result = await this.#transport.sendMail({
        from: { name: this.#fromName, address: this.#envelopeFrom },
        envelope: { from: this.#envelopeFrom, to: message.to },
        ...message,
      });
      return { id: typeof result.messageId === "string" ? result.messageId : undefined };
    } catch {
      throw new Error("Unable to send email notification");
    }
  }
}

export default class SmtpNotificationProvider extends AbstractNotificationProviderService {
  static identifier = SMTP_NOTIFICATION_PROVIDER_ID;
  readonly #sender: SmtpSender;

  constructor(_container: Record<string, unknown>, options: SmtpOptions, sender?: SmtpSender) {
    super();
    this.#sender = sender ?? new SmtpSender(options);
  }

  async send(notification: NotificationTypes.ProviderSendNotificationDTO) {
    if (notification.channel !== "email" || !notification.content) {
      throw new Error("SMTP notification requires email content");
    }

    if (typeof notification.content.subject !== "string") {
      throw new Error("SMTP notification requires a subject");
    }

    return this.#sender.send({
      to: notification.to,
      subject: notification.content.subject,
      text: notification.content.text ?? "",
      html: notification.content.html ?? "",
    });
  }
}
