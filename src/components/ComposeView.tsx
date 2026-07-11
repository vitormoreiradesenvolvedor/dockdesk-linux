import { useCallback, useEffect, useState } from 'react';
import {
  FolderPlus,
  FolderSearch,
  X,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCw,
  Loader2,
  Layers,
  RefreshCw,
} from 'lucide-react';
import type { ComposeProject, ComposeStatus } from '../global';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ComposeView({ notify }: Props) {
  const [folders, setFolders] = useState<string[]>([]);
  const [projects, setProjects] = useState<ComposeProject[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ComposeStatus>>({});
  const [runningAction, setRunningAction] = useState<Record<string, string>>({});
  const [consoles, setConsoles] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);

  const refresh = useCallback(async () => {
    setScanning(true);
    try {
      const [f, p] = await Promise.all([
        window.dockdesk.compose.folders(),
        window.dockdesk.compose.scan(),
      ]);
      setFolders(f);
      setProjects(p);
      const entries = await Promise.all(
        p.map(async (proj) => [proj.file, await window.dockdesk.compose.status(proj.file)] as const)
      );
      setStatuses(Object.fromEntries(entries));
    } catch (err: any) {
      notify(`Falha ao buscar projetos: ${err.message}`);
    } finally {
      setScanning(false);
    }
  }, [notify]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function addFolder() {
    const result = await window.dockdesk.compose.addFolder();
    if (result) await refresh();
  }

  async function removeFolder(folder: string) {
    await window.dockdesk.compose.removeFolder(folder);
    await refresh();
  }

  async function runAction(project: ComposeProject, action: 'up' | 'down' | 'restart') {
    setRunningAction((r) => ({ ...r, [project.file]: action }));
    setConsoles((c) => ({ ...c, [project.file]: `$ docker compose ${action === 'up' ? 'up -d' : action}\n` }));
    try {
      const runId = await window.dockdesk.compose.run(project.file, action);
      const unsubOut = window.dockdesk.compose.onOutput(runId, (text) => {
        setConsoles((c) => ({
          ...c,
          [project.file]: ((c[project.file] ?? '') + text).slice(-50_000),
        }));
      });
      window.dockdesk.compose.onDone(runId, async (exitCode) => {
        unsubOut();
        setConsoles((c) => ({
          ...c,
          [project.file]:
            (c[project.file] ?? '') +
            (exitCode === 0 ? '\n✔ Concluído com sucesso.\n' : `\n✖ Terminou com erro (código ${exitCode}).\n`),
        }));
        setRunningAction((r) => {
          const next = { ...r };
          delete next[project.file];
          return next;
        });
        const status = await window.dockdesk.compose.status(project.file);
        setStatuses((s) => ({ ...s, [project.file]: status }));
      });
    } catch (err: any) {
      notify(`Falha ao executar compose ${action}: ${err.message}`);
      setRunningAction((r) => {
        const next = { ...r };
        delete next[project.file];
        return next;
      });
    }
  }

  return (
    <section className="view" data-testid="compose-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Projetos Compose</h1>
          <div className="view-sub">
            Adicione as pastas onde ficam seus projetos — o DockDesk encontra os{' '}
            <code>docker-compose.yml</code> automaticamente e você sobe tudo com um clique.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={scanning} data-testid="compose-refresh">
            {scanning ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            Atualizar
          </button>
          <button className="btn primary" onClick={addFolder} data-testid="compose-add-folder">
            <FolderPlus size={15} /> Adicionar pasta
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="folder-bar" data-testid="folder-bar">
          {folders.map((f) => (
            <span key={f} className="folder-chip">
              {f}
              <button onClick={() => removeFolder(f)} title="Remover pasta" data-testid={`remove-folder-${f}`}>
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {projects === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : projects.length === 0 ? (
        <div className="empty-state">
          <FolderSearch size={44} />
          <h3>Nenhum projeto Compose encontrado</h3>
          <p>
            Clique em <strong>Adicionar pasta</strong> e escolha o diretório onde ficam seus
            projetos (ex.: ~/Projetos). O DockDesk procura arquivos docker-compose.yml em até
            4 níveis de subpastas.
          </p>
        </div>
      ) : (
        <div className="compose-grid">
          {projects.map((p) => {
            const status = statuses[p.file];
            const action = runningAction[p.file];
            const consoleText = consoles[p.file];
            const upServices = new Set(
              (status?.containers ?? [])
                .filter((c) => (c.state || '').toLowerCase() === 'running')
                .map((c) => c.service)
            );
            return (
              <div key={p.file} className="compose-card" data-testid={`compose-${p.name}`}>
                <div className="compose-card-head">
                  <Layers size={20} color="#22d3ee" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="compose-name">
                      {p.name}{' '}
                      {status && status.total > 0 && (
                        <span className={`badge ${status.running > 0 ? 'running' : 'exited'}`}>
                          {status.running}/{status.total} rodando
                        </span>
                      )}
                    </div>
                    <div className="compose-path">{p.file}</div>
                  </div>
                  <div className="card-actions">
                    {action ? (
                      <button className="btn" disabled>
                        <Loader2 size={15} className="spin" />
                        {action === 'up' ? 'Subindo…' : action === 'down' ? 'Derrubando…' : 'Reiniciando…'}
                      </button>
                    ) : (
                      <>
                        <button
                          className="btn success"
                          onClick={() => runAction(p, 'up')}
                          title="docker compose up -d"
                          data-testid={`compose-up-${p.name}`}
                        >
                          <ArrowUpCircle size={15} /> Subir
                        </button>
                        <button
                          className="btn"
                          onClick={() => runAction(p, 'restart')}
                          title="docker compose restart"
                          data-testid={`compose-restart-${p.name}`}
                        >
                          <RotateCw size={15} />
                        </button>
                        <button
                          className="btn danger"
                          onClick={() => runAction(p, 'down')}
                          title="docker compose down"
                          data-testid={`compose-down-${p.name}`}
                        >
                          <ArrowDownCircle size={15} /> Derrubar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {p.services.length > 0 && (
                  <div className="service-chips">
                    {p.services.map((s) => (
                      <span key={s} className={`service-chip ${upServices.has(s) ? 'up' : ''}`}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {consoleText && (
                  <pre className="compose-console" data-testid={`compose-console-${p.name}`}>
                    {consoleText}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
