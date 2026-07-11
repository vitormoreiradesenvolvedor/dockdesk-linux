import { useCallback, useEffect, useState } from 'react';
import { Network, Trash2, Loader2, RefreshCw, ChevronDown, Layers, Boxes, Lock } from 'lucide-react';
import type { NetworkSummary } from '../global';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function NetworksView({ notify }: Props) {
  const [networks, setNetworks] = useState<NetworkSummary[] | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setNetworks(await window.dockdesk.networks.list());
    } catch (err: any) {
      notify(`Falha ao listar redes: ${err.message}`);
    }
  }, [notify]);

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
        `Não foi possível remover a rede: ${
          /active endpoints|in use/i.test(err.message)
            ? 'há containers conectados a ela.'
            : err.message
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

  const groups = new Map<string, NetworkSummary[]>();
  for (const n of networks ?? []) {
    const key = n.project ?? '__loose__';
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(n);
  }
  const keys = [...groups.keys()].sort((a, b) =>
    a === '__loose__' ? 1 : b === '__loose__' ? -1 : a.localeCompare(b)
  );

  return (
    <section className="view" data-testid="networks-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Redes</h1>
          <div className="view-sub">
            Redes Docker desta máquina, agrupadas pelo projeto Compose de origem.
          </div>
        </div>
        <button className="btn" onClick={refresh} data-testid="networks-refresh">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {networks === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : (
        keys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === '__loose__';
          const isCollapsed = collapsed.has(key);
          return (
            <section key={key} className="group-section" data-testid={`network-group-${isLoose ? 'avulsas' : key}`}>
              <button className="group-header" onClick={() => toggle(key)}>
                <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                {isLoose ? <Boxes size={15} color="#8b949e" /> : <Layers size={15} color="#22d3ee" />}
                <span className="group-name">{isLoose ? 'Redes avulsas' : key}</span>
                {!isLoose && <span className="compose-tag">compose</span>}
                <span className="badge exited">{items.length}</span>
              </button>
              {!isCollapsed && (
                <div className="container-list grouped">
                  {items.map((n) => (
                    <div key={n.id} className="resource-card" data-testid={`network-${n.name}`}>
                      <Network size={17} color="#8b949e" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="container-name">
                          {n.name}
                          {n.builtin && (
                            <span className="compose-tag" style={{ color: '#8b949e', background: 'rgba(139,148,158,0.12)' }}>
                              <Lock size={9} style={{ marginRight: 3 }} />
                              padrão do Docker
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
                          ? `${n.containers.length} conectado${n.containers.length > 1 ? 's' : ''}`
                          : 'Sem conexões'}
                      </span>
                      {!n.builtin &&
                        (busy === n.id ? (
                          <button className="btn sm" disabled>
                            <Loader2 size={13} className="spin" />
                          </button>
                        ) : confirmRemove === n.id ? (
                          <button className="btn sm danger" onClick={() => remove(n)}>
                            Confirmar?
                          </button>
                        ) : (
                          <button
                            className="btn icon-only sm danger"
                            title="Remover rede"
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
