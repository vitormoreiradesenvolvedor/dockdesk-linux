import { useCallback, useEffect, useState } from 'react';
import { Database, Trash2, Loader2, RefreshCw, ChevronDown, Layers, Boxes } from 'lucide-react';
import type { VolumeSummary } from '../global';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function VolumesView({ notify }: Props) {
  const [volumes, setVolumes] = useState<VolumeSummary[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setVolumes(await window.dockdesk.volumes.list());
    } catch (err: any) {
      notify(`Falha ao listar volumes: ${err.message}`);
    }
  }, [notify]);

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
        `Não foi possível remover o volume: ${
          /in use|being used/i.test(err.message) ? 'ele está em uso por um container.' : err.message
        }`
      );
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  function toggle(key: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const groups = new Map<string, VolumeSummary[]>();
  for (const v of volumes ?? []) {
    const key = v.project ?? '__loose__';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }
  const keys = [...groups.keys()].sort((a, b) =>
    a === '__loose__' ? 1 : b === '__loose__' ? -1 : a.localeCompare(b)
  );

  return (
    <section className="view" data-testid="volumes-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Volumes</h1>
          <div className="view-sub">
            Volumes Docker desta máquina, agrupados pelo projeto Compose de origem.
          </div>
        </div>
        <button className="btn" onClick={refresh} data-testid="volumes-refresh">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {volumes === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : volumes.length === 0 ? (
        <div className="empty-state">
          <Database size={44} />
          <h3>Nenhum volume</h3>
          <p>Volumes criados por containers ou projetos Compose aparecem aqui.</p>
        </div>
      ) : (
        keys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === '__loose__';
          const isCollapsed = collapsed.has(key);
          return (
            <section key={key} className="group-section" data-testid={`volume-group-${isLoose ? 'avulsos' : key}`}>
              <button className="group-header" onClick={() => toggle(key)}>
                <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                {isLoose ? <Boxes size={15} color="#8b949e" /> : <Layers size={15} color="#22d3ee" />}
                <span className="group-name">{isLoose ? 'Volumes avulsos' : key}</span>
                {!isLoose && <span className="compose-tag">compose</span>}
                <span className="badge exited">{items.length}</span>
              </button>
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
                        {v.usedBy.length ? 'Em uso' : 'Livre'}
                      </span>
                      {busy === v.name ? (
                        <button className="btn sm" disabled>
                          <Loader2 size={13} className="spin" />
                        </button>
                      ) : confirmRemove === v.name ? (
                        <button className="btn sm danger" onClick={() => remove(v)}>
                          Confirmar?
                        </button>
                      ) : (
                        <button
                          className="btn icon-only sm danger"
                          title="Remover volume"
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
