import { Anchor, Boxes, Layers, HardDrive, Database, Network } from 'lucide-react';

export type ViewName = 'containers' | 'compose' | 'images' | 'volumes' | 'networks';

interface Props {
  view: ViewName;
  onNavigate: (v: ViewName) => void;
  engine: { ok: boolean; version?: string; error?: string };
  runningCount: number;
  totalCount: number;
}

export function Sidebar({ view, onNavigate, engine, runningCount, totalCount }: Props) {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-mark">
          <Anchor size={19} strokeWidth={2.4} />
        </div>
        <div className="logo-name">
          Dock<span>Desk</span>
        </div>
      </div>

      <button
        className={`nav-item ${view === 'containers' ? 'active' : ''}`}
        onClick={() => onNavigate('containers')}
        data-testid="nav-containers"
      >
        <Boxes size={17} />
        Containers
        <span className="nav-badge">
          {runningCount}/{totalCount}
        </span>
      </button>

      <button
        className={`nav-item ${view === 'compose' ? 'active' : ''}`}
        onClick={() => onNavigate('compose')}
        data-testid="nav-compose"
      >
        <Layers size={17} />
        Projetos Compose
      </button>

      <button
        className={`nav-item ${view === 'images' ? 'active' : ''}`}
        onClick={() => onNavigate('images')}
        data-testid="nav-images"
      >
        <HardDrive size={17} />
        Imagens
      </button>

      <button
        className={`nav-item ${view === 'volumes' ? 'active' : ''}`}
        onClick={() => onNavigate('volumes')}
        data-testid="nav-volumes"
      >
        <Database size={17} />
        Volumes
      </button>

      <button
        className={`nav-item ${view === 'networks' ? 'active' : ''}`}
        onClick={() => onNavigate('networks')}
        data-testid="nav-networks"
      >
        <Network size={17} />
        Redes
      </button>

      <div className="sidebar-footer" data-testid="engine-status">
        <span className={`engine-dot ${engine.ok ? 'ok' : ''}`} />
        {engine.ok ? `Docker ${engine.version}` : 'Docker indisponível'}
      </div>
    </aside>
  );
}
