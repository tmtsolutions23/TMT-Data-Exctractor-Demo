"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Copy,
  Download,
  Bot,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { VERTICALS, type VerticalConfig, type FieldDef } from "@/lib/intake-schemas";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// Parse <!--INTAKE_DATA:{...}--> from message content (use lastIndexOf for cumulative block)
function parseIntakeData(
  content: string,
  validKeys?: Set<string>
): Record<string, string> | null {
  const startMarker = "<!--INTAKE_DATA:";
  const endMarker = "-->";
  const start = content.lastIndexOf(startMarker);
  if (start === -1) return null;
  const jsonStart = start + startMarker.length;
  const end = content.indexOf(endMarker, jsonStart);
  if (end === -1) return null;
  try {
    const raw = JSON.parse(content.slice(jsonStart, end));
    if (!raw || typeof raw !== "object") return null;
    // Validate keys against schema if provided
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (validKeys && !validKeys.has(k)) continue;
      if (typeof v === "string" && v.length <= 500) {
        result[k] = v;
      }
    }
    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}

// Strip the data tag from display text (also hides partial tags during streaming)
function stripIntakeTag(content: string): string {
  // Strip complete tags
  let stripped = content.replace(/<!--INTAKE_DATA:\{[\s\S]*?\}-->/g, "");
  // Also hide partial tag that's still being streamed in
  stripped = stripped.replace(/<!--INTAKE_DATA:[\s\S]*$/, "");
  return stripped.trim();
}

export default function IntakePage() {
  const [vertical, setVertical] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [intakeData, setIntakeData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const config: VerticalConfig | null = vertical ? VERTICALS[vertical] : null;

  const validKeys = config
    ? new Set(config.schema.map((f) => f.key))
    : undefined;

  const filledCount = config
    ? config.schema.filter((f) => intakeData[f.key]).length
    : 0;
  const totalFields = config ? config.schema.length : 0;
  const isComplete = config ? filledCount >= totalFields : false;

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input after streaming ends
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

  // Cleanup on unmount — abort any in-flight stream
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const selectVertical = useCallback((id: string) => {
    const cfg = VERTICALS[id];
    setVertical(id);
    setMessages([{ role: "assistant", content: cfg.greeting }]);
    setIntakeData({});
    setError(null);
  }, []);

  const resetChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setVertical(null);
    setMessages([]);
    setInput("");
    setIsStreaming(false);
    setIntakeData({});
    setError(null);
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming || !vertical) return;

    setError(null);
    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsStreaming(true);

    // Prepare messages for API — skip the synthetic greeting (first assistant message
    // that was never returned by the API) so the conversation starts with a user message
    const apiMessages = updatedMessages
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    const controller = new AbortController();
    abortRef.current = controller;

    let assistantMessageAdded = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, vertical }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      // Add empty assistant message that we'll stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      assistantMessageAdded = true;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullContent += chunk;

          // Update the last message with streamed content (strip data tag for display)
          const displayContent = stripIntakeTag(fullContent);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: displayContent,
            };
            return updated;
          });
        }
      } catch (readErr) {
        // Always cancel the reader on error/abort to release the stream lock
        await reader.cancel().catch(() => {});
        throw readErr;
      }

      // After stream is complete, parse intake data and merge (validated against schema)
      const parsed = parseIntakeData(fullContent, validKeys);
      if (parsed) {
        setIntakeData((prev) => ({ ...prev, ...parsed }));
      }

      // Store full content (with data tag) in messages for API context
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: fullContent,
        };
        return updated;
      });
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") {
        // Clean up any partial assistant message on abort
        if (assistantMessageAdded) {
          setMessages((prev) => prev.slice(0, -1));
        }
        return;
      }
      setError(
        err instanceof Error ? err.message : "Something went wrong"
      );
      // Remove the in-progress assistant message on error (whether empty or partial)
      if (assistantMessageAdded) {
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, vertical, messages, validKeys]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(intakeData, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(intakeData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `intake-${vertical}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(251,191,36,0.06)_0%,transparent_70%)]" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header />

        {/* Hero */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-8 w-full">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Demo
            </div>
            <h2
              className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-3"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Smart client intake
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">
                powered by AI.
              </span>
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed max-w-lg">
              Watch an AI chatbot qualify leads in real time. Pick an industry
              to see how it works for your clients.
            </p>
          </div>
        </section>

        {/* Main Content */}
        <section className="max-w-7xl mx-auto px-6 pb-24 w-full flex-1">
          {!vertical ? (
            /* ---- Vertical Selector ---- */
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.values(VERTICALS).map((v) => (
                <button
                  key={v.id}
                  onClick={() => selectVertical(v.id)}
                  className="group text-left p-6 rounded-2xl border border-white/[0.08] bg-navy-900/40 hover:border-amber-500/30 hover:bg-navy-900/60 transition-all cursor-pointer"
                >
                  <div className="text-3xl mb-3">{v.icon}</div>
                  <h3
                    className="text-lg font-bold text-slate-200 mb-1 group-hover:text-amber-300 transition-colors"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {v.label}
                  </h3>
                  <p className="text-sm text-slate-500">{v.description}</p>
                </button>
              ))}
            </div>
          ) : (
            /* ---- Chat + Intake Form Split ---- */
            <div className="grid lg:grid-cols-5 gap-6">
              {/* Chat Panel — 60% */}
              <div className="lg:col-span-3 flex flex-col">
                {/* Chat Header */}
                <div className="flex items-center justify-between px-4 py-3 rounded-t-2xl border border-white/[0.08] border-b-0 bg-navy-900/60">
                  <div className="flex items-center gap-3">
                    <div className="text-xl">{config!.icon}</div>
                    <div>
                      <h3
                        className="text-sm font-bold text-slate-200"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {config!.label} Intake
                      </h3>
                      <p className="text-xs text-slate-500">AI Assistant</p>
                    </div>
                  </div>
                  <button
                    onClick={resetChat}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-300 hover:bg-white/[0.04] transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-[400px] max-h-[600px] overflow-y-auto px-4 py-4 space-y-4 border-x border-white/[0.08] bg-navy-950/40">
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="shrink-0 w-7 h-7 rounded-full bg-navy-800 border border-white/[0.08] flex items-center justify-center">
                          <Bot className="w-3.5 h-3.5 text-amber-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-amber-500/15 text-amber-100 border border-amber-500/20 rounded-br-md"
                            : "bg-navy-800/80 text-slate-200 border border-white/[0.06] rounded-bl-md"
                        }`}
                      >
                        {stripIntakeTag(msg.content) || (
                          /* Typing indicator while streaming */
                          <div className="flex items-center gap-1 py-1">
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-typing-dot"
                              style={{ animationDelay: "0ms" }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-typing-dot"
                              style={{ animationDelay: "200ms" }}
                            />
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-typing-dot"
                              style={{ animationDelay: "400ms" }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-2 border-x border-white/[0.08] bg-red-500/[0.04]">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {/* Input */}
                <div className="flex items-end gap-2 px-4 py-3 rounded-b-2xl border border-white/[0.08] border-t-0 bg-navy-900/60">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type your response..."
                    rows={1}
                    disabled={isStreaming}
                    className="flex-1 bg-navy-800/60 border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all resize-none disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isStreaming || !input.trim()}
                    className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center text-navy-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Intake Form Panel — 40% */}
              <div className="lg:col-span-2">
                <div className="sticky top-6">
                  <div className="rounded-2xl border border-white/[0.08] bg-navy-900/60 overflow-hidden">
                    {/* Form Header */}
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <div className="flex items-center justify-between">
                        <h3
                          className="text-sm font-bold text-slate-200"
                          style={{ fontFamily: "var(--font-display)" }}
                        >
                          Intake Form
                        </h3>
                        <span className="text-xs text-slate-500">
                          {filledCount}/{totalFields} fields
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-2 h-1.5 rounded-full bg-navy-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                          style={{
                            width: `${totalFields > 0 ? (filledCount / totalFields) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Fields */}
                    <div className="px-5 py-4 space-y-3 max-h-[500px] overflow-y-auto">
                      {config!.schema.map((field: FieldDef) => {
                        const value = intakeData[field.key];
                        return (
                          <div key={field.key}>
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                              {field.label}
                            </label>
                            <div
                              className={`mt-1 px-3 py-2 rounded-lg border text-sm ${
                                value
                                  ? "border-emerald-500/20 bg-emerald-500/[0.04] text-slate-200"
                                  : "border-white/[0.06] bg-navy-800/40 text-slate-600 italic"
                              }`}
                            >
                              {value || "Pending..."}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Completion Banner */}
                    {isComplete && (
                      <div className="px-5 py-4 border-t border-emerald-500/20 bg-emerald-500/[0.04]">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-medium text-emerald-300">
                            Intake Complete
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={copyJSON}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs font-medium text-slate-300 hover:bg-white/[0.08] transition-all cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copied ? "Copied!" : "Copy JSON"}
                          </button>
                          <button
                            onClick={exportJSON}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            Export
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <Footer />
      </div>
    </div>
  );
}
