import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'info' | 'error';
interface Toast { id: number; type: ToastType; message: string; }

interface ToastCtx { push: (type: ToastType, message: string) => void; }
const Ctx = createContext<ToastCtx | null>(null);

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('ToastProvider missing');
  return c;
}

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++counter;
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const remove = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2.5rem)]">
        {toasts.map((t) => (
          <div key={t.id} className="animate-slide-up glass border border-ink-200/70 rounded-2xl shadow-pop px-4 py-3 flex items-start gap-3">
            <span className={
              t.type === 'success' ? 'text-mint-500' :
              t.type === 'error' ? 'text-brand-600' : 'text-blue-500'
            }>
              {t.type === 'success' ? <CheckCircle2 size={18} /> :
                t.type === 'error' ? <AlertTriangle size={18} /> : <Info size={18} />}
            </span>
            <p className="text-sm text-ink-800 flex-1 leading-snug pt-0.5">{t.message}</p>
            <button onClick={() => remove(t.id)} className="text-ink-400 hover:text-ink-700 transition-colors">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToastOnMount(type: ToastType, message: string, deps: unknown[] = []) {
  const { push } = useToast();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { push(type, message); }, deps);
}
