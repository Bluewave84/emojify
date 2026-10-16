import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type CrTheme = 'dark' | 'light';

const STORAGE_KEY = 'cr-theme';

/** Einzige Stelle, die `data-theme` setzt (Regel des Designsystems). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  readonly theme = signal<CrTheme>(this.initial());

  constructor() {
    effect(() => {
      const theme = this.theme();
      this.doc.documentElement.setAttribute('data-theme', theme);
      try {
        localStorage.setItem(STORAGE_KEY, theme);
      } catch {
        // Speicher nicht verfügbar: Theme gilt nur für diese Sitzung.
      }
    });
  }

  toggle(): void {
    this.theme.update((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  set(theme: CrTheme): void {
    this.theme.set(theme);
  }

  private initial(): CrTheme {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {
      // weiter mit Systemeinstellung
    }
    const prefersLight = this.doc.defaultView?.matchMedia?.('(prefers-color-scheme: light)').matches;
    return prefersLight ? 'light' : 'dark';
  }
}
