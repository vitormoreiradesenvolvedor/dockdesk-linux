import { useRef, useState } from 'react';
import { Play, Loader2, Eraser } from 'lucide-react';
import type { ContainerSummary } from '../global';
import { useI18n } from '../i18n';

interface Entry {
  cmd: string;
  output: string;
  stderr: string;
  exitCode: number | null;
}

interface Props {
  container: ContainerSummary;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ExecPane({ container, notify }: Props) {
  const { t } = useI18n();
  const [cmd, setCmd] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const outRef = useRef<HTMLPreElement>(null);
  const running = container.state === 'running';

  async function run() {
    const command = cmd.trim();
    if (!command || busy) return;
    setBusy(true);
    try {
      const result = await window.dockdesk.exec.command(container.id, command);
      setEntries((e) => [...e, { cmd: command, ...result }]);
      setCmd('');
      requestAnimationFrame(() => {
        outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
      });
    } catch (err: any) {
      notify(t('exec_fail', { msg: err.message }));
    } finally {
      setBusy(false);
    }
  }

  if (!running) {
    return (
      <div className="centered-note" data-testid="exec-pane">
        {t('exec_stopped')}
      </div>
    );
  }

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      data-testid="exec-pane"
    >
      <div className="exec-form">
        <input
          className="exec-input"
          placeholder={t('exec_placeholder', { name: container.name })}
          value={cmd}
          onChange={(e) => setCmd(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          data-testid="exec-input"
        />
        <button
          className="btn primary"
          onClick={run}
          disabled={busy || !cmd.trim()}
          data-testid="exec-run"
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
          {t('exec_run')}
        </button>
        <button
          className="btn"
          onClick={() => setEntries([])}
          disabled={entries.length === 0}
          title={t('exec_clear')}
          data-testid="exec-clear"
        >
          <Eraser size={15} /> {t('exec_clear')}
        </button>
      </div>
      <pre className="exec-output" ref={outRef} data-testid="exec-output">
        {entries.length === 0 ? (
          <span className="exit-line">{t('exec_hint')}</span>
        ) : (
          entries.map((e, i) => (
            <span key={i}>
              <span className="cmd-line">$ {e.cmd}{'\n'}</span>
              {e.output}
              {e.stderr && <span className="err-line">{e.stderr}</span>}
              {e.exitCode !== 0 && e.exitCode !== null && (
                <span className="exit-line">
                  {t('exec_exit_code', { code: e.exitCode })}
                  {'\n'}
                </span>
              )}
              {'\n'}
            </span>
          ))
        )}
      </pre>
    </div>
  );
}
