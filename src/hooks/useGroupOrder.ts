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
  // grupo atualmente sob o item arrastado — para destacar o alvo do drop
  const [overKey, setOverKey] = useState<string | null>(null);

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

  /** Props para o elemento que INICIA o arrasto (alça/cabeçalho). */
  const handleProps = useCallback((key: string) => {
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        dragKey.current = key;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', key);
      },
      onDragEnd: () => {
        dragKey.current = null;
        setOverKey(null);
      },
    };
  }, []);

  /** Props para o elemento que RECEBE o drop (o próprio grupo). */
  const targetProps = useCallback(
    (targetKey: string, present: string[]) => {
      const allow = (e: DragEvent) => {
        // preventDefault em dragenter E dragover é o que faz o cursor
        // mostrar "pode soltar aqui" em vez do círculo de proibido
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragKey.current && dragKey.current !== targetKey) setOverKey(targetKey);
      };
      return {
        onDragEnter: allow,
        onDragOver: allow,
        onDragLeave: () => setOverKey((k) => (k === targetKey ? null : k)),
        onDrop: (e: DragEvent) => {
          e.preventDefault();
          const source = dragKey.current ?? e.dataTransfer.getData('text/plain');
          dragKey.current = null;
          setOverKey(null);
          if (!source || source === targetKey) return;
          const current = sortKeys(present);
          const from = current.indexOf(source);
          const to = current.indexOf(targetKey);
          if (from < 0 || to < 0) return;
          current.splice(to, 0, ...current.splice(from, 1));
          persist(current);
        },
      };
    },
    [sortKeys, persist]
  );

  return { sortKeys, handleProps, targetProps, overKey };
}
