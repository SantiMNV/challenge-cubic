"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface ChatContext {
  repo?: string;
  headSha?: string;
  productSummary?: string;
  subsystems?: Array<{ name: string; description: string }>;
  wikiPages?: Array<{ subsystemName: string; markdown: string }>;
}

interface ChatAssistantProps {
  context?: ChatContext;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ChatAssistant({ context }: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = input.trim();
    if (!question || isStreaming) return;

    setError(null);
    setInput("");

    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };

    const historyWithUser = [...messages, userMessage];
    const assistantMessageId = createId();
    setMessages([
      ...historyWithUser,
      { id: assistantMessageId, role: "assistant", content: "", createdAt: new Date().toISOString() },
    ]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyWithUser.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          context,
        }),
      });

      if (!response.ok) {
        const failure = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(failure.error ?? "Unable to get assistant response.");
      }

      if (!response.body) {
        throw new Error("Streaming response is not available.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessageId ? { ...message, content: assistantText } : message,
          ),
        );
      }

      assistantText += decoder.decode();
      setMessages((current) =>
        current.map((message) => (message.id === assistantMessageId ? { ...message, content: assistantText } : message)),
      );
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : "Unexpected error.";
      setError(message);
      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId ? { ...item, content: "I could not complete this response." } : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <>
      {isOpen ? (
        <section className="fixed bottom-24 right-4 z-50 h-[min(72vh,620px)] w-[min(440px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] backdrop-blur">
          <header className="flex items-center justify-between border-b border-slate-200/80 bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <div>
                <p className="font-serif text-base text-slate-900">Repo Assistant</p>
                <p className="text-xs text-slate-500">{context?.repo ?? "No repo analyzed yet"}</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="size-8 rounded-full"
            >
              <X className="size-4" />
            </Button>
          </header>
          <div className="flex h-[calc(100%-4rem)] flex-col gap-3 p-3">
            <ScrollArea className="h-full rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-3">
              <div className="space-y-4 pb-1">
                {!messages.length ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-sm text-slate-500">
                    Ask anything about the generated wiki. Conversation resets on refresh.
                  </div>
                ) : null}

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-6 shadow-sm",
                      message.role === "user"
                        ? "ml-auto rounded-br-md bg-slate-900 text-slate-50"
                        : "rounded-bl-md border border-slate-200 bg-white text-slate-700",
                    )}
                  >
                    {message.content || (isStreaming && message.role === "assistant" ? "..." : "")}
                  </div>
                ))}
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <form onSubmit={onSubmit} className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Write your question..."
                className="min-h-20 w-full resize-none rounded-lg border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-1 pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setMessages([])}
                  disabled={isStreaming || !messages.length}
                >
                  Clear
                </Button>
                <Button type="submit" size="sm" disabled={isStreaming || !input.trim()} className="rounded-lg">
                  {isStreaming ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Send
                </Button>
              </div>
            </form>

            {error ? <p className="text-xs text-red-600">{error}</p> : null}
          </div>
        </section>
      ) : null}

      <Button
        type="button"
        size="default"
        className="fixed bottom-6 right-4 z-50 size-14 rounded-full border border-orange-200 bg-white text-slate-900 shadow-[0_14px_45px_-20px_rgba(15,23,42,0.6)] hover:bg-orange-50"
        onClick={() => setIsOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle className="size-6" />
      </Button>
    </>
  );
}
