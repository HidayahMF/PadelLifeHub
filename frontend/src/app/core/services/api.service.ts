import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http
      .get<T>(`${this.base}${path}`, { params: this.buildParams(params) })
      .pipe(catchError((err) => this.handleError(err)));
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .post<T>(`${this.base}${path}`, body ?? {})
      .pipe(catchError((err) => this.handleError(err)));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http
      .put<T>(`${this.base}${path}`, body ?? {})
      .pipe(catchError((err) => this.handleError(err)));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<T>(`${this.base}${path}`)
      .pipe(catchError((err) => this.handleError(err)));
  }

  /** Raw download (CSV/JSON export files) — auth header added by the interceptor. */
  download(path: string): Observable<Blob> {
    return this.http
      .get(`${this.base}${path}`, { responseType: 'blob' })
      .pipe(catchError((err) => this.handleError(err)));
  }

  private buildParams(params?: QueryParams): HttpParams | undefined {
    if (!params) return undefined;
    let httpParams = new HttpParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    }
    return httpParams;
  }

  private handleError(err: any): Observable<never> {
    const message = err?.error?.message ?? err?.message ?? 'Something went wrong';
    return throwError(() => new Error(message));
  }
}
