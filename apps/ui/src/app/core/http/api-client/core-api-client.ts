import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { RUNTIME_CONFIG } from '../../config/runtime-config';

/** The single HTTP gateway to sentinel-core. Feature data-access classes build on it; components never do. */
@Injectable({ providedIn: 'root' })
export class CoreApiClient {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);

  get<TResponse>(path: string): Observable<TResponse> {
    return this.http.get<TResponse>(`${this.config.coreApiBaseUrl}${path}`);
  }

  post<TResponse>(path: string, body: unknown): Observable<TResponse> {
    return this.http.post<TResponse>(`${this.config.coreApiBaseUrl}${path}`, body);
  }

  patch<TResponse>(path: string, body: unknown): Observable<TResponse> {
    return this.http.patch<TResponse>(`${this.config.coreApiBaseUrl}${path}`, body);
  }

  getBlob(path: string): Observable<Blob> {
    return this.http.get(`${this.config.coreApiBaseUrl}${path}`, { responseType: 'blob' });
  }
}
