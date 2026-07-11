import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

interface Props {
  containerId: string;
  /** shell interativo OU comando rodando em TTY (sh -c) */
  spec: { shell: string } | { command: string };
  onExit?: () => void;
  onError?: (msg: string) => void;
  /** altura fixa do terminal embutido (px) */
  height?: number;
}

/**
 * Terminal xterm conectado a um `docker exec` com TTY.
 * O termId é gerado no renderer e a inscrição nos canais IPC acontece ANTES
 * de abrir o exec: nenhum byte do stream (prompt, consultas de cursor do
 * shell) pode se perder.
 */
export function InlineTerminal({ containerId, spec, onExit, onError, height = 240 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const specKey = 'shell' in spec ? `s:${spec.shell}` : `c:${spec.command}`;
  const callbacks = useRef({ onExit, onError });
  callbacks.current = { onExit, onError };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 12.5,
      fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
      theme: {
        background: '#0a0e14',
        foreground: '#c9d6e3',
        cursor: '#22d3ee',
        selectionBackground: 'rgba(59,130,246,0.35)',
      },
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xterm.open(el);
    fit.fit();

    const termId = `term-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let disposed = false;
    let connected = false;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.dockdesk.term.onData(termId, (data) => xterm.write(new Uint8Array(data)))
    );
    cleanups.push(
      window.dockdesk.term.onExit(termId, () => callbacks.current.onExit?.())
    );
    xterm.onData((d) => connected && window.dockdesk.term.write(termId, d));
    xterm.onResize(
      ({ cols, rows }) => connected && window.dockdesk.term.resize(termId, cols, rows)
    );

    const parsedSpec = specKey.startsWith('s:')
      ? { shell: specKey.slice(2) }
      : { command: specKey.slice(2) };

    window.dockdesk.term
      .open(containerId, parsedSpec, termId)
      .then(() => {
        if (disposed) {
          window.dockdesk.term.close(termId);
          return;
        }
        connected = true;
        window.dockdesk.term.resize(termId, xterm.cols, xterm.rows);
        xterm.focus();
      })
      .catch((err) => {
        callbacks.current.onError?.(err.message);
        callbacks.current.onExit?.();
      });

    // debounce: evita rajadas de resize (SIGWINCH) no shell logo após conectar
    let fitTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleFit = () => {
      if (fitTimer) clearTimeout(fitTimer);
      fitTimer = setTimeout(() => fit.fit(), 80);
    };
    window.addEventListener('resize', scheduleFit);
    const observer = new ResizeObserver(scheduleFit);
    observer.observe(el);

    return () => {
      disposed = true;
      if (fitTimer) clearTimeout(fitTimer);
      observer.disconnect();
      window.removeEventListener('resize', scheduleFit);
      cleanups.forEach((c) => c());
      if (connected) window.dockdesk.term.close(termId);
      xterm.dispose();
    };
  }, [containerId, specKey]);

  return <div className="term-wrap" ref={wrapRef} style={{ height, flex: 'none' }} />;
}
