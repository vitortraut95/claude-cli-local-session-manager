# Claude Session Manager

## IMPORTANTE: HOJE SÓ IMPLEMENTADO PARA FUNCIONAR NO UBUNTU

Gerenciador local das sessões do [Claude CLI](https://claude.com/claude-code). Lê diretamente os
arquivos `*.jsonl` que o `claude` grava em `~/.claude/projects`, sem depender de nenhum servidor
externo — tudo roda na sua máquina.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Axios
- **Backend:** Express + TypeScript + Node.js

## Pré-requisitos

- Linux com ambiente GNOME
- [Node.js](https://nodejs.org/) 20+ e npm
- [Claude CLI](https://claude.com/claude-code) instalado e disponível no `PATH` (comando `claude`)

## Instalação

```bash
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
npm install
```

## Como rodar

```bash
npm run dev
```

- Frontend: http://localhost:58230
- Backend: http://localhost:58231 (o Vite faz proxy de `/sessions` e `/system` para essa porta)

Para parar tudo, use o botão **"Parar aplicação"** no cabeçalho da interface, ou feche o terminal.

## Atalho no GNOME (opcional)

```bash
./install-shortcut.sh
```

Cria o ícone **Claude Session Manager** na Área de Trabalho e no menu de aplicativos, apontando
para a pasta atual do projeto. Clicar nesse ícone:

- **se a aplicação já estiver rodando:** só abre `http://localhost:58230` numa guia do navegador.
- **se não estiver rodando:** abre um terminal e sobe a aplicação (`start.sh` → `npm run dev`).

Se mover a pasta do projeto, rode `./install-shortcut.sh` de novo lá dentro para regerar o atalho
com o caminho novo.

### Remover o atalho

```bash
rm -f ~/.local/share/applications/claude-session-manager.desktop
rm -f ~/Desktop/claude-session-manager.desktop
update-desktop-database ~/.local/share/applications 2>/dev/null
```

Se o ícone também estiver fixado na dock, clique com o botão direito nele e escolha
**"Remover dos favoritos"**.

## Estrutura

```
/
├── install-shortcut.sh    # gera e instala o atalho do GNOME
├── open-terminal.sh       # o que o atalho executa: abre guia se já estiver rodando,
│                          # senão abre um terminal e chama start.sh
├── start.sh               # roda dentro do terminal: cd no projeto + npm run dev
├── server/                # API Express
└── src/                   # SPA React (raiz do workspace "web")
```

O repositório é um monorepo com [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces):
a raiz é o próprio app web e `server/` é o segundo workspace.

## API

| Método | Rota                     | Descrição                                                       |
| ------ | ------------------------ | --------------------------------------------------------------- |
| GET    | `/sessions`              | Lista todas as sessões encontradas em `~/.claude/projects`      |
| DELETE | `/sessions/:id`          | Exclui o arquivo `.jsonl` da sessão                             |
| POST   | `/sessions/:id/continue` | Abre um terminal executando `claude --resume <id>`              |
| POST   | `/system/shutdown`       | Encerra frontend e backend (usado pelo botão "Parar aplicação") |

## Scripts

- `npm run dev` — inicia frontend e backend simultaneamente
- `npm run build` — build de produção de ambos os workspaces
- `npm run lint` — ESLint no frontend e no backend
- `npm run preview` — serve o build de produção do frontend
