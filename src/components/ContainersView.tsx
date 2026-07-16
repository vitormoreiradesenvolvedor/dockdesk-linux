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
  GripVertical,
} from 'lucide-react';
import type { ContainerStats, ContainerSummary } from '../global';
import { formatBytes } from '../utils';
import { ContainerDetail } from './ContainerDetail';
import { useI18n } from '../i18n';
import { useGroupOrder } from '../hooks/useGroupOrder';
import { useCollapsedGroups } from '../hooks/useCollapsedGroups';

const LOOSE = '__loose__';

interface Props {
  containers: ContainerSummary[];
  stats: Record<string, ContainerStats>;
  onRefresh: () => Promise<void>;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ContainersView({ containers, stats, onRefresh, notify }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<ContainerSummary | null>(null);
  const [initialTab, setInitialTab] = useState<'overview' | 'terminal'>('overview');
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [groupBusy, setGroupBusy] = useState<Record<string, boolean>>({});
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const collapsed = useCollapsedGroups('containers');
  const order = useGroupOrder('containers');

  const filtered = containers.filter(
    (c) =>
      c.name.toLowerCase().includes(filter.toLowerCase()) ||
      c.image.toLowerCase().includes(filter.toLowerCase())
  );

  // agrupa por projeto compose (labels do Docker — vale para projetos que
  // subiram por fora do DockDesk também)
  const groups = new Map<string, ContainerSummary[]>();
  for (const c of filtered) {
    const key = c.composeProject ?? LOOSE;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }
  const orderedKeys = order.sortKeys([...groups.keys()]);
  const hasProjects = orderedKeys.some((k) => k !== LOOSE);

  // mantém o drawer sincronizado com o polling
  const selectedLive = selected
    ? containers.find((c) => c.id === selected.id) ?? selected
    : null;

  async function runAction(c: ContainerSummary, action: string) {
    setBusy((b) => ({ ...b, [c.id]: action }));
    try {
      await window.dockdesk.containers.action(c.id, action);
      await onRefresh();
      if (action === 'remove' && selected?.id === c.id) setSelected(null);
    } catch (err: any) {
      notify(t('action_fail', { action, name: c.name, msg: err.message }));
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[c.id];
        return next;
      });
      setConfirmRemove(null);
    }
  }

  async function runGroupAction(key: string, items: ContainerSummary[], action: 'start' | 'stop') {
    const targets = items.filter((c) =>
      action === 'start' ? c.state !== 'running' : c.state === 'running'
    );
    if (targets.length === 0) return;
    setGroupBusy((g) => ({ ...g, [key]: true }));
    try {
      const results = await Promise.allSettled(
        targets.map((c) => window.dockdesk.containers.action(c.id, action))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) notify(t('group_action_fail', { n: failed }));
      await onRefresh();
    } finally {
      setGroupBusy((g) => {
        const next = { ...g };
        delete next[key];
        return next;
      });
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
          {t(`state_${c.state}`)}
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
                title={t('action_restart')}
                data-testid={`restart-${c.name}`}
                onClick={() => runAction(c, 'restart')}
              >
                <RotateCw size={15} />
              </button>
              <button
                className="btn icon-only danger"
                title={t('action_stop')}
                data-testid={`stop-${c.name}`}
                onClick={() => runAction(c, 'stop')}
              >
                <Square size={15} />
              </button>
              <button
                className="btn icon-only"
                title={t('action_open_terminal')}
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
                title={t('action_start')}
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
                  {t('confirm')}
                </button>
              ) : (
                <button
                  className="btn icon-only danger"
                  title={t('action_remove_container')}
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
          <h1 className="view-title">{t('containers_title')}</h1>
          <div className="view-sub">{t('containers_sub')}</div>
        </div>
        <input
          className="search-input"
          placeholder={t('search_placeholder')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          data-testid="container-search"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Boxes size={44} />
          <h3>{t('empty_containers_title')}</h3>
          <p>
            {containers.length === 0
              ? t('empty_containers_none')
              : t('empty_containers_search')}
          </p>
        </div>
      ) : (
        orderedKeys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === LOOSE;
          const runningCount = items.filter((c) => c.state === 'running').length;
          const testName = isLoose ? 'avulsos' : key;
          const showHeader = !isLoose || hasProjects;
          // busca ativa ou seção sem cabeçalho: sempre expandido
          const isCollapsed = showHeader && filter === '' && collapsed.isCollapsed(key);
          return (
            <section key={key} className="group-section" data-testid={`group-${testName}`}>
              {showHeader && (
                <div
                  className={`group-header ${order.overKey === key ? 'drag-over' : ''}`}
                  {...order.handleProps(key)}
                  {...order.targetProps(key, [...groups.keys()])}
                  onClick={() => collapsed.toggle(key)}
                  data-testid={`group-toggle-${testName}`}
                  title={t('drag_reorder')}
                >
                  <GripVertical size={14} className="grip" />
                  <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                  {isLoose ? (
                    <Boxes size={15} color="#8b949e" />
                  ) : (
                    <Layers size={15} color="#22d3ee" />
                  )}
                  <span className="group-name">
                    {isLoose ? t('group_loose_containers') : key}
                  </span>
                  {!isLoose && <span className="compose-tag">{t('tag_compose')}</span>}
                  <span className={`badge ${runningCount > 0 ? 'running' : 'exited'}`}>
                    {t('running_count', { n: runningCount, total: items.length })}
                  </span>
                  <span
                    className="group-actions"
                    onClick={(e) => e.stopPropagation()}
                    draggable={false}
                    onDragStart={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {groupBusy[key] ? (
                      <button className="btn icon-only" disabled>
                        <Loader2 size={14} className="spin" />
                      </button>
                    ) : (
                      <>
                        {runningCount < items.length && (
                          <button
                            className="btn icon-only success"
                            title={t('group_start_all')}
                            data-testid={`group-start-all-${testName}`}
                            onClick={() => runGroupAction(key, items, 'start')}
                          >
                            <Play size={14} />
                          </button>
                        )}
                        {runningCount > 0 && (
                          <button
                            className="btn icon-only danger"
                            title={t('group_stop_all')}
                            data-testid={`group-stop-all-${testName}`}
                            onClick={() => runGroupAction(key, items, 'stop')}
                          >
                            <Square size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </div>
              )}
              {!isCollapsed && (
                <div className={`container-list ${showHeader ? 'grouped' : ''}`}>
                  {items.map(renderCard)}
                </div>
              )}
            </section>
          );
        })
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
