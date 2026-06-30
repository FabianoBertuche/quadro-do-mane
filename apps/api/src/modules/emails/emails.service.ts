import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ImapFlow, ImapFlowOptions } from 'imapflow';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { findPresetByDomain } from './domain-presets';
import {
  SetEmailPasswordDto,
  SendEmailDto,
  UpdateEmailTenantSettingsDto,
  ReplyEmailDto,
} from './dto';

/**
 * Helper tolerante para extrair o texto de um campo AddressObject do mailparser.
 *
 * O tipo declarado é `AddressObject | AddressObject[]`, mas em runtime sempre
 * recebemos o shape com `.text`. Este helper evita narrowing problemático sem
 * perder tipagem no resto do arquivo.
 */
function extractAddressText(addr: any): string | undefined {
  if (!addr) return undefined;
  if (Array.isArray(addr)) {
    return addr.map((a) => a?.text).filter(Boolean).join(', ');
  }
  return addr.text;
}

function extractAddressValue(addr: any): string | undefined {
  if (!addr) return undefined;
  const first = Array.isArray(addr) ? addr[0] : addr;
  return first?.value?.[0]?.address;
}

/**
 * Snapshot do que é necessário para abrir uma conexão IMAP ou SMTP.
 *
 * É montado pelo EmailsConfigResolver a partir de:
 *  - EmailTenantSetting (servidor — definido pelo admin)
 *  - EmailSetting do usuário (senha criptografada)
 *  - User.email (endereço do colaborador)
 */
export interface EmailSession {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  protocol: 'imap' | 'smtp';
}

/**
 * Centraliza a montagem da configuração IMAP/SMTP para o tenant + usuário.
 *
 * Mantém o EmailsService focado em IMAP/SMTP e remove duplicação entre
 * listMessages, getMessage, sendMessage, replyMessage e testConnection.
 */
@Injectable()
export class EmailsConfigResolver {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
  ) {}

  /** Retorna a config IMAP/SMTP persistida para o tenant (ou null). */
  async getTenantSettings(tenantId: string) {
    return (this.prisma as any).emailTenantSetting.findUnique({
      where: { tenantId },
    });
  }

  /** Resolve a senha descriptografada do usuário para o protocolo solicitado. */
  async getUserPassword(
    tenantUserId: string,
    protocol: 'imap' | 'smtp',
  ): Promise<string | null> {
    const row = await (this.prisma as any).emailSetting.findUnique({
      where: { tenantUserId_protocol: { tenantUserId, protocol } },
    });
    if (!row) return null;
    return this.encryption.decrypt({
      ciphertext: row.passwordCiphertext,
      iv: row.passwordIv,
      authTag: row.passwordAuthTag,
    });
  }

  /** Retorna o e-mail do usuário (campo User.email). */
  async getUserEmail(tenantUserId: string): Promise<string> {
    const tenantUser = await (this.prisma as any).tenantUser.findUnique({
      where: { id: tenantUserId },
      include: { user: { select: { email: true } } },
    });
    if (!tenantUser) throw new NotFoundException('TenantUser nao encontrado');
    return tenantUser.user.email;
  }

  /**
   * Verifica se a senha esta cadastrada para AMBOS os protocolos. Usado
   * pelo front para decidir se mostra o card de setup ou a inbox.
   */
  async getUserPasswordStatus(tenantUserId: string) {
    const imap = await (this.prisma as any).emailSetting.findUnique({
      where: { tenantUserId_protocol: { tenantUserId, protocol: 'imap' } },
      select: { id: true },
    });
    const smtp = await (this.prisma as any).emailSetting.findUnique({
      where: { tenantUserId_protocol: { tenantUserId, protocol: 'smtp' } },
      select: { id: true },
    });
    return { imapSet: !!imap, smtpSet: !!smtp };
  }

  /**
   * Monta a sessao completa (host/port/user/password) para um protocolo.
   * Lanca NotFoundException se faltar config do tenant ou senha do usuario.
   */
  async buildSession(
    tenantId: string,
    tenantUserId: string,
    protocol: 'imap' | 'smtp',
    overridePassword?: string,
  ): Promise<EmailSession> {
    const tenantCfg = await this.getTenantSettings(tenantId);
    if (!tenantCfg) {
      throw new NotFoundException(
        'Configuracao de e-mail do tenant nao definida. Peca ao admin para configurar em Configuracoes -> Empresa.',
      );
    }

    const userEmail = await this.getUserEmail(tenantUserId);
    const password =
      overridePassword ?? (await this.getUserPassword(tenantUserId, protocol));
    if (!password) {
      throw new NotFoundException(
        `Senha de ${protocol.toUpperCase()} nao cadastrada para este usuario.`,
      );
    }

    if (protocol === 'imap') {
      return {
        protocol: 'imap',
        host: tenantCfg.imapHost,
        port: tenantCfg.imapPort,
        secure: tenantCfg.imapSecure,
        user: userEmail,
        password,
      };
    }
    return {
      protocol: 'smtp',
      host: tenantCfg.smtpHost,
      port: tenantCfg.smtpPort,
      secure: tenantCfg.smtpSecure,
      user: userEmail,
      password,
    };
  }
}

/**
 * Service principal de e-mail.
 */
@Injectable()
export class EmailsService {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private resolver: EmailsConfigResolver,
  ) {}

  // SETTINGS DO TENANT

  async getTenantSettings(tenantId: string) {
    const row = await this.resolver.getTenantSettings(tenantId);
    if (!row) {
      return { configured: false, emailDomain: null, detectionMode: null };
    }
    return {
      configured: true,
      emailDomain: row.emailDomain,
      detectionMode: row.detectionMode,
      presetKey: row.presetKey,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      imapSecure: row.imapSecure,
      smtpHost: row.smtpHost,
      smtpPort: row.smtpPort,
      smtpSecure: row.smtpSecure,
      updatedAt: row.updatedAt,
    };
  }

  async upsertTenantSettings(
    tenantId: string,
    updatedByTenantUserId: string,
    dto: UpdateEmailTenantSettingsDto,
  ) {
    if (dto.detectionMode === 'PRESET') {
      const preset = findPresetByDomain(dto.emailDomain);
      if (!preset || preset.key !== dto.presetKey) {
        throw new NotFoundException(
          'Preset nao encontrado para o dominio informado. Use o modo "Personalizado" ou corrija o dominio.',
        );
      }
    }

    return (this.prisma as any).emailTenantSetting.upsert({
      where: { tenantId },
      update: {
        emailDomain: dto.emailDomain.toLowerCase(),
        detectionMode: dto.detectionMode,
        presetKey: dto.presetKey ?? null,
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpSecure: dto.smtpSecure,
        updatedByTenantUserId,
      },
      create: {
        tenantId,
        emailDomain: dto.emailDomain.toLowerCase(),
        detectionMode: dto.detectionMode,
        presetKey: dto.presetKey ?? null,
        imapHost: dto.imapHost,
        imapPort: dto.imapPort,
        imapSecure: dto.imapSecure,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpSecure: dto.smtpSecure,
        updatedByTenantUserId,
      },
    });
  }

  // SENHA DO USUARIO

  async setUserPassword(
    tenantId: string,
    tenantUserId: string,
    dto: SetEmailPasswordDto,
  ) {
    const enc = this.encryption.encrypt(dto.password);
    return (this.prisma as any).emailSetting.upsert({
      where: {
        tenantUserId_protocol: { tenantUserId, protocol: dto.protocol },
      },
      update: {
        passwordCiphertext: enc.ciphertext,
        passwordIv: enc.iv,
        passwordAuthTag: enc.authTag,
      },
      create: {
        tenantId,
        tenantUserId,
        protocol: dto.protocol,
        passwordCiphertext: enc.ciphertext,
        passwordIv: enc.iv,
        passwordAuthTag: enc.authTag,
      },
    });
  }

  async getMySettingsSnapshot(tenantId: string, tenantUserId: string) {
    const tenant = await this.resolver.getTenantSettings(tenantId);
    const passwordStatus = await this.resolver.getUserPasswordStatus(tenantUserId);
    const userEmail = await this.resolver.getUserEmail(tenantUserId);
    return {
      tenantConfigured: !!tenant,
      userEmail,
      imapConfigured: passwordStatus.imapSet,
      smtpConfigured: passwordStatus.smtpSet,
      server: tenant
        ? {
            imapHost: tenant.imapHost,
            imapPort: tenant.imapPort,
            imapSecure: tenant.imapSecure,
            smtpHost: tenant.smtpHost,
            smtpPort: tenant.smtpPort,
            smtpSecure: tenant.smtpSecure,
          }
        : null,
    };
  }

  // LISTAGEM E LEITURA

  async listMessages(tenantId: string, tenantUserId: string, folder = 'INBOX') {
    const session = await this.resolver.buildSession(tenantId, tenantUserId, 'imap');
    const client = new ImapFlow({
      host: session.host,
      port: session.port,
      secure: session.secure,
      auth: { user: session.user, pass: session.password },
      logger: false,
    } as ImapFlowOptions);

    await client.connect();
    const lock = await client.getMailboxLock(folder);
    const messages: any[] = [];

    try {
      for await (const msg of client.fetch('1:20', {
        envelope: true,
        flags: true,
      })) {
        messages.push({
          uid: msg.uid,
          subject: msg.envelope?.subject || '(Sem assunto)',
          from:
            msg.envelope?.from && msg.envelope.from[0]
              ? msg.envelope.from[0].name || msg.envelope.from[0].address
              : 'Desconhecido',
          fromAddress:
            msg.envelope?.from && msg.envelope.from[0]
              ? msg.envelope.from[0].address
              : null,
          to:
            msg.envelope?.to && msg.envelope.to[0]
              ? msg.envelope.to[0].address
              : null,
          date: msg.envelope?.date,
          flags: msg.flags,
          seen: msg.flags?.has('\\Seen') ?? false,
        });
      }
    } finally {
      lock.release();
      await client.logout();
    }

    return messages.reverse();
  }

  async getMessage(tenantId: string, tenantUserId: string, uid: string) {
    const session = await this.resolver.buildSession(tenantId, tenantUserId, 'imap');
    const client = new ImapFlow({
      host: session.host,
      port: session.port,
      secure: session.secure,
      auth: { user: session.user, pass: session.password },
      logger: false,
    } as ImapFlowOptions);

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      const msg = await client.fetchOne(uid, { source: true, envelope: true });
      if (!msg || !msg.source) throw new NotFoundException('Mensagem nao encontrada');
      const parsed = await simpleParser(msg.source);

      const messageId: string | null = parsed.messageId || null;
      const refs: string[] = [];
      if (Array.isArray((parsed as any).references)) {
        refs.push(...((parsed as any).references as string[]));
      } else if (typeof (parsed as any).references === 'string') {
        refs.push((parsed as any).references as string);
      }
      if (messageId && refs[refs.length - 1] !== messageId) {
        refs.push(messageId);
      }

      return {
        uid,
        subject: parsed.subject || '(Sem assunto)',
        from: extractAddressText(parsed.from),
        fromAddress: extractAddressValue(parsed.from) ?? null,
        to: extractAddressText(parsed.to),
        text: parsed.text,
        html: parsed.html || null,
        date: parsed.date,
        messageId,
        references: refs,
        attachmentsCount: parsed.attachments?.length ?? 0,
      };
    } finally {
      lock.release();
      await client.logout();
    }
  }

  // ENVIO

  async sendMessage(tenantId: string, tenantUserId: string, dto: SendEmailDto) {
    const session = await this.resolver.buildSession(tenantId, tenantUserId, 'smtp');
    const transporter = nodemailer.createTransport({
      host: session.host,
      port: session.port,
      secure: session.secure,
      auth: { user: session.user, pass: session.password },
    });

    return transporter.sendMail({
      from: session.user,
      to: dto.to,
      subject: dto.subject,
      text: dto.content,
    });
  }

  async replyMessage(tenantId: string, tenantUserId: string, dto: ReplyEmailDto) {
    const imapSession = await this.resolver.buildSession(tenantId, tenantUserId, 'imap');
    const smtpSession = await this.resolver.buildSession(tenantId, tenantUserId, 'smtp');

    const client = new ImapFlow({
      host: imapSession.host,
      port: imapSession.port,
      secure: imapSession.secure,
      auth: { user: imapSession.user, pass: imapSession.password },
      logger: false,
    } as ImapFlowOptions);

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let original: {
      messageId: string | null;
      references: string[];
      replyTo: string;
      subject: string;
    };

    try {
      const msg = await client.fetchOne(dto.uid, { source: true, envelope: true });
      if (!msg || !msg.source) throw new NotFoundException('Mensagem original nao encontrada');
      const parsed = await simpleParser(msg.source);

      const messageId: string | null = parsed.messageId || null;
      const refs: string[] = [];
      if (Array.isArray((parsed as any).references)) {
        refs.push(...((parsed as any).references as string[]));
      } else if (typeof (parsed as any).references === 'string') {
        refs.push((parsed as any).references as string);
      }
      if (messageId && refs[refs.length - 1] !== messageId) {
        refs.push(messageId);
      }

      const replyTo =
        extractAddressValue(parsed.replyTo) ??
        extractAddressValue(parsed.from) ??
        '';

      original = {
        messageId,
        references: refs,
        replyTo,
        subject: parsed.subject || '(Sem assunto)',
      };
    } finally {
      lock.release();
      await client.logout();
    }

    const transporter = nodemailer.createTransport({
      host: smtpSession.host,
      port: smtpSession.port,
      secure: smtpSession.secure,
      auth: { user: smtpSession.user, pass: smtpSession.password },
    });

    const subject = /^re:/i.test(original.subject)
      ? original.subject
      : `Re: ${original.subject}`;

    const headers: Record<string, string> = {
      References: original.references.join(' '),
    };
    if (original.messageId) {
      headers['In-Reply-To'] = original.messageId;
    }

    return transporter.sendMail({
      from: smtpSession.user,
      to: original.replyTo,
      subject,
      text: dto.body,
      headers,
    });
  }

  // TESTE DE CONEXAO

  async testConnection(
    tenantId: string,
    tenantUserId: string,
    password: string,
  ): Promise<{ imap: { ok: boolean; error?: string }; smtp: { ok: boolean; error?: string } }> {
    const userEmail = await this.resolver.getUserEmail(tenantUserId);
    const tenantCfg = await this.resolver.getTenantSettings(tenantId);

    if (!tenantCfg) {
      throw new NotFoundException(
        'Configure o servidor de e-mail do tenant antes de testar.',
      );
    }

    const result: any = {
      imap: { ok: false },
      smtp: { ok: false },
    };

    try {
      const imapClient = new ImapFlow({
        host: tenantCfg.imapHost,
        port: tenantCfg.imapPort,
        secure: tenantCfg.imapSecure,
        auth: { user: userEmail, pass: password },
        logger: false,
      } as ImapFlowOptions);
      await imapClient.connect();
      await imapClient.logout();
      result.imap.ok = true;
    } catch (e: any) {
      result.imap.error = e?.message ?? 'Falha desconhecida';
    }

    try {
      const transporter = nodemailer.createTransport({
        host: tenantCfg.smtpHost,
        port: tenantCfg.smtpPort,
        secure: tenantCfg.smtpSecure,
        auth: { user: userEmail, pass: password },
      });
      await transporter.verify();
      result.smtp.ok = true;
    } catch (e: any) {
      result.smtp.error = e?.message ?? 'Falha desconhecida';
    }

    return result;
  }
}
