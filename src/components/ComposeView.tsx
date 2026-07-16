import { useCallback, useEffect, useMemo, useState } from 'react';
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
  GripVertical,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import type { ComposeProject, ComposeStatus, ContainerSummary } from '../global';
import { useI18n } from '../i18n';
import { useGroupOrder } from '../hooks/useGroupOrder';

interface Props {
  containers: ContainerSummary[];
  notify: (text: string, kind?: 'error' | 'info') => void;
}

// o Docker Compose normaliza o nome do projeto (pasta): minúsculas e só
// [a-z0-9_-]; replica a regra para casar com o label dos containers
function normalizeProjectName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9_-]/g, '');
}

export function ComposeView({ containers, notify }: Props) {
  const { t } = useI18n();
  const [folders, setFolders] = useState<string[]>([]);
  const [projects, setProjects] = useState<ComposeProject[] | null>(null);
  const [runningAction, setRunningAction] = useState<Record<string, string>>({});
  const [consoles, setConsoles] = useState<Record<string, string>>({});
  const [consoleMin, setConsoleMin] = useState<Record<string, boolean>>({});
  const [scanning, setScanning] = useState(false);
  const order = useGroupOrder('compose');

  // estado dos projetos derivado da lista de containers que o app já
  // monitora a cada poucos segundos — atualiza em tempo real, sem precisar
  // rodar `docker compose ps` por projeto
  const statuses = useMemo(() => {
    const map: Record<string, ComposeStatus> = {};
    if (!projects) return map;
    for (const p of projects) {
      const normalized = normalizeProjectName(p.name);
      const own = containers.filter(
        (c) =>
          c.composeProject !== null &&
          (c.composeWorkingDir === p.dir || c.composeProject === normalized)
      );
      map[p.file] = {
        running: own.filter((c) => c.state === 'running').length,
        total: own.length,
        containers: own.map((c) => ({
          name: c.name,
          service: c.composeService ?? '',
          state: c.state,
          status: c.status,
        })),
      };
    }
    return map;
  }, [projects, containers]);

  const refresh = useCallback(async () => {
    setScanning(true);
    try {
      const [f, p] = await Promise.all([
        window.dockdesk.compose.folders(),
        window.dockdesk.compose.scan(),
      ]);
      setFolders(f);
      setProjects(p);
    } catch (err: any) {
      notify(t('compose_scan_fail', { msg: err.message }));
    } finally {
      setScanning(false);
    }
  }, [notify, t]);

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
    setConsoles((c) => ({
      ...c,
      [project.file]: `$ docker compose ${action === 'up' ? 'up -d' : action}\n`,
    }));
    // nova execução começa com o terminal expandido
    setConsoleMin((m) => ({ ...m, [project.file]: false }));
    try {
      const runId = await window.dockdesk.compose.run(project.file, action);
      const unsubOut = window.dockdesk.compose.onOutput(runId, (text) => {
        setConsoles((c) => ({
          ...c,
          [project.file]: ((c[project.file] ?? '') + text).slice(-50_000),
        }));
      });
      window.dockdesk.compose.onDone(runId, (exitCode) => {
        unsubOut();
        setConsoles((c) => ({
          ...c,
          [project.file]:
            (c[project.file] ?? '') +
            (exitCode === 0
              ? `\n${t('compose_done')}\n`
              : `\n${t('compose_error', { code: exitCode })}\n`),
        }));
        setRunningAction((r) => {
          const next = { ...r };
          delete next[project.file];
          return next;
        });
      });
    } catch (err: any) {
      notify(t('compose_action_fail', { action, msg: err.message }));
      setRunningAction((r) => {
        const next = { ...r };
        delete next[project.file];
        return next;
      });
    }
  }

  const orderedProjects = projects
    ? order
        .sortKeys(projects.map((p) => p.file))
        .map((file) => projects.find((p) => p.file === file)!)
        .filter(Boolean)
    : null;

  return (
    <section className="view" data-testid="compose-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">{t('compose_title')}</h1>
          <div className="view-sub">{t('compose_sub')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={refresh} disabled={scanning} data-testid="compose-refresh">
            {scanning ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            {t('refresh')}
          </button>
          <button className="btn primary" onClick={addFolder} data-testid="compose-add-folder">
            <FolderPlus size={15} /> {t('add_folder')}
          </button>
        </div>
      </div>

      {folders.length > 0 && (
        <div className="folder-bar" data-testid="folder-bar">
          {folders.map((f) => (
            <span key={f} className="folder-chip">
              {f}
              <button
                onClick={() => removeFolder(f)}
                title={t('remove_folder')}
                data-testid={`remove-folder-${f}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {orderedProjects === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : orderedProjects.length === 0 ? (
        <div className="empty-state">
          <FolderSearch size={44} />
          <h3>{t('compose_empty_title')}</h3>
          <p>{t('compose_empty_text')}</p>
        </div>
      ) : (
        <div className="compose-grid">
          {orderedProjects.map((p) => {
            const status = statuses[p.file];
            const action = runningAction[p.file];
            const consoleText = consoles[p.file];
            const running = status?.running ?? 0;
            const total = Math.max(p.services.length, status?.total ?? 0, 1);
            const upServices = new Set(
              (status?.containers ?? [])
                .filter((c) => (c.state || '').toLowerCase() === 'running')
                .map((c) => c.service)
            );
            const allFiles = orderedProjects.map((x) => x.file);
            return (
              <div
                key={p.file}
                className={`compose-card ${order.overKey === p.file ? 'drag-over' : ''}`}
                data-testid={`compose-${p.name}`}
                {...order.targetProps(p.file, allFiles)}
              >
                <div className="compose-card-head">
                  <span
                    className="drag-handle"
                    {...order.handleProps(p.file)}
                    title={t('drag_reorder')}
                    data-testid={`compose-drag-${p.name}`}
                  >
                    <GripVertical size={15} />
                  </span>
                  <Layers size={20} color="#22d3ee" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="compose-name">
                      {p.name}{' '}
                      {status && status.total > 0 && (
                        <span className={`badge ${running > 0 ? 'running' : 'exited'}`}>
                          {t('running_count', { n: running, total: status.total })}
                        </span>
                      )}
                    </div>
                    <div className="compose-path">{p.file}</div>
                  </div>
                  <div className="card-actions">
                    {action ? (
                      <button className="btn" disabled>
                        <Loader2 size={15} className="spin" />
                        {action === 'up'
                          ? t('compose_upping')
                          : action === 'down'
                            ? t('compose_downing')
                            : t('compose_restarting')}
                      </button>
                    ) : (
                      <>
                        {/* Subir só aparece se há serviço parado; Reiniciar e
                            Derrubar só fazem sentido com algo rodando */}
                        {running < total && (
                          <button
                            className="btn success"
                            onClick={() => runAction(p, 'up')}
                            title="docker compose up -d"
                            data-testid={`compose-up-${p.name}`}
                          >
                            <ArrowUpCircle size={15} /> {t('compose_up')}
                          </button>
                        )}
                        {running > 0 && (
                          <>
                            <button
                              className="btn"
                              onClick={() => runAction(p, 'restart')}
                              title="docker compose restart"
                              data-testid={`compose-restart-${p.name}`}
                            >
                              <RotateCw size={15} /> {t('compose_restart')}
                            </button>
                            <button
                              className="btn danger"
                              onClick={() => runAction(p, 'down')}
                              title="docker compose down"
                              data-testid={`compose-down-${p.name}`}
                            >
                              <ArrowDownCircle size={15} /> {t('compose_down')}
                            </button>
                          </>
                        )}
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
                  <>
                    <div
                      className={`compose-console-bar ${consoleMin[p.file] ? 'collapsed' : ''}`}
                    >
                      <Terminal size={13} />
                      <span className="console-bar-label">docker compose</span>
                      {action && <Loader2 size={13} className="spin" />}
                      <button
                        className="btn icon-only sm"
                        onClick={() =>
                          setConsoleMin((m) => ({ ...m, [p.file]: !m[p.file] }))
                        }
                        title={consoleMin[p.file] ? t('routine_expand') : t('routine_minimize')}
                        data-testid={`compose-console-toggle-${p.name}`}
                      >
                        <ChevronDown
                          size={14}
                          className={`chevron ${consoleMin[p.file] ? 'closed' : ''}`}
                        />
                      </button>
                    </div>
                    <pre
                      className="compose-console"
                      style={{ display: consoleMin[p.file] ? 'none' : undefined }}
                      data-testid={`compose-console-${p.name}`}
                    >
                      {consoleText}
                    </pre>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
