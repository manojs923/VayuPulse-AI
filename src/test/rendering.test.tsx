// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';

describe('AppShell Component Rendering & WCAG Accessibility', () => {
  it('renders application header and branding', () => {
    render(<AppShell />);
    expect(screen.getByRole('heading', { name: /VayuPulse AI/i, level: 1 })).toBeDefined();
  });

  it('displays the persistent simulated-data banner', () => {
    render(<AppShell />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/simulated data/i);
  });

  it('displays the medical disclaimer on health screens', () => {
    render(<AppShell />);
    const notices = screen.getAllByRole('note');
    expect(notices.length).toBeGreaterThanOrEqual(1);
    expect(notices[0]?.textContent).toContain('Informational only, not medical advice');
  });

  it('renders WCAG 2.2 AA accessible tabs with proper ARIA attributes', () => {
    render(<AppShell />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeDefined();

    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5);

    // Initial selected tab
    const telemetryTab = screen.getByRole('tab', { name: /Telemetry & ML Forecast/i });
    expect(telemetryTab.getAttribute('aria-selected')).toBe('true');
  });

  it('renders screen reader twins (.sr-only) for SVG charts and tables', () => {
    const { container } = render(<AppShell />);
    const srOnlyElements = container.querySelectorAll('.sr-only');
    expect(srOnlyElements.length).toBeGreaterThanOrEqual(2);
  });

  it('switches tabs and displays corresponding module content when clicked', () => {
    render(<AppShell />);

    // Click Clean-Corridor Transit tab
    const transitTab = screen.getByRole('tab', { name: /Clean-Corridor Transit/i });
    fireEvent.click(transitTab);

    expect(transitTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Clean-Corridor Dijkstra Lowest-Exposure Transit Router/i)).toBeDefined();

    // Click IAQ & Filtration Lab tab
    const iaqTab = screen.getByRole('tab', { name: /IAQ & Filtration Lab/i });
    fireEvent.click(iaqTab);

    expect(iaqTab.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText(/Indoor Air Quality \(IAQ\) & Low-Cost DIY Filtration Lab/i)).toBeDefined();
  });
});
