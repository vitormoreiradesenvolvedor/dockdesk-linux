import { useCallback, useState } from 'react';

/**
 * Estado aberto/recolhido dos grupos, persistido por visão no localStorage.
 * Padrão: recolhido (só a linha do grupo aparece) até o usuário abrir.
 */
export function useCollapsedGroups(viewKey: string) {
  const storageKey = `dockdesk-collapsed-${viewKey}`;
  const [state, setState] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  const isCollapsed = useCallback(
    (key: string) => state[key] ?? true,
    [state]
  );

  const toggle = useCallback(
    (key: string) => {
      setState((s) => {
        const next = { ...s, [key]: !(s[key] ?? true) };
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  return { isCollapsed, toggle };
}
