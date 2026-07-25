import { useCallback, useState } from 'react';

/**
 * Modo privacidade: quando ativo, o app mostra apenas os recursos de um único
 * projeto Compose selecionado (containers, imagens, volumes, redes e projetos),
 * escondendo todo o resto — útil para apresentar/compartilhar a tela sem expor
 * outros projetos. Estado persistido no localStorage.
 */
const STORAGE_KEY = 'dockdesk-privacy';

interface Persisted {
  active: boolean;
  project: string | null;
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      return {
        active: !!parsed.active,
        project: typeof parsed.project === 'string' ? parsed.project : null,
      };
    }
  } catch {
    /* ignora estado corrompido */
  }
  return { active: false, project: null };
}

export function usePrivacyMode() {
  const [state, setState] = useState<Persisted>(load);

  const persist = useCallback((next: Persisted) => {
    setState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setProject = useCallback(
    (project: string | null) => persist({ ...state, project }),
    [persist, state]
  );

  // liga/desliga; ligar sem projeto escolhido não filtra nada até selecionar
  const setActive = useCallback(
    (active: boolean) => persist({ ...state, active }),
    [persist, state]
  );

  // projeto efetivamente em vigor para filtrar as telas (null = sem filtro)
  const project = state.active && state.project ? state.project : null;

  return { active: state.active, selected: state.project, project, setActive, setProject };
}
