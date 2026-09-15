<img src="../../build/icon.png" width="72" alt="DockDesk icon" align="left" />

# DockDesk

**Docker without memorizing commands: a complete GUI for Linux.**

<br clear="left"/>

🌐 [Português (BR)](../../README.md) · **English** · [中文](README.zh.md) · [हिन्दी](README.hi.md) · [Español](README.es.md) · [Français](README.fr.md)

---

## The pain it solves

Every team has that project that "just needs a docker compose up"… and someone who gets stuck right there.
Front-end developers, QAs, technical designers, newcomers to the team: people who **need** containers every day but don't want (and shouldn't have to) memorize `docker exec -it`, log flags, or the right order to start services.

DockDesk exists for that audience: **people who develop on projects that use Docker without being Docker experts**. Everything the daily routine requires is one click away, with clear names, in six languages, without hiding what happens underneath (the equivalent commands are shown in the UI).

## What it does

### Containers
- Live list with status, **CPU and memory** usage, mapped ports and search;
- **Start, stop, restart and remove** in one click (removal asks for confirmation);
- Containers **grouped by Compose project** in accordions (including projects started outside DockDesk), with remembered open/collapsed state and **drag-and-drop reordering**;
- Details panel: image, internal IP, networks, ports, volumes/mounts and environment variables.

### Terminal and commands
- **Real interactive terminal** (equivalent to `docker exec -it`), with **automatic detection of the shells** available in the image (bash, zsh, fish, ash, sh…) so you can pick one;
- **Run command** with output, stderr and exit code, no terminal needed;
- **Live logs** with smart auto-scroll;
- Tabs preserve what is running when you switch, with clear buttons.

### Routines (per-container shortcuts)
- Create buttons like `htop`, `npm run dev` or `composer install`;
- **Partial routines**: a fixed command (e.g. `cd /home/project`) asks for its complement at run time (e.g. `&& npm install`);
- **`[--]` marker**: write `[--]` in the command to say **where** the complement goes instead of only at the end — the typed text fills **every** marker (e.g. `cd /app/[--] && npm run [--]`);
- **Name and command wrap on their own** when they get long, and the line breaks you type (Enter) are honoured when running;
- The editor fields **grow with the text** and have a **resize handle**: once you drag it, the height is the one you picked;
- Each routine runs in **its own terminal attached to its row**, visible while the process lives (perfect for `npm run dev`), with a **running indicator**, minimize and a stop button;
- Saved by container name: they survive container recreation.

### Compose projects
- Point DockDesk at your projects folder and it **finds the `docker-compose.yml` files by itself** (up to 4 levels deep, skipping `node_modules` and the like);
- **Up (`up -d`), down and restart** in one click, real-time output console and running-services count;
- Contextual buttons: "Up" disappears when everything is running; "Restart/Down" only appear when something is up.

### Images, volumes and networks
- All grouped by their Compose project, with reorderable accordions;
- Protected removal (warns when the resource is in use);
- Docker's default networks are flagged and protected against removal.

### Experience
- **Light/dark theme** with one click;
- **6 languages**: Português (BR), English, 中文, हिन्दी, Español and Français, in the UI and the tray;
- **System tray**: closing hides to the tray; options to start with the system and start hidden;
- **Single instance**: opening again just focuses the existing window;
- Group order, theme, language and accordion states persist across sessions.

![DockDesk, containers view](../screenshot-containers.png)

## Installation

Download the latest `.AppImage` from [Releases](https://github.com/vitormoreiradesenvolvedor/dockdesk-linux/releases), make it executable and run it:

```bash
chmod +x DockDesk-*.AppImage
./DockDesk-*.AppImage
```

**Requirements:** Linux with Docker Engine running and your user in the `docker` group
(`sudo usermod -aG docker $USER`); Docker Compose v2 for the projects area.

## Development

```bash
npm install          # also enables the project git hooks
npm start            # renderer build + opens the app
npm run test:e2e     # end-to-end tests (Playwright + real Docker)
npm run dist         # builds the AppImage into release/
```

- **Architecture:** `electron/` (main process: Docker via socket with dockerode, exposed through `contextBridge`) · `src/` (React + TypeScript + Vite, terminal with xterm.js) · `tests/e2e/` (Playwright driving the real app).
- **Git flow and governance:** branch, commit, PR rules and automated release in [docs/git/governanca.en.md](../git/governanca.en.md).
