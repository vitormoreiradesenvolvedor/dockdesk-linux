import { useCallback, useEffect, useState } from 'react';
import {
  Database,
  Trash2,
  Loader2,
  RefreshCw,
  ChevronDown,
  Layers,
  Boxes,
  GripVertical,
} from 'lucide-react';
import type { VolumeSummary } from '../global';
import { useI18n } from '../i18n';
import { useGroupOrder } from '../hooks/useGroupOrder';
import { useCollapsedGroups } from '../hooks/useCollapsedGroups';

const LOOSE = '__loose__';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
  privacyProject: string | null;
}

export function VolumesView({ notify, privacyProject }: Props) {
  const { t } = useI18n();
  const [volumes, setVolumes] = useState<VolumeSummary[] | null>(null);
  const collapsed = useCollapsedGroups('volumes');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const order = useGroupOrder('volumes');

  const refresh = useCallback(async () => {
    try {
      setVolumes(await window.dockdesk.volumes.list());
    } catch (err: any) {
      notify(t('volumes_fail', { msg: err.message }));
    }
  }, [notify, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function remove(v: VolumeSummary) {
    setBusy(v.name);
    try {
      await window.dockdesk.volumes.remove(v.name);
      await refresh();
    } catch (err: any) {
      notify(
        /in use|being used/i.test(err.message)
          ? t('volume_in_use_err')
          : t('volume_remove_fail', { msg: err.message })
      );
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  const visible = privacyProject
    ? (volumes ?? []).filter((v) => v.project === privacyProject)
    : (volumes ?? []);

  const groups = new Map<string, VolumeSummary[]>();
  for (const v of visible) {
    const key = v.project ?? LOOSE;
    const list = groups.get(key) ?? [];
    list.push(v);
    groups.set(key, list);
  }
  const orderedKeys = order.sortKeys([...groups.keys()]);

  return (
    <section className="view" data-testid="volumes-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">{t('volumes_title')}</h1>
          <div className="view-sub">{t('volumes_sub')}</div>
        </div>
        <button className="btn" onClick={refresh} data-testid="volumes-refresh">
          <RefreshCw size={15} /> {t('refresh')}
        </button>
      </div>

      {volumes === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Database size={44} />
          <h3>{t('volumes_empty_title')}</h3>
          <p>{t('volumes_empty_text')}</p>
        </div>
      ) : (
        orderedKeys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === LOOSE;
          const isCollapsed = collapsed.isCollapsed(key);
          const testName = isLoose ? 'avulsos' : key;
          return (
            <section key={key} className="group-section" data-testid={`volume-group-${testName}`}>
              <div
                className={`group-header ${order.overKey === key ? 'drag-over' : ''}`}
                {...order.handleProps(key)}
                {...order.targetProps(key, [...groups.keys()])}
                onClick={() => collapsed.toggle(key)}
                data-testid={`volume-group-toggle-${testName}`}
                title={t('drag_reorder')}
              >
                <GripVertical size={14} className="grip" />
                <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                {isLoose ? (
                  <Boxes size={15} color="#8b949e" />
                ) : (
                  <Layers size={15} color="#22d3ee" />
                )}
                <span className="group-name">{isLoose ? t('group_loose_volumes') : key}</span>
                {!isLoose && <span className="compose-tag">{t('tag_compose')}</span>}
                <span className="badge exited">{items.length}</span>
              </div>
              {!isCollapsed && (
                <div className="container-list grouped">
                  {items.map((v) => (
                    <div key={v.name} className="resource-card" data-testid={`volume-${v.name}`}>
                      <Database size={17} color="#8b949e" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="container-name">{v.name}</div>
                        <div className="container-image">
                          {v.driver} · {v.mountpoint}
                        </div>
                        {v.usedBy.length > 0 && (
                          <div className="container-ports">
                            {v.usedBy.map((c) => (
                              <span key={c} className="port-chip">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className={`badge ${v.usedBy.length ? 'running' : 'exited'}`}>
                        {v.usedBy.length ? t('vol_in_use') : t('vol_free')}
                      </span>
                      {busy === v.name ? (
                        <button className="btn sm" disabled>
                          <Loader2 size={13} className="spin" />
                        </button>
                      ) : confirmRemove === v.name ? (
                        <button className="btn sm danger" onClick={() => remove(v)}>
                          {t('confirm')}
                        </button>
                      ) : (
                        <button
                          className="btn icon-only sm danger"
                          title={t('remove_volume')}
                          onClick={() => setConfirmRemove(v.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
