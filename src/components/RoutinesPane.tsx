import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Play, Plus, Pencil, Trash2, ListChecks, Loader2, Square, X } from 'lucide-react';
import type { ContainerSummary, Routine } from '../global';
import { useI18n } from '../i18n';
import { InlineTerminal } from './InlineTerminal';

interface Session {
  command: string;
  exited: boolean;
}

interface Props {
  container: ContainerSummary;
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function RoutinesPane({ container, notify }: Props) {
  const { t } = useI18n();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [complementFor, setComplementFor] = useState<Routine | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // sessões de terminal atreladas à linha de cada rotina (id -> sessão)
  const [sessions, setSessions] = useState<Record<string, Session>>({});

  // rotinas ficam salvas pelo NOME do container: sobrevivem a recriações
  const storageKey = container.name;

  useEffect(() => {
    window.dockdesk.routines.list(storageKey).then(setRoutines);
  }, [storageKey]);

  async function persist(list: Routine[]) {
    setRoutines(list);
    await window.dockdesk.routines.save(storageKey, list);
  }

  function start(routine: Routine, command: string) {
    setSessions((s) => ({ ...s, [routine.id]: { command, exited: false } }));
  }

  function run(routine: Routine) {
    if (sessions[routine.id] && !sessions[routine.id].exited) return; // já rodando
    if (routine.partial) {
      setComplementFor(routine);
    } else {
      start(routine, routine.command);
    }
  }

  function markExited(id: string) {
    setSessions((s) => (s[id] ? { ...s, [id]: { ...s[id], exited: true } } : s));
  }

  function closeSession(id: string) {
    setSessions((s) => {
      const next = { ...s };
      delete next[id];
      return next;
    });
  }

  return (
    <div
      data-testid="routines-pane"
      style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <p className="term-hint" style={{ margin: 0, flex: 1 }}>
          {t('routines_hint')}
        </p>
        <button
          className="btn primary sm"
          onClick={() => setEditing('new')}
          data-testid="routine-new"
        >
          <Plus size={14} /> {t('routines_new')}
        </button>
      </div>

      {routines.length === 0 ? (
        <div className="centered-note">
          <ListChecks size={36} />
          <div>{t('routines_empty')}</div>
        </div>
      ) : (
        <div className="routine-list">
          {routines.map((r) => {
            const session = sessions[r.id];
            const isRunning = !!session && !session.exited;
            return (
              <div
                key={r.id}
                className={`routine-block ${isRunning ? 'running' : ''}`}
                data-testid={`routine-${r.label}`}
              >
                <div className="routine-card">
                  <button
                    className={`routine-run ${isRunning ? 'busy' : ''}`}
                    onClick={() => run(r)}
                    data-testid={`routine-run-${r.label}`}
                    title={
                      isRunning
                        ? t('routine_running')
                        : r.partial
                          ? t('routine_run_partial')
                          : t('routine_run')
                    }
                  >
                    {isRunning ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="routine-label">
                      {r.label}
                      {r.partial && (
                        <span className="compose-tag" title={t('routine_run_partial')}>
                          {t('routines_partial_badge')}
                        </span>
                      )}
                      {isRunning && (
                        <span
                          className="badge running"
                          data-testid={`routine-running-${r.label}`}
                        >
                          {t('routine_running')}
                        </span>
                      )}
                    </div>
                    <code className="routine-cmd">
                      {session ? session.command : r.command}
                      {!session && r.partial ? ' …' : ''}
                    </code>
                  </div>
                  {isRunning && (
                    <button
                      className="btn icon-only sm danger"
                      title={t('routine_stop')}
                      onClick={() => closeSession(r.id)}
                      data-testid={`routine-stop-${r.label}`}
                    >
                      <Square size={13} />
                    </button>
                  )}
                  <button
                    className="btn icon-only sm"
                    title={t('routine_edit')}
                    onClick={() => setEditing(r)}
                    data-testid={`routine-edit-${r.label}`}
                  >
                    <Pencil size={13} />
                  </button>
                  {confirmDelete === r.id ? (
                    <button
                      className="btn sm danger"
                      onClick={() => {
                        persist(routines.filter((x) => x.id !== r.id));
                        setConfirmDelete(null);
                      }}
                    >
                      {t('confirm')}
                    </button>
                  ) : (
                    <button
                      className="btn icon-only sm danger"
                      title={t('routine_delete')}
                      onClick={() => setConfirmDelete(r.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {session && (
                  <div className="routine-terminal" data-testid={`routine-terminal-${r.label}`}>
                    <InlineTerminal
                      containerId={container.id}
                      spec={{ command: session.command }}
                      onExit={() => markExited(r.id)}
                      onError={(msg) => notify(t('term_open_fail', { msg }))}
                      height={220}
                    />
                    <p className="term-hint" style={{ margin: '8px 0 0' }}>
                      {session.exited ? (
                        <>
                          {t('routine_finished')}{' '}
                          <button
                            className="btn sm"
                            onClick={() => closeSession(r.id)}
                            data-testid={`routine-close-${r.label}`}
                          >
                            <X size={13} /> {t('close')}
                          </button>
                        </>
                      ) : (
                        t('routine_terminal_hint')
                      )}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <RoutineEditor
          routine={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(r) => {
            const exists = routines.some((x) => x.id === r.id);
            persist(exists ? routines.map((x) => (x.id === r.id ? r : x)) : [...routines, r]);
            setEditing(null);
          }}
        />
      )}

      {complementFor && (
        <ComplementModal
          routine={complementFor}
          onCancel={() => setComplementFor(null)}
          onRun={(complement) => {
            start(complementFor, `${complementFor.command} ${complement}`.trim());
            setComplementFor(null);
          }}
        />
      )}
    </div>
  );
}

function RoutineEditor({
  routine,
  onSave,
  onCancel,
}: {
  routine: Routine | null;
  onSave: (r: Routine) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [label, setLabel] = useState(routine?.label ?? '');
  const [command, setCommand] = useState(routine?.command ?? '');
  const [partial, setPartial] = useState(routine?.partial ?? false);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!label.trim() || !command.trim()) return;
    onSave({
      id: routine?.id ?? `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: label.trim(),
      command: command.trim(),
      partial,
    });
  }

  return (
    <Modal title={routine ? t('routine_editor_edit') : t('routine_editor_new')} onClose={onCancel}>
      <form onSubmit={submit} className="modal-form" data-testid="routine-editor">
        <label>
          {t('routine_name_label')}
          <input
            className="exec-input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('routine_name_ph')}
            data-testid="routine-label-input"
            autoFocus
          />
        </label>
        <label>
          {t('routine_cmd_label')}
          <input
            className="exec-input"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder={t('routine_cmd_ph')}
            data-testid="routine-command-input"
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={partial}
            onChange={(e) => setPartial(e.target.checked)}
            data-testid="routine-partial-check"
          />
          {t('routine_partial_label')}
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={!label.trim() || !command.trim()}
            data-testid="routine-save"
          >
            {t('save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ComplementModal({
  routine,
  onRun,
  onCancel,
}: {
  routine: Routine;
  onRun: (complement: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [complement, setComplement] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    onRun(complement);
  }

  return (
    <Modal title={t('complement_title', { label: routine.label })} onClose={onCancel}>
      <form onSubmit={submit} className="modal-form" data-testid="complement-modal">
        <p className="term-hint" style={{ margin: 0 }}>
          {t('complement_hint')}
        </p>
        <div className="complement-preview">
          <code>{routine.command}</code>{' '}
          <input
            className="exec-input"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            placeholder="&& npm install"
            data-testid="complement-input"
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button type="submit" className="btn primary" data-testid="complement-run">
            <Play size={14} /> {t('complement_run')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">{title}</h3>
        {children}
      </div>
    </div>
  );
}
