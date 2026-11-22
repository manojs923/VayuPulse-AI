// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';

describe('DOM Interactions, Modals, RTL & Persona Flows', () => {
  it('opens and closes the Model Card modal', () => {
    render(<AppShell />);
    const modelCardButton = screen.getByRole('button', { name: /Model Card/i });
    fireEvent.click(modelCardButton);

    expect(screen.getByRole('dialog', { name: /Responsible AI Model Card/i })).toBeDefined();

    // Close button
    const closeBtn = screen.getByRole('button', { name: /Close Model Card/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /Responsible AI Model Card/i })).toBeNull();
  });

  it('opens and closes the Clean-Air Copilot drawer', () => {
    render(<AppShell />);
    const copilotBtn = screen.getByRole('button', { name: /Clean-Air Copilot/i });
    fireEvent.click(copilotBtn);

    expect(screen.getByRole('dialog', { name: /AI Agent Copilot Drawer/i })).toBeDefined();

    const closeBtn = screen.getByRole('button', { name: /Close Copilot Drawer/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole('dialog', { name: /AI Agent Copilot Drawer/i })).toBeNull();
  });

  it('toggles RTL direction dynamically in the Multilingual Broadcast Generator', () => {
    render(<AppShell />);

    // Switch to Community Resilience tab
    const communityTab = screen.getByRole('tab', { name: /Community Resilience/i });
    fireEvent.click(communityTab);

    // Initial language is English (LTR)
    expect(screen.getByRole('button', { name: /English/i })).toBeDefined();

    // Switch to Arabic
    const arabicBtn = screen.getByRole('button', { name: /Arabic/i });
    fireEvent.click(arabicBtn);

    // The dispatch container must have dir="rtl"
    const rtlContainer = document.querySelector('[dir="rtl"]');
    expect(rtlContainer).not.toBeNull();
    expect(rtlContainer?.getAttribute('dir')).toBe('rtl');

    // Switch to Urdu
    const urduBtn = screen.getByRole('button', { name: /Urdu/i });
    fireEvent.click(urduBtn);
    expect(document.querySelector('[dir="rtl"]')).not.toBeNull();

    // Switch back to Hindi (LTR)
    const hindiBtn = screen.getByRole('button', { name: /Hindi/i });
    fireEvent.click(hindiBtn);
    expect(document.querySelector('[dir="ltr"]')).not.toBeNull();
  });

  it('allows selecting personas in Routine Optimizer tab', () => {
    render(<AppShell />);

    // Switch to Routine tab
    const routineTab = screen.getByRole('tab', { name: /Agentic Routine Optimizer/i });
    fireEvent.click(routineTab);

    // Click Elderly Cardiac Patient persona
    const cardiacBtn = screen.getByRole('button', { name: /Elderly Cardiac Patient/i });
    fireEvent.click(cardiacBtn);

    expect(cardiacBtn.className).toContain('border-cyan-500');
  });
});
