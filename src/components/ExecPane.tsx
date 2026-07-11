import { useRef, useState } from 'react';
import { Play, Loader2, Eraser } from 'lucide-react';
import type { ContainerSummary } from '../global';

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
      notify(`Falha ao executar comando: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!running) {
    return (
      <div className="centered-note" data-testid="exec-pane">
        O container está parado. Ligue o container para executar comandos nele.
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
          placeholder={`Comando para rodar em ${container.name} (ex.: ls -la /app)`}
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
          Executar
        </button>
        <button
          className="btn"
          onClick={() => setEntries([])}
          disabled={entries.length === 0}
          title="Limpar a saída"
          data-testid="exec-clear"
        >
          <Eraser size={15} /> Limpar
        </button>
      </div>
      <pre className="exec-output" ref={outRef} data-testid="exec-output">
        {entries.length === 0 ? (
          <span className="exit-line">
            A saída dos comandos aparece aqui. Os comandos rodam dentro do container via
            docker exec.
          </span>
        ) : (
          entries.map((e, i) => (
            <span key={i}>
              <span className="cmd-line">$ {e.cmd}{'\n'}</span>
              {e.output}
              {e.stderr && <span className="err-line">{e.stderr}</span>}
              {e.exitCode !== 0 && e.exitCode !== null && (
                <span className="exit-line">(código de saída: {e.exitCode}){'\n'}</span>
              )}
              {'\n'}
            </span>
          ))
        )}
      </pre>
    </div>
  );
}
