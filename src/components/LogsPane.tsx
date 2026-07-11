import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';

export function LogsPane({ containerId }: { containerId: string }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const preRef = useRef<HTMLPreElement>(null);
  const pinnedToBottom = useRef(true);

  useEffect(() => {
    setText('');
    // inscreve antes de iniciar o stream para não perder o "tail" inicial
    const unsub = window.dockdesk.logs.onData(containerId, (chunk) => {
      setText((t) => (t + chunk).slice(-200_000));
    });
    window.dockdesk.logs.start(containerId).catch(() => {});

    return () => {
      unsub();
      window.dockdesk.logs.stop(containerId);
    };
  }, [containerId]);

  useEffect(() => {
    const el = preRef.current;
    if (el && pinnedToBottom.current) el.scrollTop = el.scrollHeight;
  }, [text]);

  return (
    <pre
      className="logs-output"
      ref={preRef}
      data-testid="logs-output"
      onScroll={(e) => {
        const el = e.currentTarget;
        pinnedToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 30;
      }}
    >
      {text || t('logs_waiting')}
    </pre>
  );
}
