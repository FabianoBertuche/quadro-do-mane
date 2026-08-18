import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
  }

  async uploadFile(params: {
    tenantId: string;
    uploadedByTenantUserId: string;
    taskId?: string;
    projectId?: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    buffer: Buffer;
  }) {
    const tenantDir = path.join(this.uploadDir, params.tenantId);
    fs.mkdirSync(tenantDir, { recursive: true });

    const uniqueFileName = `${Date.now()}-${params.fileName}`;
    const fullFilePath = path.join(tenantDir, uniqueFileName);
    fs.writeFileSync(fullFilePath, params.buffer);

    const filePath = `uploads/${params.tenantId}/${uniqueFileName}`;

    return this.prisma.attachment.create({
      data: {
        tenantId: params.tenantId,
        taskId: params.taskId,
        projectId: params.projectId,
        uploadedByTenantUserId: params.uploadedByTenantUserId,
        fileName: params.fileName,
        filePath,
        mimeType: params.mimeType,
        fileSize: params.fileSize,
      },
    });
  }

  async getAttachments(tenantId: string, taskId?: string, projectId?: string) {
    return this.prisma.attachment.findMany({
      where: {
        tenantId,
        ...(taskId ? { taskId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        uploadedBy: { include: { user: { select: { name: true, avatarUrl: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
