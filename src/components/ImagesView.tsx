import { useCallback, useEffect, useState } from 'react';
import { Trash2, HardDrive, Loader2, RefreshCw } from 'lucide-react';
import type { ImageSummary } from '../global';
import { formatBytes, formatDate } from '../utils';

interface Props {
  notify: (text: string, kind?: 'error' | 'info') => void;
}

export function ImagesView({ notify }: Props) {
  const [images, setImages] = useState<ImageSummary[] | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setImages(await window.dockdesk.images.list());
    } catch (err: any) {
      notify(`Falha ao listar imagens: ${err.message}`);
    }
  }, [notify]);

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
        `Não foi possível remover a imagem: ${
          /conflict|being used|container/i.test(err.message)
            ? 'ela está em uso por um container.'
            : err.message
        }`
      );
    } finally {
      setBusy(null);
      setConfirmRemove(null);
    }
  }

  return (
    <section className="view" data-testid="images-view">
      <div className="view-header">
        <div>
          <h1 className="view-title">Imagens</h1>
          <div className="view-sub">Imagens Docker disponíveis nesta máquina.</div>
        </div>
        <button className="btn" onClick={refresh} data-testid="images-refresh">
          <RefreshCw size={15} /> Atualizar
        </button>
      </div>

      {images === null ? (
        <div className="empty-state">
          <Loader2 size={36} className="spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="empty-state">
          <HardDrive size={44} />
          <h3>Nenhuma imagem local</h3>
          <p>Imagens baixadas ou construídas aparecem aqui.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Tags</th>
              <th>ID</th>
              <th>Tamanho</th>
              <th>Criada em</th>
              <th style={{ width: 120 }}></th>
            </tr>
          </thead>
          <tbody>
            {images.map((img) => (
              <tr key={img.id} data-testid={`image-row-${img.shortId}`}>
                <td>
                  {img.tags.length === 0 ? (
                    <span className="tag-chip">&lt;sem tag&gt;</span>
                  ) : (
                    img.tags.map((t) => (
                      <span key={t} className="tag-chip">
                        {t}
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
                      Confirmar?
                    </button>
                  ) : (
                    <button
                      className="btn sm danger icon-only"
                      title="Remover imagem"
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
      )}
    </section>
  );
}
