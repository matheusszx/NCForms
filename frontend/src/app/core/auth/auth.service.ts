import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';

import { AuthResponse, User } from '../models';

const STORAGE_KEY = 'ncforms.session';

interface Session {
  token: string;
  expiresAt: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(readStoredSession());

  readonly user = computed(() => this.session()?.user ?? null);

  /** Token válido (não expirado) ou null. Sessões expiradas são descartadas. */
  token(): string | null {
    const session = this.session();
    if (!session) {
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.clear();
      return null;
    }
    return session.token;
  }

  isLoggedIn(): boolean {
    return this.token() !== null;
  }

  registrationEnabled(): Observable<boolean> {
    return this.http
      .get<{ registrationEnabled: boolean }>('/api/auth/config')
      .pipe(map((c) => c.registrationEnabled));
  }

  login(email: string, password: string): Observable<void> {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((r) => this.store(r)), map(() => undefined));
  }

  register(name: string, email: string, password: string): Observable<void> {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((r) => this.store(r)), map(() => undefined));
  }

  logout(): void {
    this.clear();
    void this.router.navigate(['/login']);
  }

  /** Chamado quando a API responde 401: encerra a sessão e volta ao login. */
  handleUnauthorized(): void {
    if (!this.session()) {
      return;
    }
    this.clear();
    void this.router.navigate(['/login'], { queryParams: { expired: 1 } });
  }

  private store(response: AuthResponse): void {
    const session: Session = { token: response.token, expiresAt: response.expiresAt, user: response.user };
    this.session.set(session);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Armazenamento indisponível (modo privado): mantém a sessão só em memória.
    }
  }

  private clear(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignora
    }
  }
}

function readStoredSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
