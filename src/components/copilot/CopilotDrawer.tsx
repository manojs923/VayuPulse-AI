import React, { useState } from 'react';
import { X, Send, Bot, Sparkles, ShieldCheck } from 'lucide-react';
import { sanitizeClientInput } from '../../lib/clientHeuristic';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your VayuPulse Atmospheric Copilot. Ask me about temperature inversion dynamics, Corsi-Rosenthal DIY sizing, or safe outdoor ventilation windows.',
    },
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const sanitized = sanitizeClientInput(input);
    const userMsg: ChatMessage = { role: 'user', content: sanitized };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Simulate Copilot grounded response
      setTimeout(() => {
        let answer = 'During winter thermal inversions, surface air remains stagnant beneath a warmer upper boundary layer. Maintain continuous indoor filtration and restrict outdoor strenuous exercise.';
        if (sanitized.toLowerCase().includes('corsi') || sanitized.toLowerCase().includes('cadr')) {
          answer = 'A 4-filter Corsi-Rosenthal box ($40 build) achieves ~350 m³/h CADR with MERV-13 filters, exceeding ASHRAE 4-ACH standards in standard residential bedrooms [CR-BOX-SPEC].';
        } else if (sanitized.toLowerCase().includes('mask') || sanitized.toLowerCase().includes('n95')) {
          answer = 'NIOSH-certified N95/FFP2 respirators provide >95% sub-micron particulate filtration via electrostatic capture [N95-PHYSICS]. Cloth and surgical masks provide under 30% protection.';
        } else if (sanitized.toLowerCase().includes('window') || sanitized.toLowerCase().includes('ventilate')) {
          answer = 'Keep windows sealed between 22:00 and 10:00. Safe cross-ventilation should be restricted to the afternoon convective breakup window (12:30–15:00) [VENT-INVERSION].';
        }

        setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
        setLoading(false);
      }, 500);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Agent Copilot Drawer"
      className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-950 border-l border-slate-800 shadow-2xl flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <h3 className="font-bold text-sm text-slate-100">Clean-Air Agent Copilot</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Copilot Drawer"
          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Notice */}
      <div className="p-3 bg-cyan-950/40 border-b border-cyan-800/40 text-[11px] text-cyan-300 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>Grounded in WHO/EPA protocols. Mathematical calculations run deterministically.</span>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                m.role === 'user'
                  ? 'bg-cyan-500 text-slate-950 font-medium'
                  : 'bg-slate-900 border border-slate-800 text-slate-200'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            Synthesizing grounded response...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Copilot (e.g., Corsi box sizing)..."
          className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="p-2.5 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
