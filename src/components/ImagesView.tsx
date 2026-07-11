import { useCallback, useEffect, useState } from 'react';
import {
  Trash2,
  HardDrive,
  Loader2,
  RefreshCw,
  ChevronDown,
  Layers,
  Boxes,
  GripVertical,
} from 'lucide-react';
import type { ImageSummary } from '../global';
import { formatBytes, formatDate } from '../utils';
import { useI18n } from '../i18n';
import { useGroupOrder } from '../hooks/useGroupOrder';

const LOOSE = '__loose__';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ImagesView({ notify }: Props) {
  const { t } = useI18n();
  const [images, setImages] = useState<ImageSummary[] | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const order = useGroupOrder('images');

  const refresh = useCallback(async () => {
    try {
      setImages(await window.dockdesk.images.list());
    } catch (err: any) {
      notify(t('images_fail', { msg: err.message }));
    }
  }, [notify, t]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function remove(img: ImageSummary) {
    setBusy(img.id);
    try {
      await window.dockdesk.images.remove(img.id);
      await refresh();
    } catch (err: any) {
      notify(
        /conflict|being used|container/i.test(err.message)
          ? t('image_in_use')
          : t('image_remove_fail', { msg: err.message })
      );
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  function toggle(key: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const groups = new Map<string, ImageSummary[]>();
  for (const img of images ?? []) {
    const key = img.project ?? LOOSE;
    const list = groups.get(key) ?? [];
    list.push(img);
    groups.set(key, list);
  }
  const orderedKeys = order.sortKeys([...groups.keys()]);

  return (
    <section className="view" data-testid="images-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">{t('images_title')}</h1>
          <div className="view-sub">{t('images_sub')}</div>
        </div>
        <button className="btn" onClick={refresh} data-testid="images-refresh">
          <RefreshCw size={15} /> {t('refresh')}
        </button>
      </div>

      {images === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <HardDrive size={44} />
          <h3>{t('images_empty_title')}</h3>
          <p>{t('images_empty_text')}</p>
        </div>
      ) : (
        orderedKeys.map((key) => {
          const items = groups.get(key)!;
          const isLoose = key === LOOSE;
          const isCollapsed = collapsed.has(key);
          const testName = isLoose ? 'avulsas' : key;
          return (
            <section key={key} className="group-section" data-testid={`image-group-${testName}`}>
              <div
                className="group-header"
                draggable
                onDragStart={order.onDragStart(key)}
                onDragOver={order.onDragOver}
                onDrop={order.makeOnDrop(key, [...groups.keys()])}
                onClick={() => toggle(key)}
                data-testid={`image-group-toggle-${testName}`}
                title={t('drag_reorder')}
              >
                <GripVertical size={14} className="grip" />
                <ChevronDown size={16} className={`chevron ${isCollapsed ? 'closed' : ''}`} />
                {isLoose ? (
                  <Boxes size={15} color="#8b949e" />
                ) : (
                  <Layers size={15} color="#22d3ee" />
                )}
                <span className="group-name">{isLoose ? t('group_loose_images') : key}</span>
                {!isLoose && <span className="compose-tag">{t('tag_compose')}</span>}
                <span className="badge exited">{items.length}</span>
              </div>
              {!isCollapsed && (
                <div className="container-list grouped">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('col_tags')}</th>
                        <th>{t('col_id')}</th>
                        <th>{t('col_size')}</th>
                        <th>{t('col_created')}</th>
                        <th style={{ width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((img) => (
                        <tr key={img.id} data-testid={`image-row-${img.shortId}`}>
                          <td>
                            {img.tags.length === 0 ? (
                              <span className="tag-chip">{t('no_tag')}</span>
                            ) : (
                              img.tags.map((tag) => (
                                <span key={tag} className="tag-chip">
                                  {tag}
                                </span>
                              ))
                            )}
                          </td>
                          <td className="mono">{img.shortId}</td>
                          <td className="mono">{formatBytes(img.size)}</td>
                          <td className="mono">{formatDate(img.created)}</td>
                          <td style={{ textAlign: 'right' }}>
                            {busy === img.id ? (
                              <button className="btn sm" disabled>
                                <Loader2 size={13} className="spin" />
                              </button>
                            ) : confirmRemove === img.id ? (
                              <button className="btn sm danger" onClick={() => remove(img)}>
                                {t('confirm')}
                              </button>
                            ) : (
                              <button
                                className="btn sm danger icon-only"
                                title={t('remove_image')}
                                onClick={() => setConfirmRemove(img.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })
      )}
    </section>
  );
}
