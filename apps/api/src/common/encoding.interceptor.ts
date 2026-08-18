import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class EncodingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data: any) => {
        // The response is handled by NestJS/Express which sets Content-Type
        // This interceptor ensures the data passes through without alteration
        // charset encoding is handled at the Express/NestJS level
        return data;
      }),
    );
  }
}