import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSquare, Loader2, Power, Eraser } from 'lucide-react';
import type { ContainerSummary } from '../global';
import { useI18n } from '../i18n';

interface Props {
  container: ContainerSummary;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function TerminalPane({ container, notify }: Props) {
  const { t } = useI18n();
  const [shells, setShells] = useState<string[] | null>(null);
  const [shell, setShell] = useState<string | null>(null);
  const [sessionShell, setSessionShell] = useState<string | null>(null);
  const running = container.state === 'running';
  // referência estável: uma função nova a cada render reiniciaria a sessão
  const endSession = useCallback(() => setSessionShell(null), []);

  useEffect(() => {
    if (!running) return;
    let alive = true;
    setShells(null);
    window.dockdesk.shells.detect(container.id).then((found) => {
      if (!alive) return;
      setShells(found);
      // pré-seleciona o shell mais amigável disponível
      const preferred = ['bash', 'zsh', 'fish', 'ash', 'sh'];
      setShell(preferred.find((s) => found.includes(s)) ?? found[0] ?? null);
    });
    return () => {
      alive = false;
    };
  }, [container.id, running]);

  if (!running) {
    return (
      <div className="centered-note" data-testid="terminal-pane">
        <Power size={36} />
        <div>{t('term_stopped')}</div>
      </div>
    );
  }

  if (sessionShell) {
    return (
      <TerminalSession
        containerId={container.id}
        shell={sessionShell}
        onEnd={endSession}
        notify={notify}
      />
    );
  }

  return (
    <div
      data-testid="terminal-pane"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
    >
      {shells === null ? (
        <div className="centered-note">
          <Loader2 size={28} className="spin" />
          <div>{t('term_detecting')}</div>
        </div>
      ) : shells.length === 0 ? (
        <div className="centered-note">
          <TerminalSquare size={36} />
          <div>{t('term_no_shell')}</div>
        </div>
      ) : (
        <>
          <p className="term-hint" style={{ marginBottom: 12 }}>
            {t('term_choose')}{' '}
            <code>docker exec -it {container.name} &lt;shell&gt;</code>):
          </p>
          <div className="shell-picker" data-testid="shell-picker">
            {shells.map((s) => (
              <button
                key={s}
                className={`shell-chip ${shell === s ? 'selected' : ''}`}
                onClick={() => setShell(s)}
                data-testid={`shell-${s}`}
              >
                <TerminalSquare size={14} />
                {s}
              </button>
            ))}
          </div>
          <button
            className="btn primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={!shell}
            onClick={() => shell && setSessionShell(shell)}
            data-testid="open-terminal"
          >
            <TerminalSquare size={15} /> {t('term_open', { shell: shell ?? '' })}
          </button>
        </>
      )}
    </div>
  );
}

function TerminalSession({
  containerId,
  shell,
  onEnd,
  notify,
}: {
  containerId: string;
  shell: string;
  onEnd: () => void;
  notify: (text: string, kind?: 'error' | 'info') => void;
}) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const [exited, setExited] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 13,
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
    xterm.focus();
    xtermRef.current = xterm;

    // o renderer gera o termId e se inscreve ANTES de abrir o exec: nenhum
    // byte do stream (prompt, consultas de cursor do shell) pode se perder
    const termId = `term-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let disposed = false;
    let connected = false;
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.dockdesk.term.onData(termId, (data) => xterm.write(new Uint8Array(data)))
    );
    cleanups.push(window.dockdesk.term.onExit(termId, () => setExited(true)));
    xterm.onData((d) => connected && window.dockdesk.term.write(termId, d));
    xterm.onResize(
      ({ cols, rows }) => connected && window.dockdesk.term.resize(termId, cols, rows)
    );

    window.dockdesk.term
      .open(containerId, { shell }, termId)
      .then(() => {
        if (disposed) {
          window.dockdesk.term.close(termId);
          return;
        }
        connected = true;
        window.dockdesk.term.resize(termId, xterm.cols, xterm.rows);
      })
      .catch((err) => {
        notify(t('term_open_fail', { msg: err.message }));
        onEnd();
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
      xtermRef.current = null;
    };
  }, [containerId, shell, notify, onEnd, t]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      data-testid="terminal-session"
    >
      <div className="term-wrap" ref={wrapRef} />
      <p className="term-hint">
        {exited ? (
          <>
            {t('term_ended')}{' '}
            <button className="btn sm" onClick={onEnd} data-testid="terminal-back">
              {t('term_back')}
            </button>
          </>
        ) : (
          <>
            {t('term_connected')} <code>{shell}</code> {t('term_connected_hint')}
            <button
              className="btn sm"
              style={{ marginLeft: 10 }}
              onClick={() => xtermRef.current?.clear()}
              data-testid="terminal-clear"
              title={t('term_clear')}
            >
              <Eraser size={13} /> {t('term_clear')}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
