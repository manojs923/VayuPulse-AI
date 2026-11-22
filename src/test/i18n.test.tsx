// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from '../lib/i18n/translations';

describe('Internationalization & Multilingual UI (i18n)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('provides all 8 required language configurations', () => {
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain('en');
    expect(codes).toContain('hi');
    expect(codes).toContain('kn'); // Kannada
    expect(codes).toContain('ta'); // Tamil
    expect(codes).toContain('te'); // Telugu
    expect(codes).toContain('ar'); // Arabic
    expect(codes).toContain('ur'); // Urdu
    expect(codes).toContain('es'); // Spanish
    expect(SUPPORTED_LANGUAGES.length).toBe(8);
  });

  it('renders language selector in header with default English', () => {
    render(<AppShell />);
    const select = screen.getByRole('combobox', { name: /Select Application Language/i }) as HTMLSelectElement;
    expect(select).toBeDefined();
    expect(select.value).toBe('en');

    // Default English tab labels
    expect(screen.getByRole('tab', { name: /Telemetry & ML Forecast/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Agentic Routine Optimizer/i })).toBeDefined();
  });

  it('switches entire UI to Kannada (kn) when selected', () => {
    render(<AppShell />);
    const select = screen.getByRole('combobox', { name: /Select Application Language/i });

    fireEvent.change(select, { target: { value: 'kn' } });

    // Kannada tab labels
    expect(screen.getByRole('tab', { name: /ಟೆಲಿಮೆಟ್ರಿ & ML ಮುನ್ಸೂಚನೆ/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /ಏಜೆಂಟಿಕ್ ದಿನಚರಿ ಆಪ್ಟಿಮೈಜರ್/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /ಸ್ವಚ್ಛ-ಕಾರಿಡಾರ್ ಸಾರಿಗೆ/i })).toBeDefined();

    // Kannada header & copilot button
    expect(screen.getByText(/ಕ್ಲೀನ್-ಏರ್ ಕೋಪೈಲಟ್/i)).toBeDefined();
    expect(screen.getByText(/ಮಾದರಿ ಕಾರ್ಡ್/i)).toBeDefined();

    // Check localStorage persistence
    expect(window.localStorage.getItem('vayupulse_language')).toBe('kn');
  });

  it('switches entire UI to Hindi (hi) when selected', () => {
    render(<AppShell />);
    const select = screen.getByRole('combobox', { name: /Select Application Language/i });

    fireEvent.change(select, { target: { value: 'hi' } });

    // Hindi tab labels
    expect(screen.getByRole('tab', { name: /टेलीमेट्री और एमएल पूर्वानुमान/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /एजेंटिक रूटीन ऑप्टिमाइज़र/i })).toBeDefined();
    expect(screen.getByText(/क्लीन-एयर कोपायलٹ|क्लीन-एयर कोपायलट/i)).toBeDefined();
  });

  it('activates RTL layout direction when Arabic (ar) is selected', () => {
    const { container } = render(<AppShell />);
    const select = screen.getByRole('combobox', { name: /Select Application Language/i });

    fireEvent.change(select, { target: { value: 'ar' } });

    // Direction should be rtl on the container/document
    const rtlContainer = container.querySelector('[dir="rtl"]');
    expect(rtlContainer).not.toBeNull();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    // Arabic navigation tab
    expect(screen.getByRole('tab', { name: /القياس عن بُعد وتوقعات التعلم الآلي/i })).toBeDefined();
  });

  it('activates RTL layout direction when Urdu (ur) is selected', () => {
    const { container } = render(<AppShell />);
    const select = screen.getByRole('combobox', { name: /Select Application Language/i });

    fireEvent.change(select, { target: { value: 'ur' } });

    const rtlContainer = container.querySelector('[dir="rtl"]');
    expect(rtlContainer).not.toBeNull();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ur');

    // Urdu navigation tab
    expect(screen.getByRole('tab', { name: /ٹیلی میٹری اور ایم ایل پیشن گوئی/i })).toBeDefined();
  });

  it('ensures all translation dictionaries have matching keys', () => {
    const enKeys = Object.keys(TRANSLATIONS.en) as (keyof typeof TRANSLATIONS.en)[];
    for (const lang of SUPPORTED_LANGUAGES) {
      const trans = TRANSLATIONS[lang.code];
      expect(trans).toBeDefined();
      for (const key of enKeys) {
        expect(trans[key]).toBeDefined();
      }
    }
  });
});
