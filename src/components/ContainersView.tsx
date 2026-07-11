import { useState } from 'react';
import {
  Play,
  Square,
  RotateCw,
  Terminal,
  Trash2,
  Boxes,
  Loader2,
  ChevronDown,
  Layers,
} from 'lucide-react';
import type { ContainerStats, ContainerSummary } from '../global';
import { formatBytes, stateLabel } from '../utils';
import { ContainerDetail } from './ContainerDetail';

interface Props {
  containers: ContainerSummary[];
  stats: Record<string, ContainerStats>;
  onRefresh: () => Promise<void>;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ContainersView({ containers, stats, onRefresh, notify }: Props) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<ContainerSummary | null>(null);
  const [initialTab, setInitialTab] = useState<'overview' | 'terminal'>('overview');
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const filtered = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.image.toLowerCase().includes(filter.toLowerCase())
  );

  // agrupa por projeto compose (labels do Docker — vale para projetos que
  // subiram por fora do DockDesk também)
  const groups = new Map<string, ContainerSummary[]>();
  const loose: ContainerSummary[] = [];
  for (const c of filtered) {
    if (c.composeProject) {
      const list = groups.get(c.composeProject) ?? [];
      list.push(c);
      groups.set(c.composeProject, list);
    } else {
      loose.push(c);
    }
  }
  const projectNames = [...groups.keys()].sort((a, b) => a.localeCompare(b));

  // mantém o drawer sincronizado com o polling
  const selectedLive = selected
    ? containers.find((c) => c.id === selected.id) ?? selected
    : null;

  function toggleGroup(name: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function runAction(c: ContainerSummary, action: string) {
    setBusy((b) => ({ ...b, [c.id]: action }));
    try {
      await window.dockdesk.containers.action(c.id, action);
      await onRefresh();
      if (action === 'remove' && selected?.id === c.id) setSelected(null);
    } catch (err: any) {
      notify(`Falha ao executar "${action}" em ${c.name}: ${err.message}`);
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[c.id];
        return next;
      });
      setConfirmRemove(null);
    }
  }

  function renderCard(c: ContainerSummary) {
    const st = stats[c.id];
    const running = c.state === 'running';
    const actionBusy = busy[c.id];
    const memPct = st && st.memLimit > 0 ? (st.memUsed / st.memLimit) * 100 : 0;
    return (
      <div
        key={c.id}
        className="container-card"
        data-testid={`container-${c.name}`}
        onClick={() => {
          setInitialTab('overview');
          setSelected(c);
        }}
      >
        <span className={`state-indicator ${c.state}`} />
        <div className="container-info">
          <div className="container-name">
            {c.name}
            {c.composeService && <span className="compose-tag">{c.composeService}</span>}
          </div>
          <div className="container-image">{c.image}</div>
          {c.ports.length > 0 && (
            <div className="container-ports">
              {c.ports.slice(0, 5).map((p, i) => (
                <span key={i} className="port-chip">
                  {p.public ? `${p.public} → ${p.private}` : p.private}/{p.type}
                </span>
              ))}
            </div>
          )}
        </div>

        <span className={`badge ${c.state}`} data-testid={`badge-${c.name}`}>
          {stateLabel(c.state)}
        </span>

        <div className="metrics">
          <div className="metric">
            <div className="metric-label">
              CPU
              <span className="metric-value">
                {running && st ? `${st.cpu.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="metric-bar">
              <div
                className={`metric-bar-fill ${st && st.cpu > 80 ? 'hot' : ''}`}
                style={{ width: `${Math.min(st?.cpu ?? 0, 100)}%` }}
              />
            </div>
          </div>
          <div className="metric">
            <div className="metric-label">
              MEM
              <span className="metric-value">
                {running && st ? formatBytes(st.memUsed) : '—'}
              </span>
            </div>
            <div className="metric-bar">
              <div
                className={`metric-bar-fill ${memPct > 85 ? 'hot' : ''}`}
                style={{ width: `${Math.min(memPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          {actionBusy ? (
            <button className="btn icon-only" disabled>
              <Loader2 size={15} className="spin" />
            </button>
          ) : running ? (
            <>
              <button
                className="btn icon-only"
                title="Reiniciar"
                data-testid={`restart-${c.name}`}
                onClick={() => runAction(c, 'restart')}
              >
                <RotateCw size={15} />
              </button>
              <button
                className="btn icon-only danger"
                title="Parar"
                data-testid={`stop-${c.name}`}
                onClick={() => runAction(c, 'stop')}
              >
                <Square size={15} />
              </button>
              <button
                className="btn icon-only"
                title="Abrir terminal"
                data-testid={`term-${c.name}`}
                onClick={() => {
                  setInitialTab('terminal');
                  setSelected(c);
                }}
              >
                <Terminal size={15} />
              </button>
            </>
          ) : (
            <>
              <button
                className="btn icon-only success"
                title="Ligar"
                data-testid={`start-${c.name}`}
                onClick={() => runAction(c, 'start')}
              >
                <Play size={15} />
              </button>
              {confirmRemove === c.id ? (
                <button
                  className="btn sm danger"
                  data-testid={`confirm-remove-${c.name}`}
                  onClick={() => runAction(c, 'remove')}
                >
                  Confirmar?
                </button>
              ) : (
                <button
                  className="btn icon-only danger"
                  title="Remover container"
                  data-testid={`remove-${c.name}`}
                  onClick={() => setConfirmRemove(c.id)}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <section className="view" data-testid="containers-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Containers</h1>
          <div className="view-sub">
            Gerencie seus containers sem decorar comandos — clique em um card para ver
            detalhes, terminal, rotinas e logs.
          </div>
        </div>
        <input
          className="search-input"
          placeholder="Buscar por nome ou imagem…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="container-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Boxes size={44} />
          <h3>Nenhum container encontrado</h3>
          <p>
            {containers.length === 0
              ? 'Quando você criar containers (ou subir um projeto Compose), eles aparecem aqui.'
              : 'Nenhum container corresponde à sua busca.'}
          </p>
        </div>
      ) : (
        <>
          {projectNames.map((project) => {
            const items = groups.get(project)!;
            const runningCount = items.filter((c) => c.state === 'running').length;
            const isCollapsed = collapsed.has(project);
            return (
              <section key={project} className="group-section" data-testid={`group-${project}`}>
                <button
                  className="group-header"
                  onClick={() => toggleGroup(project)}
                  data-testid={`group-toggle-${project}`}
                >
                  <ChevronDown
                    size={16}
                    className={`chevron ${isCollapsed ? 'closed' : ''}`}
                  />
                  <Layers size={15} color="#22d3ee" />
                  <span className="group-name">{project}</span>
                  <span className="compose-tag">compose</span>
                  <span className={`badge ${runningCount > 0 ? 'running' : 'exited'}`}>
                    {runningCount}/{items.length} rodando
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="container-list grouped">{items.map(renderCard)}</div>
                )}
              </section>
            );
          })}

          {loose.length > 0 && (
            <section className="group-section" data-testid="group-avulsos">
              {projectNames.length > 0 && (
                <button
                  className="group-header"
                  onClick={() => toggleGroup('__loose__')}
                  data-testid="group-toggle-avulsos"
                >
                  <ChevronDown
                    size={16}
                    className={`chevron ${collapsed.has('__loose__') ? 'closed' : ''}`}
                  />
                  <Boxes size={15} color="#8b949e" />
                  <span className="group-name">Containers avulsos</span>
                  <span className={`badge ${loose.some((c) => c.state === 'running') ? 'running' : 'exited'}`}>
                    {loose.filter((c) => c.state === 'running').length}/{loose.length} rodando
                  </span>
                </button>
              )}
              {!collapsed.has('__loose__') && (
                <div className={`container-list ${projectNames.length > 0 ? 'grouped' : ''}`}>
                  {loose.map(renderCard)}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {selectedLive && (
        <ContainerDetail
          container={selectedLive}
          initialTab={initialTab}
          onClose={() => setSelected(null)}
          onAction={runAction}
          notify={notify}
        />
      )}
    </section>
  );
}
