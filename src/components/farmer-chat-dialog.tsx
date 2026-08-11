"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "@/lib/i18n";

interface ChatMessage {
  id: number;
  speaker: "farmer" | "user";
  text: string;
}

const COPY = {
  id: {
    kicker: "TEMAN KEBUNMU",
    title: "Farmer Tani",
    trust: "Jawaban dibuat dari petunjuk sensor tanaman.",
    greeting: "Hoho, ada yang ingin kamu tanyakan tentang Jamkachu, Nak?",
    placeholder: "Tanyakan suhu, cahaya, atau pH…",
    send: "TANYA",
    close: "Tutup obrolan",
    thinking: "Farmer Tani sedang melihat petunjuk sensor…",
    error: "Maaf, Nak, obrolannya terputus. Coba tanyakan lagi sebentar lagi.",
    prompts: ["Bagaimana keadaan tanaman?", "Apakah suhunya nyaman?", "Bagaimana cahayanya?"],
  },
  en: {
    kicker: "YOUR GARDEN FRIEND",
    title: "Farmer Tani",
    trust: "Answers use the plant's sensor clues.",
    greeting: "Hoho, what would you like to ask about Jamkachu, my young friend?",
    placeholder: "Ask about temperature, light, or pH…",
    send: "ASK",
    close: "Close chat",
    thinking: "Farmer Tani is checking the sensor clues…",
    error: "Sorry, my young friend, our chat was interrupted. Please ask me again in a moment.",
    prompts: ["How is the plant doing?", "Is the temperature comfortable?", "How is the light?"],
  },
} as const;

export default function FarmerChatDialog({ open, locale, onClose }: { open: boolean; locale: AppLocale; onClose: () => void }) {
  const copy = COPY[locale];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [thinking, setThinking] = useState(false);
  const nextId = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setThinking(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { close(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled),input:not(:disabled)") ?? []);
      if (controls.length === 0) return;
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", onKeyDown); };
  }, [open, close]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  if (!open) return null;
  const shownMessages = messages.length > 0 ? messages : [{ id: -1, speaker: "farmer" as const, text: copy.greeting }];

  const ask = async (rawQuestion: string) => {
    const cleanQuestion = rawQuestion.replace(/\s+/g, " ").trim();
    if (!cleanQuestion || thinking) return;
    const userMessage = { id: nextId.current++, speaker: "user" as const, text: cleanQuestion };
    setMessages((current) => current.length > 0 ? [...current, userMessage] : [{ id: nextId.current++, speaker: "farmer", text: copy.greeting }, userMessage]);
    setQuestion("");
    setThinking(true);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch("/api/farmer-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: cleanQuestion, locale }),
        signal: controller.signal,
      });
      const payload = await response.json() as { ok?: boolean; reply?: string };
      if (!response.ok || !payload.ok || !payload.reply) throw new Error("farmer_chat_failed");
      setMessages((current) => [...current, { id: nextId.current++, speaker: "farmer", text: payload.reply! }]);
    } catch {
      if (!controller.signal.aborted || controllerRef.current === controller) {
        setMessages((current) => [...current, { id: nextId.current++, speaker: "farmer", text: copy.error }]);
      }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      setThinking(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void ask(question);
  };

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  return createPortal(<div className="pm-farmer-chat-backdrop" onClick={closeFromBackdrop}>
    <section id="pm-farmer-chat-dialog" ref={dialogRef} className="pm-farmer-chat" role="dialog" aria-modal="true" aria-labelledby="pm-farmer-chat-title">
      <header><span aria-hidden="true">👨‍🌾</span><div><small>{copy.kicker}</small><h2 id="pm-farmer-chat-title">{copy.title}</h2><p className="pm-farmer-chat-trust">🌱 {copy.trust}</p></div><button type="button" onClick={close} aria-label={copy.close}>×</button></header>
      <div ref={logRef} className="pm-farmer-chat-log" role="log" aria-live="polite">
        {shownMessages.map((message) => <p key={message.id} className={`is-${message.speaker}`}>{message.text}</p>)}
        {thinking && <p className="is-farmer is-thinking">{copy.thinking}</p>}
      </div>
      <div className="pm-farmer-chat-prompts">{copy.prompts.map((prompt) => <button key={prompt} type="button" disabled={thinking} onClick={() => void ask(prompt)}>{prompt}</button>)}</div>
      <form onSubmit={submit}><input ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={280} autoComplete="off" placeholder={copy.placeholder} aria-label={copy.placeholder} /><button type="submit" disabled={thinking || !question.trim()}>{copy.send}</button></form>
    </section>
  </div>, document.body);
}
