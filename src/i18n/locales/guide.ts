import { dict } from "../dict";

/** The Guide page (every feature and how to reach it) and the welcome tour. */
export const guide = {
  "guide.title": dict("Guide", "Guia"),
  "guide.subtitle": dict(
    "Everything the app does and how to get there. “Open” takes you straight to it.",
    "Tudo o que o app faz e como chegar lá. “Abrir” leva direto ao lugar.",
  ),
  "guide.search": dict("Search the guide", "Buscar no guia"),
  "guide.search.placeholder": dict(
    "e.g. worktree, PR, queue, branch",
    "ex.: worktree, PR, fila, branch",
  ),
  "guide.search.none": dict(
    "Nothing in the guide matches “{query}”.",
    "Nada no guia com “{query}”.",
  ),
  "guide.where": dict("Where", "Onde"),
  "guide.open": dict("Open", "Abrir"),
  "guide.tour": dict("Take the tour again", "Fazer o tour de novo"),
  "guide.beta": dict("needs the Board turned on", "precisa do Board ligado"),
  "guide.contents": dict("Sections", "Seções"),

  "guide.section.sessions": dict("Sessions", "Sessões"),
  "guide.section.start": dict("Starting work", "Começar trabalho"),
  "guide.section.queue": dict("Task queue", "Fila de tarefas"),
  "guide.section.board": dict("Board and automations", "Board e automações"),
  "guide.section.tools": dict("Maintenance, team and app", "Manutenção, time e app"),

  // Sessions
  "guide.sessions.list.title": dict("Grouped list", "Lista agrupada"),
  "guide.sessions.list.what": dict(
    "Every Claude CLI session on this machine, what's running first. Then what needs you: a failed launch, test or review, and sessions waiting for your answer. Then what's stopped, and the done ones (and those whose folder is gone) folded at the end.",
    "Todas as sessões do Claude CLI desta máquina, com o que está rodando primeiro. Depois o que precisa de você: falha ao abrir pela fila, teste ou review que falhou e sessões esperando sua resposta. Depois o que está parado e as concluídas (e as de pasta apagada) recolhidas no fim.",
  ),
  "guide.sessions.list.where": dict("Navigation › Sessions", "Navegação › Sessões"),
  "guide.sessions.search.title": dict("Search and filters", "Busca e filtros"),
  "guide.sessions.search.what": dict(
    "Search by title, nickname, branch, task key and every prompt. Narrow to “Needs you” or “Running”, to one project or one status. Filters stay in the address, so a reload keeps them.",
    "Busque por título, apelido, branch, chave da tarefa e todos os prompts. Filtre por “Precisa de você” ou “Rodando”, por projeto ou por situação. Os filtros ficam no endereço, então recarregar mantém.",
  ),
  "guide.sessions.search.where": dict(
    "Sessions › filter bar (press / to jump to the search)",
    "Sessões › barra de filtros (aperte / para ir à busca)",
  ),
  "guide.sessions.views.title": dict(
    "List or cards, by group or by date",
    "Lista ou cards, por grupo ou por data",
  ),
  "guide.sessions.views.what": dict(
    "The list is the default; the cards show the same actions in a grid. The order is by group by default, or by date (newest first, nothing folded).",
    "A lista é o padrão; os cards mostram as mesmas ações em grade. A ordem é por grupo por padrão, ou por data (mais recentes primeiro, nada recolhido).",
  ),
  "guide.sessions.views.where": dict(
    "Sessions › Group / Date and List / Cards buttons, right of the filters",
    "Sessões › botões Grupo / Data e Lista / Cards, à direita dos filtros",
  ),
  "guide.sessions.detail.title": dict("Session panel", "Painel da sessão"),
  "guide.sessions.detail.what": dict(
    "Everything about one session without leaving the list: task, status, resume, editor, PR, branches, repositories, previews, prompts, conversation, history and delete.",
    "Tudo sobre uma sessão sem sair da lista: tarefa, situação, retomar, editor, PR, branches, repositórios, previews, prompts, conversa, histórico e excluir.",
  ),
  "guide.sessions.detail.where": dict(
    "Click a session's title (or “Details” in its menu)",
    "Clique no título de uma sessão (ou em “Detalhes” no menu dela)",
  ),
  "guide.sessions.resume.title": dict("Resume a session", "Retomar uma sessão"),
  "guide.sessions.resume.what": dict(
    "Reopens it in a terminal, or in the Limux grid when that's your layout. If another session is open in the same folder, it offers a worktree or stopping the other one.",
    "Reabre num terminal, ou na grade do Limux quando esse é o seu layout. Se outra sessão estiver aberta na mesma pasta, oferece um worktree ou parar a outra.",
  ),
  "guide.sessions.resume.where": dict(
    "“Resume” on the session's row or in its panel",
    "“Retomar” na linha da sessão ou no painel",
  ),
  "guide.sessions.resumeOpen.title": dict(
    "Resume open tasks / Open grid",
    "Retomar abertas / Abrir grade",
  ),
  "guide.sessions.resumeOpen.what": dict(
    "Brings back the latest session of every task in progress or waiting for you that has nothing running, up to the session limit. With the Limux layout it opens the grid.",
    "Traz de volta a última sessão de cada tarefa em andamento ou esperando você que não tem nada rodando, até o limite de sessões. Com o layout do Limux, abre a grade.",
  ),
  "guide.sessions.resumeOpen.where": dict(
    "Sessions › top, next to New task",
    "Sessões › topo, ao lado de Nova tarefa",
  ),
  "guide.sessions.status.title": dict("Task status", "Situação da tarefa"),
  "guide.sessions.status.what": dict(
    "To do, in progress, waiting for you or done, shared by every session of the task. Marking a worktree task done offers to remove the worktree when that's safe.",
    "A fazer, em andamento, esperando você ou concluída, compartilhada por todas as sessões da tarefa. Marcar como concluída uma tarefa em worktree oferece remover o worktree quando é seguro.",
  ),
  "guide.sessions.status.where": dict(
    "The status pill on the row, or “Status” in the panel",
    "A pílula de situação na linha, ou “Situação” no painel",
  ),
  "guide.sessions.nickname.title": dict("Nickname and branches", "Apelido e branches"),
  "guide.sessions.nickname.what": dict(
    "A local nickname to tell sessions apart, and the base and task branches used for the PR link.",
    "Um apelido local para diferenciar as sessões, e as branches base e da tarefa usadas no link do PR.",
  ),
  "guide.sessions.nickname.where": dict(
    "Row menu ⋯ › Edit nickname / Edit branches, or the pencils in the panel",
    "Menu ⋯ da linha › Editar apelido / Editar branches, ou os lápis no painel",
  ),
  "guide.sessions.task.title": dict("Task and repositories", "Tarefa e repositórios"),
  "guide.sessions.task.what": dict(
    "Link the session to a Jira key, add another repository to the task (same branch, optional worktree, /add-dir ready to copy) or unlink one.",
    "Vincule a sessão a uma chave do Jira, adicione outro repositório à tarefa (mesma branch, worktree opcional, /add-dir pronto para copiar) ou desvincule um.",
  ),
  "guide.sessions.task.where": dict(
    "Panel › Manage task / + Add repository; row menu ⋯ › Task and repositories",
    "Painel › Gerenciar tarefa / + Adicionar repositório; menu ⋯ › Tarefa e repositórios",
  ),
  "guide.sessions.previews.title": dict("Local previews", "Previews locais"),
  "guide.sessions.previews.what": dict(
    "The local URLs (Docker containers or processes) serving the session's folder or its task's worktrees. Start, stop or remove a worktree's preview.",
    "As URLs locais (containers Docker ou processos) servindo a pasta da sessão ou os worktrees da tarefa. Inicie, pare ou remova o preview de um worktree.",
  ),
  "guide.sessions.previews.where": dict(
    "Panel › Local previews (the globe on the row shows how many)",
    "Painel › Previews locais (o globo na linha mostra quantos)",
  ),
  "guide.sessions.conversation.title": dict("Whole conversation", "Conversa inteira"),
  "guide.sessions.conversation.what": dict(
    "Every prompt of the session with Claude's replies and the tools it used.",
    "Todos os prompts da sessão com as respostas do Claude e as ferramentas que ele usou.",
  ),
  "guide.sessions.conversation.where": dict(
    "Panel › first prompt › Open the whole conversation, or menu ⋯ › Whole conversation",
    "Painel › primeiro prompt › Abrir a conversa inteira, ou menu ⋯ › Conversa inteira",
  ),
  "guide.sessions.history.title": dict("Task history", "Histórico da tarefa"),
  "guide.sessions.history.what": dict(
    "Where the task's time went: in the queue, in each status, heavy runs and their waits, errors and the full timeline.",
    "Para onde foi o tempo da tarefa: na fila, em cada situação, comandos pesados e suas esperas, erros e a linha do tempo completa.",
  ),
  "guide.sessions.history.where": dict("Menu ⋯ › History", "Menu ⋯ › Histórico"),
  "guide.sessions.links.title": dict("Open the PR", "Abrir o PR"),
  "guide.sessions.links.what": dict(
    "Opens the PR (asking which base to compare when it isn't the default).",
    "Abre o PR (perguntando a base de comparação quando não é a padrão).",
  ),
  "guide.sessions.links.where": dict(
    "Panel › Open PR and Links; row menu ⋯",
    "Painel › Abrir PR e Links; menu ⋯ da linha",
  ),
  "guide.sessions.editor.title": dict("Open in the editor", "Abrir no editor"),
  "guide.sessions.editor.what": dict(
    "Opens the session's folder in VS Code or Cursor.",
    "Abre a pasta da sessão no VS Code ou no Cursor.",
  ),
  "guide.sessions.editor.where": dict(
    "Panel › Editor; row menu ⋯ › Open in VS Code / Cursor",
    "Painel › Editor; menu ⋯ › Abrir no VS Code / Cursor",
  ),
  "guide.sessions.missing.title": dict("Missing folder", "Pasta que sumiu"),
  "guide.sessions.missing.what": dict(
    "When a session's folder is gone (a removed worktree), it goes to “Done” with a way to open the repo root in VS Code or start a new session there.",
    "Quando a pasta de uma sessão some (um worktree removido), ela vai para “Concluídas” com a opção de abrir a raiz do repositório no VS Code ou começar uma sessão nova lá.",
  ),
  "guide.sessions.missing.where": dict(
    "Sessions › Done › the session's panel",
    "Sessões › Concluídas › painel da sessão",
  ),
  "guide.sessions.delete.title": dict("Delete and remove worktrees", "Excluir e remover worktrees"),
  "guide.sessions.delete.what": dict(
    "Deletes the session's conversation for good, optionally removing its worktree or its local branch. Select several with the checkboxes to delete them together.",
    "Apaga de vez a conversa da sessão, removendo opcionalmente o worktree ou a branch local. Marque várias nas caixas de seleção para excluir juntas.",
  ),
  "guide.sessions.delete.where": dict(
    "Row menu ⋯ › Delete session (confirmed on the row); panel footer; checkboxes › Delete selected",
    "Menu ⋯ › Excluir sessão (confirmação na própria linha); rodapé do painel; caixas de seleção › Excluir selecionadas",
  ),

  // Starting work
  "guide.start.newTask.title": dict("New task", "Nova tarefa"),
  "guide.start.newTask.what": dict(
    "From a Jira link: project, other repositories, branch (with a preview of its name), worktree, prompt and team skills. Shows each step live while it creates and opens the terminal.",
    "A partir de um link do Jira: projeto, outros repositórios, branch (com prévia do nome), worktree, prompt e skills do time. Mostra cada passo ao vivo enquanto cria e abre o terminal.",
  ),
  "guide.start.newTask.where": dict(
    "“New task” at the top of Sessions, or the N key anywhere",
    "“Nova tarefa” no topo de Sessões, ou a tecla N em qualquer tela",
  ),
  "guide.start.newSession.title": dict("New session", "Nova sessão"),
  "guide.start.newSession.what": dict(
    "Claude in any folder with your default session prompt, no task attached.",
    "O Claude em qualquer pasta com o seu prompt padrão de sessão, sem tarefa.",
  ),
  "guide.start.newSession.where": dict(
    "Arrow next to New task › New session",
    "Seta ao lado de Nova tarefa › Nova sessão",
  ),
  "guide.start.refine.title": dict("Refine tasks", "Refinar tarefas"),
  "guide.start.refine.what": dict(
    "Runs the team's refinement skill on a sprint or on tickets you paste, optionally sending the result to the PO.",
    "Roda a skill de refinamento do time numa sprint ou nos tickets que você colar, com opção de mandar o resultado direto ao PO.",
  ),
  "guide.start.refine.where": dict(
    "Navigation › Refine tasks (also in the arrow next to New task)",
    "Navegação › Refinar tarefas (também na seta ao lado de Nova tarefa)",
  ),

  // Queue
  "guide.queue.add.title": dict("Queue tasks", "Enfileirar tarefas"),
  "guide.queue.add.what": dict(
    "Paste links or keys (development, test or code review), pick the repository and branch, and the scheduler opens them one at a time, each in its own worktree, while there's room.",
    "Cole links ou chaves (desenvolvimento, teste ou code review), escolha repositório e branch, e o agendador abre uma de cada vez, cada uma no seu worktree, enquanto houver vaga.",
  ),
  "guide.queue.add.where": dict("Navigation › Task queue", "Navegação › Fila"),
  "guide.queue.review.title": dict("Code review in the queue", "Code review na fila"),
  "guide.queue.review.what": dict(
    "Paste pull request links as Code review: each one opens a terminal with the code review skill (chosen in Skills) on the PR's commit, and the app posts the comments and the approval within the Board's limits. The Board automations queue colleagues' PRs here too. A review is only in progress or done.",
    "Cole links de pull request como Code review: cada um abre um terminal com a skill de code review (escolhida em Skills) no commit do PR, e o app publica os comentários e a aprovação dentro dos limites do Board. As automações do Board também colocam os PRs dos colegas aqui. Um review só fica em andamento ou concluído.",
  ),
  "guide.queue.review.where": dict(
    "Task queue › Code review kind; skill in Skills › Code review skill",
    "Fila › tipo Code review; skill em Skills › Skill de code review",
  ),
  "guide.queue.scheduler.title": dict("Scheduler and limits", "Agendador e limites"),
  "guide.queue.scheduler.what": dict(
    "Why it's waiting (sessions, memory, plan usage, interval), Check now and Pause. Its settings: sessions at once, free RAM, plan usage, minutes between launches, and the heavy-command hook that keeps tests and builds from freezing the machine.",
    "Por que está esperando (sessões, memória, uso do plano, intervalo), Checar agora e Pausar. As configurações: sessões ao mesmo tempo, RAM livre, uso do plano, minutos entre lançamentos e o hook de comandos pesados que impede testes e builds de travar a máquina.",
  ),
  "guide.queue.scheduler.where": dict(
    "Task queue › scheduler panel › Queue settings",
    "Fila › painel do agendador › Configurações da fila",
  ),
  "guide.queue.edit.title": dict("Order, groups and start now", "Ordem, grupos e início imediato"),
  "guide.queue.edit.what": dict(
    "Drag to reorder, do several tasks together in one branch, change repositories or kind, start one now or retry after an error. The scheduler only sees what's saved.",
    "Arraste para reordenar, faça várias tarefas juntas numa branch, mude repositórios ou tipo, comece uma agora ou tente de novo depois de um erro. O agendador só enxerga o que foi salvo.",
  ),
  "guide.queue.edit.where": dict("Task queue › list › Save queue", "Fila › lista › Salvar fila"),

  // Board
  "guide.board.eye.title": dict("The Board's eye", "O olho do Board"),
  "guide.board.eye.what": dict(
    "Watches the sprint during business hours: its state, the next look, Look now and Pause, and today's approvals, tests, sessions and accuracy.",
    "Acompanha a sprint no horário comercial: o estado, a próxima olhada, Olhar agora e Pausar, e as aprovações, testes, sessões e acerto do dia.",
  ),
  "guide.board.eye.where": dict("Navigation › Board", "Navegação › Board"),
  "guide.board.modes.title": dict("Automation modes", "Modos das automações"),
  "guide.board.modes.what": dict(
    "Code review (one AI review per colleague's PR, with the code review skill chosen right in its card), To Do, Tests, Rebuild and Teams notices, each on or off, plus business hours and limits.",
    "Code review (uma review por IA por PR de colega, com a skill de code review escolhida no próprio card), A fazer, Testes, Rebuild e avisos no Teams, cada um ligado ou desligado, além do horário e dos limites.",
  ),
  "guide.board.modes.where": dict(
    "Board › a mode chip (opens that automation highlighted)",
    "Board › um chip de modo (abre aquela automação destacada)",
  ),
  "guide.board.setup.title": dict("Guided setup", "Configuração guiada"),
  "guide.board.setup.what": dict(
    "Claude CLI, Jira, the board's columns, Bitbucket and extras (Teams, Jenkins). Tokens already in your shell are detected, and each step keeps what you typed.",
    "Claude CLI, Jira, colunas do board, Bitbucket e extras (Teams, Jenkins). Tokens que já estão no seu shell são detectados, e cada passo guarda o que você digitou.",
  ),
  "guide.board.setup.where": dict(
    "Board › violet gear; or Settings › Board automations › gear",
    "Board › engrenagem violeta; ou Configurações › Automações do Board › engrenagem",
  ),
  "guide.board.attention.title": dict(
    "What needs you on the Board",
    "O que precisa de você no Board",
  ),
  "guide.board.attention.what": dict(
    "Failed builds, reviews and tests, holds and weak task descriptions, with buttons to open the PR or the ticket.",
    "Builds, reviews e testes que falharam, pausas e descrições fracas, com botões para abrir o PR ou o ticket.",
  ),
  "guide.board.attention.where": dict("Board › Needs you", "Board › Precisa de você"),
  "guide.board.live.title": dict("Eye's queue and live feed", "Fila do olho e ao vivo"),
  "guide.board.live.what": dict(
    "What it will look at next, tagged by kind of work: drag (or use the arrow keys) to set the priority, or “Start now” to skip what an item waits for. And what it's doing right now, with a timer.",
    "O que ele vai olhar a seguir, marcado pelo tipo de trabalho: arraste (ou use as setas) para definir a prioridade, ou “Começar agora” para pular o que um item espera. E o que está fazendo agora, com cronômetro.",
  ),
  "guide.board.live.where": dict("Board › Queue and Live", "Board › Na fila e Ao vivo"),
  "guide.board.history.title": dict("History and feedback", "Histórico e feedback"),
  "guide.board.history.what": dict(
    "Every decision by ticket or PR, with links. 👍/👎 and a note: a 👎 note becomes a lesson for the next sessions.",
    "Cada decisão por ticket ou PR, com links. 👍/👎 e uma nota: a nota de um 👎 vira lição para as próximas sessões.",
  ),
  "guide.board.history.where": dict("Board › History", "Board › Histórico"),
  "guide.board.tools.title": dict("Board tools", "Ferramentas do Board"),
  "guide.board.tools.what": dict(
    "Daily summary to copy, point a ticket's branch to homolog (Jenkins replay) and send the digest now.",
    "Resumo da daily para copiar, apontar a branch de um ticket para homolog (replay no Jenkins) e mandar o resumo agora.",
  ),
  "guide.board.tools.where": dict("Board › Tools", "Board › Ferramentas"),

  // Maintenance, team and app
  "guide.tools.cleanup.title": dict("Cleanup", "Limpeza"),
  "guide.tools.cleanup.what": dict(
    "Finds stale, merged and abandoned worktrees, done tasks' worktrees and old sessions; you run each fix on its own.",
    "Encontra worktrees órfãos, mesclados e abandonados, worktrees de tarefas concluídas e sessões antigas; você roda cada correção separadamente.",
  ),
  "guide.tools.cleanup.where": dict("Navigation › Cleanup", "Navegação › Limpeza"),
  "guide.tools.skills.title": dict("Team skills", "Skills do time"),
  "guide.tools.skills.what": dict(
    "Set up and clone the team's skills repository, pick catalogs or single skills (with a preview of each), update, and choose the test and refinement skills.",
    "Configure e clone o repositório de skills do time, escolha catálogos ou skills (com prévia de cada uma), atualize e defina as skills de teste e de refinamento.",
  ),
  "guide.tools.skills.where": dict(
    "Navigation › Team skills (amber while not set up)",
    "Navegação › Skills do time (âmbar enquanto não configurado)",
  ),
  "guide.tools.settings.title": dict("Settings", "Configurações"),
  "guide.tools.settings.what": dict(
    "Repository folders, skills, remote control, Board automations, terminal or Limux grid, worktree setup, prompts, branch types, worktree and auto mode defaults, Cleanup and theme. Export, import or open the file.",
    "Pastas de repositórios, skills, controle remoto, automações do Board, terminal ou grade do Limux, preparo do worktree, prompts, tipos de branch, padrões de worktree e modo auto, Limpeza e tema. Exporte, importe ou abra o arquivo.",
  ),
  "guide.tools.settings.where": dict(
    "Navigation › Settings (on the phone, More › Settings)",
    "Navegação › Configurações (no celular, Mais › Configurações)",
  ),
  "guide.tools.usage.title": dict("Plan usage", "Uso do plano"),
  "guide.tools.usage.what": dict(
    "The Claude plan's 5-hour and weekly use, with when each resets. Click to read it again.",
    "O uso do plano Claude na janela de 5 horas e na semana, com quando cada um zera. Clique para ler de novo.",
  ),
  "guide.tools.usage.where": dict("Bottom of the navigation", "Rodapé da navegação"),
  "guide.tools.update.title": dict("Update the app", "Atualizar o app"),
  "guide.tools.update.what": dict(
    "Shows when there's a new version. It also updates by itself on start, never over your local changes; with changes, it asks before discarding them.",
    "Aparece quando há versão nova. Ele também se atualiza sozinho ao abrir, nunca por cima de alterações locais; com alterações, pergunta antes de descartar.",
  ),
  "guide.tools.update.where": dict("Bottom of the navigation", "Rodapé da navegação"),
  "guide.tools.language.title": dict("Language and theme", "Idioma e tema"),
  "guide.tools.language.what": dict(
    "English or Portuguese, dark or light theme.",
    "Inglês ou português, tema escuro ou claro.",
  ),
  "guide.tools.language.where": dict(
    "Bottom of the navigation (on the phone, More)",
    "Rodapé da navegação (no celular, Mais)",
  ),
  "guide.tools.shortcuts.title": dict("Shortcuts", "Atalhos"),
  "guide.tools.shortcuts.what": dict(
    "N opens New task, / jumps to the search, Esc closes panels and menus.",
    "N abre Nova tarefa, / vai para a busca, Esc fecha painéis e menus.",
  ),
  "guide.tools.shortcuts.where": dict(
    "Anywhere outside a text field",
    "Em qualquer lugar fora de um campo de texto",
  ),

  // Welcome tour
  "tour.label": dict("Welcome tour", "Tour de boas-vindas"),
  "tour.step": dict("{current} of {total}", "{current} de {total}"),
  "tour.next": dict("Next", "Próximo"),
  "tour.back": dict("Back", "Voltar"),
  "tour.skip": dict("Skip tour", "Pular o tour"),
  "tour.done": dict("Done", "Concluir"),
  "tour.show": dict("Show me", "Mostrar"),
  "tour.welcome.title": dict("Welcome to the Session Manager", "Boas-vindas ao Session Manager"),
  "tour.welcome.body": dict(
    "Your Claude CLI sessions, tasks and automations in one place, with navigation on the left. This one-minute tour shows where everything is.",
    "Suas sessões do Claude CLI, tarefas e automações num lugar só, com a navegação à esquerda. Este tour de um minuto mostra onde fica cada coisa.",
  ),
  "tour.sessions.title": dict("What needs you comes first", "O que precisa de você vem primeiro"),
  "tour.sessions.body": dict(
    "Sessions are grouped: needs you, running, stopped; the done ones fold at the end. Click a title to open its panel with every action, without leaving the list.",
    "As sessões vêm agrupadas: precisa de você, rodando, paradas; as concluídas ficam recolhidas no fim. Clique num título para abrir o painel com todas as ações, sem sair da lista.",
  ),
  "tour.newTask.title": dict("Start from a Jira link", "Comece por um link do Jira"),
  "tour.newTask.body": dict(
    "“New task” (or N) creates the branch, the worktree and opens Claude with the team's prompt. Its arrow has New session and Refine tasks.",
    "“Nova tarefa” (ou N) cria a branch, o worktree e abre o Claude com o prompt do time. A seta ao lado tem Nova sessão e Refinar tarefas.",
  ),
  "tour.queue.title": dict("Queue the ready tasks", "Enfileire as tarefas prontas"),
  "tour.queue.body": dict(
    "Paste several tasks and the scheduler opens one at a time when there's room: sessions, memory and plan usage.",
    "Cole várias tarefas e o agendador abre uma de cada vez quando houver vaga: sessões, memória e uso do plano.",
  ),
  "tour.board.title": dict("The Board watches the sprint", "O Board acompanha a sprint"),
  "tour.board.body": dict(
    "A beta: reviews PRs, takes tests and moves tasks, each automation on or off. Turn it on in Settings and follow the guided setup.",
    "Beta: revisa PRs, assume testes e move tarefas, com cada automação ligada ou desligada. Ligue nas Configurações e siga a configuração guiada.",
  ),
  "tour.tools.title": dict("Cleanup, skills and settings", "Limpeza, skills e configurações"),
  "tour.tools.body": dict(
    "Below the pages: Cleanup for old worktrees and sessions, the team's skills, and at the bottom plan usage, updates and Settings.",
    "Abaixo das páginas: Limpeza para worktrees e sessões antigas, as skills do time e, no rodapé, uso do plano, atualizações e Configurações.",
  ),
  "tour.guide.title": dict("Everything else is in the Guide", "Todo o resto está no Guia"),
  "tour.guide.body": dict(
    "The Guide lists every feature and how to reach it, with a button that takes you there.",
    "O Guia lista cada funcionalidade e como chegar nela, com um botão que leva até lá.",
  ),
};
