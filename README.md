<img src="build/icon.png" width="72" alt="Ícone do DockDesk" align="left" />

# DockDesk

**Docker sem decorar comandos: uma interface gráfica completa para Linux.**

<br clear="left"/>

🌐 **Português (BR)** · [English](docs/i18n/README.en.md) · [中文](docs/i18n/README.zh.md) · [हिन्दी](docs/i18n/README.hi.md) · [Español](docs/i18n/README.es.md) · [Français](docs/i18n/README.fr.md)

---

## A dor que ele resolve

Todo time tem aquele projeto que "é só rodar o docker compose"… e também tem quem trave nessa etapa.
Desenvolvedores front-end, QAs, designers técnicos, gente chegando agora no time: pessoas que **precisam** de containers no dia a dia, mas não querem (nem deveriam precisar) memorizar `docker exec -it`, flags de log ou a ordem certa de subir os serviços.

O DockDesk existe para esse público: **quem desenvolve em projetos que usam Docker, sem ser especialista em Docker**. Tudo que o dia a dia exige está a um clique, com nomes claros, em seis idiomas, e sem esconder o que acontece por baixo (os comandos equivalentes aparecem na interface).

## O que ele faz

### Containers
- Lista com status ao vivo, uso de **CPU e memória**, portas mapeadas e busca;
- **Ligar, parar, reiniciar e remover** com um clique (remoção com confirmação);
- Containers **agrupados por projeto Compose** em sanfonados (inclusive projetos que subiram fora do DockDesk), com estado aberto/recolhido lembrado e **reordenação por arrastar**;
- Painel de detalhes: imagem, IP interno, redes, portas, volumes/montagens e variáveis de ambiente.

### Terminal e comandos
- **Terminal interativo real** (equivalente a `docker exec -it`), com **detecção automática dos shells** disponíveis na imagem (bash, zsh, fish, ash, sh…) para você escolher;
- **Executar comando** avulso com saída, stderr e código de saída, sem abrir terminal;
- **Logs ao vivo** com auto-scroll inteligente;
- As abas preservam o que está rodando ao alternar entre elas, com botões de limpar.

### Rotinas (atalhos por container)
- Crie botões como `htop`, `npm run dev` ou `composer install`;
- **Rotinas parciais**: o comando fixo (ex.: `cd /home/projeto`) pede o complemento na hora de executar (ex.: `&& npm install`);
- **Marcador `[--]`**: escreva `[--]` no comando para dizer **onde** o complemento entra, em vez de só no fim — o texto digitado preenche **todos** os marcadores (ex.: `cd /app/[--] && npm run [--]`);
- **Um valor por marcador**: na hora de executar, escreva um `[-valor-]` para cada marcador e cada um recebe um texto diferente — `cd [--] && ls [--]` com `[-/home-] [-/root-]` roda `cd /home && ls /root`. Dentro do `[-…-]` vale qualquer caractere: espaço, vírgula, ponto, barra, barra invertida e o próprio `-`;
- **Nome e comando quebram a linha sozinhos** quando ficam longos, e as quebras que você digitar (Enter) são respeitadas na execução;
- Os campos do editor **crescem junto com o texto** e têm **alça de redimensionar**: arrastou, a altura passa a ser a que você escolheu;
- Cada rotina roda em um **terminal próprio atrelado à sua linha**, que fica visível enquanto o processo vive (perfeito para `npm run dev`), com **indicador de execução**, minimizar e botão de parar;
- Salvas por nome de container: sobrevivem a recriações.

### Projetos Compose
- Aponte a pasta dos seus projetos e o DockDesk **encontra os `docker-compose.yml` sozinho** (até 4 níveis, ignorando `node_modules` e afins);
- **Subir (`up -d`), derrubar e reiniciar** com um clique, console com a saída em tempo real e contagem de serviços rodando;
- Botões contextuais: "Subir" some quando está tudo no ar; "Reiniciar/Derrubar" só aparecem com algo rodando.

### Imagens, volumes e redes
- Todos agrupados pelo projeto Compose de origem, com sanfonados reordenáveis;
- Remoção protegida (avisa quando o recurso está em uso);
- Redes padrão do Docker marcadas e protegidas contra remoção.

### Experiência
- **Tema claro/escuro** com um clique;
- **6 idiomas**: Português (BR), English, 中文, हिन्दी, Español e Français, na interface e na bandeja;
- **Bandeja do sistema**: fechar esconde para a tray; opções de iniciar com o sistema e iniciar oculto;
- **Instância única**: abrir de novo só foca a janela existente;
- A ordem dos grupos, tema, idioma e estado dos sanfonados persistem entre sessões.

![DockDesk, tela de containers](docs/screenshot-containers.png)

## Instalação

Baixe o `.AppImage` mais recente em [Releases](https://github.com/vitormoreiradesenvolvedor/dockdesk-linux/releases), dê permissão de execução e rode:

```bash
chmod +x DockDesk-*.AppImage
./DockDesk-*.AppImage
```

**Requisitos:** Linux com Docker Engine rodando e seu usuário no grupo `docker`
(`sudo usermod -aG docker $USER`); Docker Compose v2 para a área de projetos.

## Desenvolvimento

```bash
npm install          # também ativa os hooks de git do projeto
npm start            # build do renderer + abre o app
npm run test:e2e     # testes end-to-end (Playwright + Docker real)
npm run dist         # gera o AppImage em release/
```

- **Arquitetura:** `electron/` (processo principal: Docker via socket com dockerode, exposto por `contextBridge`) · `src/` (React + TypeScript + Vite, terminal com xterm.js) · `tests/e2e/` (Playwright dirigindo o app real).
- **Fluxo de git e governança:** regras de branches, commits, PRs e release automatizado em [docs/git/governanca.pt.md](docs/git/governanca.pt.md).
