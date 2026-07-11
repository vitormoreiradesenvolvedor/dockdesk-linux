import { useCallback, useRef, useState, type DragEvent } from 'react';

/**
 * Ordenação persistente de grupos por arrastar-e-soltar.
 * A ordem fica no localStorage por visão (`dockdesk-order-<viewKey>`);
 * chaves novas (ainda sem posição salva) vão para o fim, em ordem alfabética.
 */
export function useGroupOrder(viewKey: string) {
  const storageKey = `dockdesk-order-${viewKey}`;
  const [savedOrder, setSavedOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const dragKey = useRef<string | null>(null);

  const sortKeys = useCallback(
    (present: string[]): string[] => {
      const known = savedOrder.filter((k) => present.includes(k));
      const unknown = present
        .filter((k) => !savedOrder.includes(k))
        // grupos "avulsos" (__loose__) ficam por último até o usuário reordenar
        .sort((a, b) => {
          const la = a.startsWith('__') ? 1 : 0;
          const lb = b.startsWith('__') ? 1 : 0;
          return la - lb || a.localeCompare(b);
        });
      return [...known, ...unknown];
    },
    [savedOrder]
  );

  const persist = useCallback(
    (order: string[]) => {
      setSavedOrder(order);
      localStorage.setItem(storageKey, JSON.stringify(order));
    },
    [storageKey]
  );

  const onDragStart = useCallback((key: string) => {
    return (e: DragEvent) => {
      dragKey.current = key;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', key);
    };
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const makeOnDrop = useCallback(
    (targetKey: string, present: string[]) => {
      return (e: DragEvent) => {
        e.preventDefault();
        const source = dragKey.current ?? e.dataTransfer.getData('text/plain');
        dragKey.current = null;
        if (!source || source === targetKey) return;
        const current = sortKeys(present);
        const from = current.indexOf(source);
        const to = current.indexOf(targetKey);
        if (from < 0 || to < 0) return;
        current.splice(to, 0, ...current.splice(from, 1));
        persist(current);
      };
    },
    [sortKeys, persist]
  );

  return { sortKeys, onDragStart, onDragOver, makeOnDrop };
}
