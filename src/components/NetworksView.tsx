import { useCallback, useEffect, useState } from 'react';
import {
  Network,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  Layers,
  Boxes,
  Lock,
  GripVertical,
} from 'lucide-react';
import type { NetworkSummary } from '../global';
import { useI18n } from '../i18n';
import { useGroupOrder } from '../hooks/useGroupOrder';
import { useCollapsedGroups } from '../hooks/useCollapsedGroups';

const LOOSE = '__loose__';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function NetworksView({ notify }: Props) {
  const { t } = useI18n();
  const [networks, setNetworks] = useState<NetworkSummary[] | null>(null);
  const collapsed = useCollapsedGroups('networks');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const order = useGroupOrder('networks');

  const refresh = useCallback(async () => {
    try {
      setNetworks(await window.dockdesk.networks.list());
    } catch (err: any) {
      notify(t('networks_fail', { msg: err.message }));
    }
  }, [notify, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function remove(n: NetworkSummary) {
    setBusy(n.id);
    try {
      await window.dockdesk.networks.remove(n.id);
      await refresh();
    } catch (err: any) {
      notify(
        /active endpoints|in use/i.test(err.message)
          ? t('network_in_use_err')
          : t('network_remove_fail', { msg: err.message })
      );
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  const groups = new Map<string, NetworkSummary[]>();
  for (const n of networks ?? []) {
    const key = n.project ?? LOOSE;
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }
  const orderedKeys = order.sortKeys([...groups.keys()]);

  return (
    <section className="view" data-testid="networks-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">{t('networks_title')}</h1>
          <div className="view-sub">{t('networks_sub')}</div>
        </div>
        <button className="btn" onClick={refresh} data-testid="networks-refresh">
          <RefreshCw size={15} /> {t('refresh')}
        </button>
      </div>

      {networks === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : (
        orderedKeys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === LOOSE;
          const isCollapsed = collapsed.isCollapsed(key);
          const testName = isLoose ? 'avulsas' : key;
          return (
            <section key={key} className="group-section" data-testid={`network-group-${testName}`}>
              <div
                className={`group-header ${order.overKey === key ? 'drag-over' : ''}`}
                {...order.handleProps(key)}
                {...order.targetProps(key, [...groups.keys()])}
                onClick={() => collapsed.toggle(key)}
                data-testid={`network-group-toggle-${testName}`}
                title={t('drag_reorder')}
              >
                <GripVertical size={14} className="grip" />
                <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                {isLoose ? (
                  <Boxes size={15} color="#8b949e" />
                ) : (
                  <Layers size={15} color="#22d3ee" />
                )}
                <span className="group-name">{isLoose ? t('group_loose_networks') : key}</span>
                {!isLoose && <span className="compose-tag">{t('tag_compose')}</span>}
                <span className="badge exited">{items.length}</span>
              </div>
              {!isCollapsed && (
                <div className="container-list grouped">
                  {items.map((n) => (
                    <div key={n.id} className="resource-card" data-testid={`network-${n.name}`}>
                      <Network size={17} color="#8b949e" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="container-name">
                          {n.name}
                          {n.builtin && (
                            <span
                              className="compose-tag"
                              style={{ color: '#8b949e', background: 'rgba(139,148,158,0.12)' }}
                            >
                              <Lock size={9} style={{ marginRight: 3 }} />
                              {t('net_builtin')}
                            </span>
                          )}
                        </div>
                        <div className="container-image">
                          {n.driver} · {n.scope}
                        </div>
                        {n.containers.length > 0 && (
                          <div className="container-ports">
                            {n.containers.map((c) => (
                              <span key={c} className="port-chip">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`badge ${n.containers.length ? 'running' : 'exited'}`}>
                        {n.containers.length
                          ? t('net_connected', { n: n.containers.length })
                          : t('net_none')}
                      </span>
                      {!n.builtin &&
                        (busy === n.id ? (
                          <button className="btn sm" disabled>
                            <Loader2 size={13} className="spin" />
                          </button>
                        ) : confirmRemove === n.id ? (
                          <button className="btn sm danger" onClick={() => remove(n)}>
                            {t('confirm')}
                          </button>
                        ) : (
                          <button
                            className="btn icon-only sm danger"
                            title={t('remove_network')}
                            onClick={() => setConfirmRemove(n.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })
      )}
    </section>
  );
}
