import React, { useState } from 'react';
import { X, Send, Bot, Sparkles, ShieldCheck, BookOpen } from 'lucide-react';
import { sanitizeClientInput } from '../../lib/clientHeuristic';
import { routeAndAnswerCopilot } from '../../lib/copilotRouter';
import { useI18n } from '../../lib/i18n/I18nContext';

interface CopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

export const CopilotDrawer: React.FC<CopilotDrawerProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      role: 'assistant',
      content: t.copilot.welcomeMessage,
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
      const result = await routeAndAnswerCopilot(sanitized);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: result.answer,
          citations: result.citations,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Unable to process the query at this moment. Please verify ambient conditions or try again.',
        },
      ]);
    } finally {
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
          <h3 className="font-bold text-sm text-slate-100">{t.copilot.drawerTitle}</h3>
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
        <span>{t.copilot.disclaimer}</span>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed whitespace-pre-line ${
                m.role === 'user'
                  ? 'bg-cyan-500 text-slate-950 font-medium'
                  : 'bg-slate-900 border border-slate-800 text-slate-200'
              }`}
            >
              {m.content}
              {m.citations && m.citations.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <BookOpen className="w-3 h-3 text-cyan-400" />
                    {t.copilot.citationsLabel}
                  </span>
                  {m.citations.map((cite) => (
                    <span
                      key={cite}
                      className="px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 text-[10px] font-mono text-cyan-300"
                    >
                      {cite}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
            {t.copilot.synthesizing}
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t.copilot.inputPlaceholder}
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
