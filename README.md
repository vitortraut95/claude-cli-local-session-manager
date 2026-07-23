# Claude Session Manager

Gerenciador local das sessões do [Claude CLI](https://claude.com/claude-code). Lê diretamente os
arquivos `*.jsonl` que o `claude` grava em `~/.claude/projects`, sem depender de nenhum servidor
externo — tudo roda na sua máquina.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Axios
- **Backend:** Express + TypeScript + Node.js

## Pré-requisitos

- Linux com ambiente GNOME (o atalho de um clique e o "Continuar" usam `gnome-terminal` /
  `x-terminal-emulator` / `konsole` / `xfce4-terminal` / `xterm` — o primeiro que existir)
- [Node.js](https://nodejs.org/) 20+ e npm
- [Claude CLI](https://claude.com/claude-code) instalado e disponível no `PATH` (comando `claude`)

## Instalação

```bash
git clone https://github.com/vitortraut95/claude-cli-local-session-manager.git
cd claude-cli-local-session-manager
npm install
```

### Criar o atalho no GNOME (opcional, recomendado)

```bash
./install-shortcut.sh
```

Isso cria um ícone **Claude Session Manager** na sua Área de Trabalho e no menu de aplicativos do
GNOME (Atividades), já apontando para a pasta onde você clonou o projeto. Pode clicar nesse ícone
sempre que quiser usar o app — ele abre um terminal, sobe frontend e backend, e abre o navegador
sozinho.

Se depois mover a pasta do projeto para outro lugar, rode `./install-shortcut.sh` de novo lá dentro
para regerar o atalho com o caminho novo.

## Como rodar

Manualmente, sem o atalho:

```bash
npm run dev
```

- Frontend: http://localhost:58230 (abre sozinho no navegador)
- Backend: http://localhost:58231 (o Vite faz proxy de `/sessions` para essa porta em dev)

Portas propositalmente incomuns (58230/58231) para não conflitar com outros projetos em
desenvolvimento (3000, 3001, 5173, 8080 etc.).

Para parar tudo (frontend + backend), use o botão **"Parar aplicação"** no cabeçalho da interface,
ou feche o terminal aberto pelo atalho.

## Estrutura

```
/
├── install-shortcut.sh    # gera e instala o atalho do GNOME
├── start.sh               # script que o atalho executa (roda o npm run dev)
├── server/                # API Express
│   ├── index.ts
│   ├── routes/
│   ├── services/
│   ├── types/
│   └── utils/
└── src/                   # SPA React (raiz do workspace "web")
    ├── components/
    ├── hooks/
    ├── pages/
    ├── services/
    ├── types/
    └── utils/
```

O repositório é um monorepo com [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces):
a raiz é o próprio app web e `server/` é o segundo workspace.

## API

| Método | Rota                     | Descrição                                                  |
| ------ | ------------------------ | ----------------------------------------------------------- |
| GET    | `/sessions`              | Lista todas as sessões encontradas em `~/.claude/projects`   |
| DELETE | `/sessions/:id`          | Exclui o arquivo `.jsonl` da sessão                          |
| POST   | `/sessions/:id/continue` | Abre um terminal executando `claude --resume <id>`           |
| POST   | `/system/shutdown`       | Encerra frontend e backend (usado pelo botão "Parar aplicação") |

## Scripts

- `npm run dev` — inicia frontend e backend simultaneamente
- `npm run build` — build de produção de ambos os workspaces
- `npm run lint` — ESLint no frontend e no backend
- `npm run preview` — serve o build de produção do frontend
