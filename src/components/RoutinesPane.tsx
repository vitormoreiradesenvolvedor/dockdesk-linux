import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import {
  Play,
  Plus,
  Pencil,
  Trash2,
  ListChecks,
  Loader2,
  Lightbulb,
  Square,
  X,
  ChevronDown,
} from 'lucide-react';
import type { ContainerSummary, Routine } from '../global';
import { useI18n } from '../i18n';
import { InlineTerminal } from './InlineTerminal';
import {
  ROUTINE_PLACEHOLDER,
  buildRoutineCommand,
  hasCommandPlaceholder,
  isPartialRoutine,
  normalizeCommand,
  normalizeLabel,
} from '../utils';

interface Session {
  command: string;
  exited: boolean;
  minimized: boolean;
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
    setSessions((s) => ({
      ...s,
      [routine.id]: { command, exited: false, minimized: false },
    }));
  }

  function toggleMinimized(id: string) {
    setSessions((s) =>
      s[id] ? { ...s, [id]: { ...s[id], minimized: !s[id].minimized } } : s
    );
  }

  function run(routine: Routine) {
    if (sessions[routine.id] && !sessions[routine.id].exited) return; // já rodando
    if (isPartialRoutine(routine)) {
      setComplementFor(routine);
    } else {
      // normaliza na saída: o comando vai ao sh -c com as quebras que a pessoa
      // digitou, sem nada que a quebra automática da tela tenha sugerido
      start(routine, normalizeCommand(routine.command));
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
            const inline = hasCommandPlaceholder(r.command);
            const partial = isPartialRoutine(r);
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
                        : inline
                          ? t('routine_run_inline')
                          : partial
                            ? t('routine_run_partial')
                            : t('routine_run')
                    }
                  >
                    {isRunning ? <Loader2 size={15} className="spin" /> : <Play size={15} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="routine-label">
                      <span className="routine-label-text">{r.label}</span>
                      {partial && (
                        <span
                          className="compose-tag"
                          title={inline ? t('routine_run_inline') : t('routine_run_partial')}
                        >
                          {inline ? t('routines_inline_badge') : t('routines_partial_badge')}
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
                    <CommandText
                      className="routine-cmd"
                      text={session ? session.command : r.command}
                      suffix={!session && partial && !inline ? ' …' : ''}
                    />
                  </div>
                  {session && (
                    <button
                      className="btn icon-only sm"
                      title={session.minimized ? t('routine_expand') : t('routine_minimize')}
                      onClick={() => toggleMinimized(r.id)}
                      data-testid={`routine-toggle-term-${r.label}`}
                    >
                      <ChevronDown
                        size={14}
                        className={`chevron ${session.minimized ? 'closed' : ''}`}
                      />
                    </button>
                  )}
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
                  // minimizado esconde via CSS: o InlineTerminal continua
                  // montado e a sessão (ex.: npm run dev) segue viva
                  <div
                    className="routine-terminal"
                    data-testid={`routine-terminal-${r.label}`}
                    style={{ display: session.minimized ? 'none' : 'block' }}
                  >
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
            start(complementFor, buildRoutineCommand(complementFor.command, complement));
            setComplementFor(null);
          }}
        />
      )}
    </div>
  );
}

/**
 * Comando renderizado com quebra automática: `pre-wrap` preserva as quebras
 * digitadas e a CSS quebra sozinha o que passar da largura. O marcador [--]
 * ganha destaque para ficar claro onde o complemento vai entrar.
 */
function CommandText({
  text,
  className,
  suffix = '',
}: {
  text: string;
  className: string;
  suffix?: string;
}) {
  const parts = text.split(ROUTINE_PLACEHOLDER);
  return (
    <code className={className}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="cmd-slot">{ROUTINE_PLACEHOLDER}</span>}
          {part}
        </Fragment>
      ))}
      {suffix}
    </code>
  );
}

/**
 * Campo de texto que cresce junto com o conteúdo, então nome e comando longos
 * quebram a linha e continuam visíveis inteiros. Enter quebra a linha;
 * Ctrl/Cmd+Enter envia o formulário.
 */
function AutoTextarea({
  value,
  onChange,
  onSubmit,
  placeholder,
  testId,
  autoFocus,
  className = 'exec-input',
  maxHeight = 180,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  testId?: string;
  autoFocus?: boolean;
  className?: string;
  maxHeight?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // remede a altura a cada mudança: some com a barra de rolagem até o teto
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`${className} auto-grow`}
      value={value}
      placeholder={placeholder}
      data-testid={testId}
      autoFocus={autoFocus}
      spellCheck={false}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onSubmit?.();
        }
      }}
    />
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

  // com [--] no comando a rotina já é parcial por definição: o complemento
  // precisa de um lugar para entrar
  const usesPlaceholder = hasCommandPlaceholder(command);
  const cleanLabel = normalizeLabel(label);
  const cleanCommand = normalizeCommand(command);
  const canSave = !!cleanLabel && !!cleanCommand;

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSave) return;
    onSave({
      id: routine?.id ?? `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: cleanLabel,
      command: cleanCommand,
      partial: partial || usesPlaceholder,
    });
  }

  return (
    <Modal title={routine ? t('routine_editor_edit') : t('routine_editor_new')} onClose={onCancel}>
      <form onSubmit={submit} className="modal-form" data-testid="routine-editor">
        <label>
          {t('routine_name_label')}
          <AutoTextarea
            value={label}
            onChange={setLabel}
            onSubmit={submit}
            placeholder={t('routine_name_ph')}
            testId="routine-label-input"
            maxHeight={90}
            autoFocus
          />
        </label>
        <label>
          {t('routine_cmd_label')}
          <AutoTextarea
            value={command}
            onChange={setCommand}
            onSubmit={submit}
            placeholder={t('routine_cmd_ph')}
            testId="routine-command-input"
          />
        </label>

        <div className="routine-tips" data-testid="routine-tips">
          <Lightbulb size={15} />
          <div>
            <p>
              {t('routine_tip_placeholder_pre')}{' '}
              <code className="cmd-slot">{ROUTINE_PLACEHOLDER}</code>{' '}
              {t('routine_tip_placeholder_pos')}
            </p>
            <p className="routine-tip-sample">
              <code>
                cd /app/<span className="cmd-slot">{ROUTINE_PLACEHOLDER}</span> &amp;&amp; npm run{' '}
                <span className="cmd-slot">{ROUTINE_PLACEHOLDER}</span>
              </code>
            </p>
            <p>{t('routine_tip_multiline')}</p>
          </div>
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={partial || usesPlaceholder}
            disabled={usesPlaceholder}
            onChange={(e) => setPartial(e.target.checked)}
            data-testid="routine-partial-check"
          />
          {usesPlaceholder ? t('routine_partial_locked_label') : t('routine_partial_label')}
        </label>

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={!canSave}
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
  const inline = hasCommandPlaceholder(routine.command);

  // com o campo vazio o preview ainda mostra o marcador, então dá para ver
  // exatamente em quantos lugares o complemento vai entrar
  const preview = complement.trim()
    ? buildRoutineCommand(routine.command, complement)
    : normalizeCommand(routine.command);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    onRun(complement);
  }

  return (
    <Modal title={t('complement_title', { label: routine.label })} onClose={onCancel}>
      <form onSubmit={submit} className="modal-form" data-testid="complement-modal">
        <p className="term-hint" style={{ margin: 0 }}>
          {inline ? t('complement_inline_hint') : t('complement_hint')}
        </p>
        <label>
          {inline ? t('complement_inline_label') : t('complement_label')}
          <AutoTextarea
            value={complement}
            onChange={setComplement}
            onSubmit={submit}
            placeholder={inline ? t('complement_inline_ph') : '&& npm install'}
            testId="complement-input"
            autoFocus
          />
        </label>
        <div className="complement-preview" data-testid="complement-preview">
          <CommandText className="complement-code" text={preview} />
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
