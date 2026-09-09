import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ToastMessage {
  id: number;
  text: string;
  kind: "success" | "error";
}

interface ToastContextValue {
  push: (text: string, kind?: ToastMessage["kind"]) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback((text: string, kind: ToastMessage["kind"] = "success") => {
    const id = Date.now() + Math.random();
    setMessages((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-md px-4 py-2 text-sm shadow-lg ${
              m.kind === "success" ? "bg-ink text-paper" : "bg-red-700 text-white"
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
