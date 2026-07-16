export interface ContainerSummary {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: 'running' | 'exited' | 'paused' | 'created' | 'restarting' | 'dead';
  status: string;
  created: number;
  ports: { public: number | null; private: number; type: string }[];
  composeProject: string | null;
  composeService: string | null;
  composeWorkingDir: string | null;
}

export interface ContainerStats {
  cpu: number;
  memUsed: number;
  memLimit: number;
  netRx: number;
  netTx: number;
}

export interface ContainerDetails {
  id: string;
  name: string;
  image: string;
  created: string;
  state: {
    Status: string;
    Running: boolean;
    StartedAt: string;
    ExitCode: number;
    [k: string]: unknown;
  };
  restartCount: number;
  platform: string;
  env: string[];
  cmd: string[] | null;
  entrypoint: string[] | null;
  workingDir: string;
  mounts: { type: string; source: string; destination: string; rw: boolean }[];
  networks: string[];
  ipAddress: string | null;
  ports: Record<string, { HostIp: string; HostPort: string }[] | null>;
}

export interface ComposeProject {
  file: string;
  dir: string;
  name: string;
  fileName: string;
  services: string[];
  rootFolder: string;
}

export interface ComposeStatus {
  running: number;
  total: number;
  containers: { name: string; service: string; state: string; status: string }[];
}

export interface ImageSummary {
  id: string;
  shortId: string;
  tags: string[];
  size: number;
  created: number;
  project: string | null;
}

export interface ExecResult {
  output: string;
  stderr: string;
  exitCode: number | null;
}

export interface VolumeSummary {
  name: string;
  driver: string;
  mountpoint: string;
  created: string | null;
  project: string | null;
  usedBy: string[];
}

export interface NetworkSummary {
  id: string;
  name: string;
  driver: string;
  scope: string;
  builtin: boolean;
  project: string | null;
  containers: string[];
}

export interface Routine {
  id: string;
  label: string;
  command: string;
  partial: boolean;
}

export interface DockDeskApi {
  engine: {
    ping: () => Promise<{ ok: boolean; version?: string; apiVersion?: string; error?: string }>;
  };
  containers: {
    list: () => Promise<ContainerSummary[]>;
    action: (id: string, action: string) => Promise<{ ok: boolean }>;
    inspect: (id: string) => Promise<ContainerDetails>;
    stats: () => Promise<Record<string, ContainerStats>>;
  };
  shells: {
    detect: (id: string) => Promise<string[]>;
  };
  exec: {
    command: (id: string, cmd: string) => Promise<ExecResult>;
  };
  term: {
    open: (
      id: string,
      spec: { shell: string } | { command: string },
      termId: string
    ) => Promise<void>;
    write: (termId: string, data: string) => void;
    resize: (termId: string, cols: number, rows: number) => void;
    close: (termId: string) => void;
    onData: (termId: string, cb: (data: Uint8Array) => void) => () => void;
    onExit: (termId: string, cb: () => void) => () => void;
  };
  logs: {
    start: (id: string) => Promise<boolean>;
    stop: (id: string) => void;
    onData: (id: string, cb: (text: string) => void) => () => void;
  };
  images: {
    list: () => Promise<ImageSummary[]>;
    remove: (id: string) => Promise<{ ok: boolean }>;
  };
  volumes: {
    list: () => Promise<VolumeSummary[]>;
    remove: (name: string) => Promise<{ ok: boolean }>;
  };
  networks: {
    list: () => Promise<NetworkSummary[]>;
    remove: (id: string) => Promise<{ ok: boolean }>;
  };
  routines: {
    list: (key: string) => Promise<Routine[]>;
    save: (key: string, list: Routine[]) => Promise<Routine[]>;
  };
  settings: {
    setLang: (lang: string) => Promise<boolean>;
    getTrayEnabled: () => Promise<boolean>;
    setTrayEnabled: (enabled: boolean) => Promise<boolean>;
  };
  compose: {
    folders: () => Promise<string[]>;
    addFolder: () => Promise<string[] | null>;
    addFolderPath: (folder: string) => Promise<string[]>;
    removeFolder: (folder: string) => Promise<string[]>;
    scan: () => Promise<ComposeProject[]>;
    status: (file: string) => Promise<ComposeStatus>;
    run: (file: string, action: 'up' | 'down' | 'restart' | 'pull') => Promise<string>;
    onOutput: (runId: string, cb: (text: string) => void) => () => void;
    onDone: (runId: string, cb: (exitCode: number) => void) => () => void;
  };
}

declare global {
  const __APP_VERSION__: string;
  interface Window {
    dockdesk: DockDeskApi;
  }
}
