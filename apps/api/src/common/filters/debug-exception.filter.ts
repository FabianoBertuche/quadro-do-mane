import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class DebugExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const err = exception as any;
    if (err?.code === 'LIMIT_FILE_SIZE' || err?.message?.includes('File too large')) {
      response.status(400).json({
        statusCode: 400,
        message: 'O arquivo excede o limite máximo de 100 MB. Reduza o tamanho do arquivo e tente novamente.',
        error: 'File too large',
      });
      return;
    }

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : {
          statusCode: status,
          message: 'Internal server error',
          error: 'Internal server error',
          path: request.url?.split('?')[0],
        };

    const path = request.url?.split('?')[0] ?? 'unknown';
    console.error(`[EXCEPTION] ${request.method} ${path} status=${status}`);
    response.status(status).json(message);
  }
}
