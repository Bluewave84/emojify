import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';
import { ThemeService } from './ui';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('sets data-theme on the document root', async () => {
    const fixture = TestBed.createComponent(App);
    const theme = TestBed.inject(ThemeService);
    theme.set('light');
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
