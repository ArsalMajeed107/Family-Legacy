import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, Trash2, AlertTriangle, Globe, RotateCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/apiClient.ts';
import { generateSafeId } from '../lib/genealogy.ts';

interface FamilyGuideWidgetProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

type LangMode = 'auto' | 'en' | 'ur' | 'roman-ur';

interface LocalMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  escalated?: boolean;
}

const QUICK_PROMPTS: { label: string; text: string }[] = [
  { label: 'How do I register?', text: 'How do I register myself or my children in Family Legacy?' },
  { label: '3D Tree Guide', text: 'How do I explore and inspect members in the 3D Family Tree?' },
  { label: 'Urdu Guide', text: 'مجھے خاندانی شجرہ نسب میں اپنا نام شامل کرنے کا طریقہ بتائیں۔' },
  {
    label: 'Roman Urdu',
    text: 'Meri registration pending kyun hai aur Family Head se kaise verify karwaun?',
  },
  { label: 'Connect Parents', text: 'How are father, mother, and spouse connections verified?' },
];

export function FamilyGuideWidget({ isOpen, onToggle }: FamilyGuideWidgetProps) {
  const { userProfile, isSignedIn, systemSettings, branches, aiMessages, getIdToken } = useAuth();
  const [language, setLanguage] = useState<LangMode>('auto');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevSignedInRef = useRef<boolean>(isSignedIn);

  const aiEnabled =
    (systemSettings?.aiAssistantEnabled ?? true) ||
    userProfile?.role === 'developer_super_admin';

  // Sync persisted conversation history when signed in; clear on logout; never clobber active turn
  useEffect(() => {
    if (!isSignedIn) {
      if (prevSignedInRef.current) {
        setMessages([]);
      }
      prevSignedInRef.current = false;
      return;
    }
    prevSignedInRef.current = true;
    if (loading) return;
    setMessages(
      aiMessages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        escalated: m.escalated,
      }))
    );
  }, [isSignedIn, aiMessages, loading]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen, errorMsg]);

  useEffect(() => {
    if (isOpen && aiEnabled) {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, aiEnabled]);

  const sendMessage = async (textToSend: string, isRetry = false) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading || !aiEnabled) return;

    if (!isRetry) {
      setInput('');
    }
    setErrorMsg(null);
    setLastFailedPrompt(null);
    setLoading(true);

    const priorTurns = messages.slice(-8).map((m) => ({
      sender: m.sender,
      text: m.text,
    }));

    if (!isRetry) {
      const userMsgId = generateSafeId('msg');
      const optimisticUser: LocalMessage = { id: userMsgId, sender: 'user', text: trimmed };
      setMessages((prev) => [...prev, optimisticUser]);

      if (isSignedIn) {
        try {
          await apiFetch('/api/ai/history', {
            method: 'POST',
            body: JSON.stringify({
              id: userMsgId,
              userId: userProfile?.uid,
              sender: 'user',
              language: language === 'auto' ? 'en' : language,
              text: trimmed,
            }),
          });
        } catch (err) {
          console.warn('Could not persist user chat turn:', err);
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 32000);

    try {
      const token = await getIdToken();
      const userBranchName = userProfile?.branchId
        ? branches.find((b) => b.id === userProfile.branchId)?.name
        : undefined;

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          language,
          history: priorTurns,
          userContext: userProfile
            ? {
                role: userProfile.role,
                accountStatus: userProfile.accountStatus,
                displayName: userProfile.displayName,
                branchName: userBranchName,
              }
            : undefined,
        }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === 'string' && data.error) ||
            `FamilyGuide AI could not respond right now (${res.status}).`
        );
      }

      const replyText =
        data && typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : '';
      if (!replyText) {
        throw new Error('FamilyGuide AI returned an empty response. Please try again.');
      }

      const aiMsgId = generateSafeId('ai');
      const aiMsg: LocalMessage = {
        id: aiMsgId,
        sender: 'assistant',
        text: replyText,
        escalated: Boolean(data?.suggestEscalation),
      };
      setMessages((prev) => [...prev, aiMsg]);

      if (isSignedIn) {
        try {
          await apiFetch('/api/ai/history', {
            method: 'POST',
            body: JSON.stringify({
              id: aiMsgId,
              userId: userProfile?.uid,
              sender: 'assistant',
              language: language === 'auto' ? 'en' : language,
              text: replyText,
              escalated: Boolean(data?.suggestEscalation),
            }),
          });
        } catch (histErr) {
          console.warn('Could not persist assistant chat turn:', histErr);
        }
      }
    } catch (err) {
      setLastFailedPrompt(trimmed);
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMsg('The request timed out. Please retry sending your question.');
      } else {
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to reach FamilyGuide AI. Please check your connection and try again.'
        );
      }
    } finally {
      window.clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    setErrorMsg(null);
    setLastFailedPrompt(null);
    setMessages([]);
    if (!isSignedIn) return;
    try {
      await apiFetch('/api/ai/history', { method: 'DELETE' });
    } catch (err) {
      console.warn('Error clearing message:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 no-print">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => onToggle(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-sky-300 hover:bg-sky-200 text-sky-950 font-semibold text-xs shadow-2xl border border-sky-100/40 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <MessageSquare className="w-4 h-4" />
          <span>FamilyGuide AI</span>
        </button>
      ) : (
        <section
          aria-label="FamilyGuide AI Assistant"
          className="w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[82vh] flex flex-col rounded-2xl border border-sky-300/30 bg-[#081736]/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-4 py-3.5 border-b border-sky-300/20 bg-[#0C214A] flex items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-base font-semibold text-white">FamilyGuide AI</h2>
              <p className="text-[11px] text-sky-300">
                English · اُردُو · Roman Urdu Support
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 rounded-lg bg-[#050F26] border border-sky-300/25 px-2 py-1">
                <Globe className="w-3.5 h-3.5 text-sky-300" />
                <select
                  aria-label="Select FamilyGuide AI language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as LangMode)}
                  className="bg-transparent text-[11px] text-sky-100 focus:outline-none"
                >
                  <option value="auto" className="bg-[#050F26]">
                    Auto
                  </option>
                  <option value="en" className="bg-[#050F26]">
                    English
                  </option>
                  <option value="ur" className="bg-[#050F26]">
                    اُردُو
                  </option>
                  <option value="roman-ur" className="bg-[#050F26]">
                    Roman Urdu
                  </option>
                </select>
              </div>

              <button
                type="button"
                aria-label="Clear chat history"
                onClick={handleClearChat}
                className="p-1.5 text-sky-200/70 hover:text-white rounded-lg hover:bg-sky-950/60 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Minimize FamilyGuide AI"
                onClick={() => onToggle(false)}
                className="p-1.5 text-sky-200/70 hover:text-white rounded-lg hover:bg-sky-950/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {!aiEnabled && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-950/40 p-3 text-xs text-amber-200">
                FamilyGuide AI has been temporarily paused by the Developer Super Admin.
              </div>
            )}

            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-sky-300/20 bg-[#050F26]/80 p-3.5 text-xs text-sky-100/90 leading-relaxed">
                  Assalam-o-Alaikum! I am <strong className="text-sky-300">FamilyGuide AI</strong>{' '}
                  on <strong className="text-sky-200">Family Legacy</strong>. Ask me about registering
                  family members, exploring the 3D &amp; 2D family tree, connecting parents and
                  children, or troubleshooting login and approval status in English, Urdu, or Roman
                  Urdu.
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] text-sky-200/70 font-medium">Quick Questions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        disabled={!aiEnabled || loading}
                        onClick={() => sendMessage(q.text)}
                        className="px-2.5 py-1.5 rounded-lg border border-sky-300/25 bg-[#050F26]/85 hover:border-sky-300/60 text-[11px] text-sky-100 hover:text-sky-200 transition-colors cursor-pointer text-left disabled:opacity-50"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  dir="auto"
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                    m.sender === 'user'
                      ? 'bg-sky-300 text-sky-950 font-medium'
                      : 'bg-[#050F26] border border-sky-300/25 text-sky-50'
                  }`}
                >
                  {m.text}
                </div>
                {m.escalated && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Recommended: Escalate to Main Family Head (Muhammad Ghulam)</span>
                  </p>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-sky-200/70 px-2 py-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-300 animate-bounce" />
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-sky-300 animate-bounce"
                  style={{ animationDelay: '120ms' }}
                />
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full bg-sky-300 animate-bounce"
                  style={{ animationDelay: '240ms' }}
                />
                <span>FamilyGuide AI is thinking...</span>
              </div>
            )}

            {errorMsg && (
              <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-3 text-xs text-rose-200 space-y-2">
                <p>{errorMsg}</p>
                {lastFailedPrompt && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => sendMessage(lastFailedPrompt, true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/25 hover:bg-rose-500/40 border border-rose-400/40 text-rose-100 font-medium cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-sky-300/20 bg-[#0C214A] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              dir="auto"
              disabled={!aiEnabled || loading}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in English, Urdu, or Roman Urdu..."
              className="flex-1 px-3.5 py-2 rounded-xl bg-[#050F26] border border-sky-300/25 text-xs text-white placeholder-sky-200/40 focus:outline-none focus:border-sky-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!aiEnabled || loading || !input.trim()}
              aria-label="Send message"
              className="p-2.5 rounded-xl bg-sky-300 hover:bg-sky-200 text-sky-950 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
}
