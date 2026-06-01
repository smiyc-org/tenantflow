import nodemailer from 'nodemailer';

export interface EmailConfig {
  // Graph-based sending (preferred)
  graphAccessToken?: string;
  fromAddress: string;
  // SMTP fallback
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
}

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
}

export class EmailSender {
  private transport: nodemailer.Transporter | null = null;

  constructor(private config: EmailConfig) {
    if (config.smtpHost) {
      this.transport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort ?? 587,
        secure: false,
        auth: config.smtpUser
          ? { user: config.smtpUser, pass: config.smtpPassword }
          : undefined,
      });
    }
  }

  async send(msg: EmailMessage): Promise<void> {
    if (this.config.graphAccessToken) {
      await this.sendViaGraph(msg);
    } else if (this.transport) {
      await this.sendViaSmtp(msg);
    } else {
      throw new Error('No email transport configured');
    }
  }

  private async sendViaGraph(msg: EmailMessage): Promise<void> {
    const payload = {
      message: {
        subject: msg.subject,
        body: { contentType: 'HTML', content: msg.html },
        toRecipients: msg.to.map((addr) => ({
          emailAddress: { address: addr },
        })),
        attachments: msg.attachments?.map((a) => ({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: a.filename,
          contentType: a.contentType,
          contentBytes: Buffer.from(a.content).toString('base64'),
        })),
      },
      saveToSentItems: false,
    };

    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${this.config.fromAddress}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.graphAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph SendMail failed (${res.status}): ${text}`);
    }
  }

  private async sendViaSmtp(msg: EmailMessage): Promise<void> {
    await this.transport!.sendMail({
      from: this.config.fromAddress,
      to: msg.to.join(', '),
      subject: msg.subject,
      html: msg.html,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
  }
}
