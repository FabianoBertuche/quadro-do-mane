import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  /**
   * File upload stub — to be connected to S3-compatible storage.
   * In production, this would use @aws-sdk/client-s3 or similar.
   */
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
    // TODO: Upload buffer to S3 and get file path
    const filePath = `uploads/${params.tenantId}/${Date.now()}-${params.fileName}`;

    this.logger.log(`File would be uploaded to: ${filePath}`);

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
