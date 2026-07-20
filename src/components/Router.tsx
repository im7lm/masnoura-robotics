import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
export { Breadcrumbs } from './CommandPalette';

type RouterCtx = { path: string; navigate: (to: string) => void; };
const Ctx = createContext<RouterCtx | null>(null);

export function useRouter() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Router missing');
  return c;
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, '') || '/');

  useEffect(() => {
    const onHash = () => setPath(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  return <Ctx.Provider value={{ path, navigate }}>{children}</Ctx.Provider>;
}

export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void; }) {
  const { navigate } = useRouter();
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => { e.preventDefault(); onClick?.(); navigate(to); }}
    >
      {children}
    </a>
  );
}
