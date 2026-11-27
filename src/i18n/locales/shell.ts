import { dict } from "../dict";

/** The app shell (navigation), the sessions list and detail panel, the Board and queue pages. */
export const shell = {
  // Navigation
  "nav.label": dict("Main", "Principal"),
  "shell.vpnDisconnected": dict(
    "VPN disconnected: nothing new starts (tasks, tests, code reviews) until you connect it.",
    "VPN desconectada: nada novo começa (tarefas, testes, code reviews) até você conectar.",
  ),
  "nav.appName": dict("Session Manager", "Session Manager"),
  "nav.appTagline": dict("Claude CLI · local", "Claude CLI · local"),
  "nav.sessions": dict("Sessions", "Sessões"),
  "nav.sessions.count": dict("{count} not done", "{count} não concluídas"),
  "nav.board": dict("Board", "Board"),
  "nav.board.off": dict("Off: open it to turn it on", "Desligado: abra para ligar"),
  "nav.queue": dict("Task queue", "Fila de tarefas"),
  "nav.queue.short": dict("Queue", "Fila"),
  "nav.queue.hint": dict("New tasks go here", "Novas tarefas entram aqui"),
  "nav.queue.count": dict("{count} waiting in line", "{count} esperando na fila"),
  "nav.cleanup": dict("Cleanup", "Limpeza"),
  "nav.cleanup.heavy": dict(
    "Lots to clean: {count} item(s), about {size}",
    "Muita coisa pra limpar: {count} item(ns), cerca de {size}",
  ),
  "nav.skills": dict("Skills", "Skills"),
  "nav.skills.hint": dict("Skill management", "Gerenciamento de skills"),
  "nav.settings": dict("Settings", "Configurações"),
  "nav.more": dict("More", "Mais"),
  "updateButton.sidebar.available": dict("Update available", "Atualização disponível"),
  "updateButton.sidebar.upToDate": dict("App up to date", "App atualizado"),
  "claudeCli.available": dict(
    "Update Claude CLI to {latest}",
    "Atualizar Claude CLI para {latest}",
  ),
  "claudeCli.updating": dict("Updating Claude CLI…", "Atualizando o Claude CLI…"),
  "claudeCli.tooltip": dict(
    'Claude CLI {version} installed, {latest} available. Click to run "{command}"; sessions already open keep the old version until reopened.',
    'Claude CLI {version} instalado, {latest} disponível. Clique para rodar "{command}"; sessões já abertas seguem na versão antiga até serem reabertas.',
  ),
  "claudeCli.updated": dict(
    "Claude CLI updated to {version}. New sessions use it; reopen the open ones to switch.",
    "Claude CLI atualizado para {version}. Sessões novas já usam; reabra as abertas para trocar.",
  ),
  "claudeCli.updateError": dict(
    "Couldn't update Claude CLI.",
    "Não deu para atualizar o Claude CLI.",
  ),
  "claudeCli.runByHand": dict("Run in a terminal: {command}", "Rode num terminal: {command}"),

  // Sessions page
  "sessions.title": dict("Sessions", "Sessões"),
  "sessions.summary": dict(
    "{total} sessions · {running} running · {attention} need you",
    "{total} sessões · {running} rodando · {attention} precisam de você",
  ),
  "sessions.quick.label": dict("Show", "Mostrar"),
  "sessions.quick.all": dict("All", "Todas"),
  "sessions.quick.attention": dict("Needs you", "Precisa de você"),
  "sessions.quick.running": dict("Running", "Rodando"),
  "sessions.view.label": dict("View", "Visualização"),
  "sessions.view.list": dict("List", "Lista"),
  "sessions.view.cards": dict("Cards", "Cards"),
  "sessions.sort.label": dict("Order", "Ordem"),
  "sessions.sort.groups": dict(
    "By group: running, needs you, stopped, done",
    "Por grupo: rodando, precisa de você, paradas, concluídas",
  ),
  "sessions.sort.date": dict("By date, newest first", "Por data, mais recentes primeiro"),
  "sessions.updatedAgo": dict("Updated {when}", "Atualizado {when}"),
  "sessions.search.shortcut": dict("Press / to search", "Aperte / para buscar"),
  "sessions.group.attention": dict("Needs you", "Precisa de você"),
  "sessions.group.attention.hint": dict(
    "errors and pending answers first",
    "erros e respostas pendentes primeiro",
  ),
  "sessions.group.running": dict("Running now", "Rodando agora"),
  "sessions.group.stopped": dict("Stopped", "Paradas"),
  "sessions.group.done": dict("Done", "Concluídas"),
  "sessions.done.show": dict("Show the {count} done", "Mostrar as {count} concluídas"),
  "sessions.done.hide": dict("Hide the done ones", "Ocultar concluídas"),
  "sessions.noTask": dict("no task", "sem tarefa"),
  "sessions.live.running": dict("Running", "Rodando"),
  "sessions.live.stopped": dict("Stopped", "Parada"),
  "sessions.previews": dict("{count} local URL(s)", "{count} URL(s) local(is)"),
  "sessions.row.more": dict("More actions for this session", "Mais ações da sessão"),
  "sessions.row.details": dict("Details", "Detalhes"),
  "sessions.menu.nickname": dict("Edit nickname", "Editar apelido"),
  "sessions.menu.branches": dict("Edit branches", "Editar branches"),
  "sessions.menu.vscode": dict("Open in VS Code", "Abrir no VS Code"),
  "sessions.menu.cursor": dict("Open in Cursor", "Abrir no Cursor"),
  "sessions.menu.pr": dict("Open the PR", "Abrir o PR"),
  "sessions.menu.task": dict("Task and repositories", "Tarefa e repositórios"),
  "sessions.menu.history": dict("Task history", "Histórico da tarefa"),
  "sessions.menu.conversation": dict("Whole conversation", "Conversa inteira"),
  "sessions.menu.removeWorktree": dict("Remove worktree", "Remover worktree"),
  "sessions.menu.delete": dict("Delete session", "Excluir sessão"),
  "sessions.menu.deleteActive": dict(
    "Close the session's terminal before deleting it",
    "Feche o terminal da sessão antes de excluí-la",
  ),
  "sessions.delete.inline": dict("Delete “{title}”?", "Excluir “{title}”?"),
  "sessions.delete.inlineHint": dict(
    "The session's conversation is deleted for good. Esc cancels.",
    "A conversa da sessão é apagada de vez. Esc cancela.",
  ),
  "sessions.taskOnly.title": dict("Tasks with no open session", "Tarefas sem sessão aberta"),
  "sessions.taskOnly.queue": dict("Open the queue", "Abrir a fila"),
  "sessions.taskOnly.board": dict("Open the Board", "Abrir o Board"),
  "sessions.taskOnly.dismiss": dict("Dismiss", "Dispensar"),
  "sessions.taskOnly.dismissHint": dict(
    "Deletes the failure's record; the task leaves this list.",
    "Apaga o registro da falha; a tarefa sai desta lista.",
  ),
  "sessions.empty.title": dict("No sessions yet", "Nenhuma sessão ainda"),
  "sessions.empty.body": dict(
    "Claude CLI sessions show up here as soon as you use claude in any project. Start from a Jira task.",
    "As sessões do Claude CLI aparecem aqui assim que você usa o claude em qualquer projeto. Comece por uma tarefa do Jira.",
  ),
  "sessions.noResults.title": dict(
    "Nothing found with these filters",
    "Nada encontrado com esses filtros",
  ),
  "sessions.noResults.body": dict(
    "The search also looks at every prompt and task key.",
    "A busca também olha todos os prompts e chaves de tarefa.",
  ),
  "sessions.noResults.clear": dict("Clear filters", "Limpar filtros"),
  "sessions.error.title": dict("Couldn't read the sessions", "Não deu para ler as sessões"),
  "sessions.error.hint": dict(
    "The local server (port 58231) starts with the app. If you closed the app's terminal, open the shortcut again.",
    "O servidor local (porta 58231) sobe junto com o app. Se você fechou o terminal do app, abra o atalho de novo.",
  ),
  "sessions.error.copy": dict("Copy error details", "Copiar detalhes do erro"),
  "sessions.error.copied": dict("Copied", "Copiado"),
  "sessions.loading": dict("Reading the sessions…", "Lendo as sessões…"),

  // Detail panel
  "detail.label": dict("Session details", "Detalhes da sessão"),
  "detail.close": dict("Close panel", "Fechar painel"),
  "detail.openInJira": dict("(opens in Jira)", "(abre no Jira)"),
  "detail.linkTask": dict("+ Link a task", "+ Vincular tarefa"),
  "detail.status": dict("Status", "Situação"),
  "detail.status.task": dict(
    "applies to every session of {key}",
    "vale para todas as sessões de {key}",
  ),
  "detail.branches": dict("Branches", "Branches"),
  "detail.edit": dict("Edit", "Editar"),
  "detail.folder": dict("Folder", "Pasta"),
  "detail.worktree": dict("Worktree {name}", "Worktree {name}"),
  "detail.repos": dict("Task repositories", "Repositórios da tarefa"),
  "detail.repos.this": dict("this session", "esta sessão"),
  "detail.repos.sessions": dict("{count} session(s)", "{count} sessão(ões)"),
  "detail.addRepo": dict("+ Add repository", "+ Adicionar repositório"),
  "detail.manageTask": dict("Manage task", "Gerenciar tarefa"),
  "detail.previews": dict("Local previews", "Previews locais"),
  "detail.noPreviews": dict(
    "No local server is serving this folder.",
    "Nenhum servidor local servindo esta pasta.",
  ),
  "detail.firstPrompt": dict("First prompt", "Primeiro prompt"),
  "detail.noPrompt": dict("No prompt recorded.", "Nenhum prompt registrado."),
  "detail.openConversation": dict("Open the whole conversation", "Abrir a conversa inteira"),
  "detail.links": dict("Links", "Links"),
  "detail.filterByTask": dict("Every session of {key}", "Todas as sessões de {key}"),
  "detail.updated": dict("Updated {when}", "Atualizada {when}"),

  // Board page
  "boardPage.subtitle": dict(
    "The eye follows the sprint and acts on PRs and tasks according to each automation's mode.",
    "O olho acompanha a sprint e age nos PRs e tarefas conforme o modo de cada automação.",
  ),
  "boardPage.off.title": dict("The Board is off", "O Board está desligado"),
  "boardPage.off.body": dict(
    "The Board's automations are a beta and are turned off on this machine. Turn them on and a guided setup connects Jira, the board and Bitbucket.",
    "As automações do Board são beta e estão desligadas nesta máquina. Ligue e uma configuração guiada conecta o Jira, o board e o Bitbucket.",
  ),
  "boardPage.off.turnOn": dict("Turn the Board on", "Ligar o Board"),
  "boardPage.intro.title": dict(
    "Let's connect the Board to your sprint",
    "Vamos conectar o Board à sua sprint",
  ),
  "boardPage.intro.body": dict(
    "The Board watches your Jira board and reviews PRs, takes tests and moves tasks for you. It takes a few minutes, one step at a time, and each step is checked before it's saved.",
    "O Board acompanha o seu board do Jira e revisa PRs, assume testes e move tarefas por você. Leva poucos minutos, uma etapa por vez, e cada etapa é conferida antes de salvar.",
  ),
  "boardPage.intro.step.claude": dict(
    "Claude CLI: check that the claude command works here",
    "Claude CLI: confere se o comando claude funciona aqui",
  ),
  "boardPage.intro.step.jira": dict(
    "Jira: your site, e-mail and API token",
    "Jira: o seu site, e-mail e token de API",
  ),
  "boardPage.intro.step.board": dict(
    "Board columns: which column means what",
    "Colunas do board: o que cada coluna significa",
  ),
  "boardPage.intro.step.bitbucket": dict(
    "Bitbucket: access to read and comment on PRs",
    "Bitbucket: acesso para ler e comentar nos PRs",
  ),
  "boardPage.intro.step.extras": dict(
    "Teams and Jenkins (optional)",
    "Teams e Jenkins (opcional)",
  ),
  "boardPage.intro.step.finish": dict(
    "Turn on: pick which automations to use",
    "Ativar: escolha quais automações usar",
  ),
  "boardPage.intro.note": dict(
    "Tokens stay on this machine. Every automation starts off: you turn on only what you want.",
    "Os tokens ficam só nesta máquina. Toda automação começa desligada: você liga só o que quiser.",
  ),
  "boardPage.intro.start": dict("Start the setup", "Começar a configuração"),
  "boardPage.modes": dict("Mode of each automation", "Modo de cada automação"),

  // Queue page
  "queuePage.unsaved": dict(
    "Unsaved changes: the queue only runs what's saved.",
    "Alterações não salvas: a fila só roda o que está salvo.",
  ),
  "queuePage.discard": dict("Discard", "Descartar"),

  // Keyboard
  "shortcuts.newTask": dict("New task (N)", "Nova tarefa (N)"),
};
