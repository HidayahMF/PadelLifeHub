import { inject, Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private auth = inject(AuthService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.auth.token;
    if (token) {
      req = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
    }
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        // Token expired / invalid → clear auth state and go to login once.
        // Public auth endpoints are excluded so login failures don't loop.
        if (
          err?.status === 401 &&
          !req.url.includes('/auth/login') &&
          !req.url.includes('/auth/register') &&
          !req.url.includes('/auth/forgot-password') &&
          !req.url.includes('/auth/reset-password')
        ) {
          this.auth.handleUnauthorized();
        }
        return throwError(() => err);
      })
    );
  }
}
