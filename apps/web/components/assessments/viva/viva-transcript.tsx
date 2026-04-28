"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage } from "@/types/ivas";

interface VivaTranscriptProps {
  messages: ChatMessage[];
  isEmpty: boolean;
  emptyMessage?: string;
  endRef: React.RefObject<HTMLDivElement | null>;
}

export function VivaTranscript({ messages, isEmpty, emptyMessage, endRef }: VivaTranscriptProps) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-6 scroll-smooth">
      <AnimatePresence mode="popLayout">
        {isEmpty ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12"
          >
            <p className="text-sm max-w-xs leading-relaxed">{emptyMessage}</p>
          </motion.div>
        ) : (
          messages.map((msg) => (
            <TranscriptEntry key={msg.id} message={msg} />
          ))
        )}
      </AnimatePresence>
      <div ref={endRef} />
    </div>
  );
}

function TranscriptEntry({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="space-y-1"
    >
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase ${
            isUser ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {isUser ? "You" : "Examiner"}
        </span>
        <span className="text-[10px] text-muted-foreground/50">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="text-[15px] leading-relaxed text-foreground/90">
        {message.content}
        {message.streaming && (
          <span className="inline-block w-1 h-4 ml-0.5 bg-current opacity-40 animate-pulse align-middle rounded-full" />
        )}
      </div>
    </motion.div>
  );
}
