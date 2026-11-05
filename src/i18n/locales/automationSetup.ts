import { dict } from "../dict";

/** The board automations setup panel (`AutomationSetupModal`). */
export const automationSetup = {
  "automationSetup.title": dict(
    "Set up the board automations",
    "Configurar as automações do Board",
  ),
  "automationSetup.intro": dict(
    "Each step is checked against the real service before it's saved. Tokens stay on this machine (boardWatcher.secrets.json, ignored by git). Nothing runs for real at the end: it starts in simulation.",
    "Cada etapa é conferida no serviço de verdade antes de salvar. Os tokens ficam só nesta máquina (boardWatcher.secrets.json, ignorado pelo git). No fim nada roda de verdade: começa em simulação.",
  ),
  "automationSetup.progress": dict(
    "{done} of {total} steps done",
    "{done} de {total} etapas concluídas",
  ),
  "automationSetup.loading": dict(
    "Checking what's configured…",
    "Conferindo o que já está configurado…",
  ),
  "automationSetup.loadError": dict("Couldn't read the setup.", "Não deu pra ler a configuração."),
  "automationSetup.saveError": dict("Couldn't save this step.", "Não deu pra salvar essa etapa."),
  "automationSetup.optional": dict("Optional", "Opcional"),
  "automationSetup.back": dict("Back", "Voltar"),
  "automationSetup.next": dict("Next", "Próxima"),
  "automationSetup.skip": dict("Skip", "Pular"),
  "automationSetup.saveAndContinue": dict("Check and continue", "Conferir e continuar"),
  "automationSetup.close": dict("Close", "Fechar"),
  "automationSetup.secret.saved": dict(
    "Saved. Leave empty to keep it.",
    "Já salvo. Deixe vazio pra manter.",
  ),
  "automationSetup.secret.environment": dict(
    "Comes from an environment variable on this machine, which wins over what's typed here.",
    "Vem de uma variável de ambiente desta máquina, que vale mais do que o que for digitado aqui.",
  ),
  "automationSetup.howTo": dict("How to get it", "Como conseguir"),

  "automationSetup.step.claude": dict("Claude CLI", "Claude CLI"),
  "automationSetup.step.jira": dict("Jira", "Jira"),
  "automationSetup.step.board": dict("Board columns", "Colunas do board"),
  "automationSetup.step.bitbucket": dict("Bitbucket", "Bitbucket"),
  "automationSetup.step.repos": dict("Repositories", "Repositórios"),
  "automationSetup.step.extras": dict("Teams and Jenkins", "Teams e Jenkins"),
  "automationSetup.step.finish": dict("Turn on", "Ativar"),

  "automationSetup.claude.description": dict(
    "Reviews (and tests) are Claude sessions run by the app, so the claude command must work on this machine, logged in.",
    "Os reviews (e testes) são sessões do Claude rodadas pelo app, então o comando claude precisa funcionar nesta máquina, com login feito.",
  ),
  "automationSetup.claude.ok": dict("Installed: {version}", "Instalado: {version}"),
  "automationSetup.claude.missing": dict(
    "The claude command wasn't found. Install Claude Code, log in (claude in a terminal) and check again.",
    "O comando claude não foi encontrado. Instale o Claude Code, faça login (claude num terminal) e confira de novo.",
  ),
  "automationSetup.claude.recheck": dict("Check again", "Conferir de novo"),

  "automationSetup.jira.description": dict(
    "Used to read the board and the tickets, and to find your account (whose PRs are yours).",
    "Usado pra ler o board e as tarefas, e pra descobrir a sua conta (quais PRs são seus).",
  ),
  "automationSetup.jira.site": dict("Jira site", "Site do Jira"),
  "automationSetup.jira.email": dict("Your Atlassian e-mail", "Seu e-mail da Atlassian"),
  "automationSetup.jira.token": dict("Jira API token", "API token do Jira"),
  "automationSetup.jira.tokenHelp": dict(
    "id.atlassian.com → Security → API tokens → Create API token. Copy it right away: it's shown only once.",
    "id.atlassian.com → Segurança → API tokens → Criar API token. Copie na hora: ele só aparece uma vez.",
  ),
  "automationSetup.jira.ok": dict("Connected as {name}.", "Conectado como {name}."),

  "automationSetup.board.description": dict(
    "Paste the team board's link and say which column is which. Only Code Review is required; the others are for the To Do and test automations.",
    "Cole o link do board do time e diga qual coluna é qual. Só a de Code Review é obrigatória; as outras são das automações de To Do e de testes.",
  ),
  "automationSetup.board.link": dict("Board link", "Link do board"),
  "automationSetup.board.read": dict("Read columns", "Ler colunas"),
  "automationSetup.board.found": dict(
    "{name}: {count} columns. Click a column to add it to or remove it from a role. The first guess came from the names.",
    "{name}: {count} colunas. Clique numa coluna pra pôr ou tirar de um papel. O primeiro palpite veio dos nomes.",
  ),
  "automationSetup.role.todo": dict("To Do", "To Do"),
  "automationSetup.role.inProgress": dict("In Progress", "In Progress"),
  "automationSetup.role.codeReview": dict("Code Review (required)", "Code Review (obrigatória)"),
  "automationSetup.role.waitTest": dict("Waiting for test", "Aguardando teste"),
  "automationSetup.role.testing": dict("Testing", "Em teste"),
  "automationSetup.role.deploying": dict(
    "After the test (validation, deploy)",
    "Depois do teste (validação, deploy)",
  ),

  "automationSetup.bitbucket.description": dict(
    "Used to read the open PRs and, once you turn it on, to comment on and approve them in your name.",
    "Usado pra ler os PRs abertos e, quando você ligar, comentar e aprovar no seu nome.",
  ),
  "automationSetup.bitbucket.workspace": dict("Workspace", "Workspace"),
  "automationSetup.bitbucket.email": dict("Your Atlassian e-mail", "Seu e-mail da Atlassian"),
  "automationSetup.bitbucket.token": dict("Bitbucket API token", "API token do Bitbucket"),
  "automationSetup.bitbucket.tokenHelp": dict(
    "id.atlassian.com → Security → API tokens → Create API token with scopes → Bitbucket. Give it read on repositories and pull requests, and write on pull requests (to comment and approve).",
    "id.atlassian.com → Segurança → API tokens → Criar API token com escopos → Bitbucket. Dê leitura de repositórios e pull requests, e escrita de pull requests (pra comentar e aprovar).",
  ),
  "automationSetup.bitbucket.ok": dict("Connected as {name}.", "Conectado como {name}."),

  "automationSetup.repos.description": dict(
    "The repos whose PRs it reviews. Each needs a local clone: the review runs in a temporary worktree of it. Clones in your workspace folders are found on their own.",
    "Os repositórios cujos PRs ele revisa. Cada um precisa de um clone local: o review roda numa worktree temporária dele. Os clones nas suas pastas de trabalho são achados sozinhos.",
  ),
  "automationSetup.repos.filter": dict("Filter repos…", "Filtrar repositórios…"),
  "automationSetup.repos.loading": dict(
    "Listing the workspace's repos…",
    "Listando os repositórios do workspace…",
  ),
  "automationSetup.repos.selected": dict("{count} selected", "{count} selecionado(s)"),
  "automationSetup.repos.localPath": dict("Local clone folder", "Pasta do clone local"),
  "automationSetup.repos.notFound": dict(
    "No clone found: type the folder.",
    "Nenhum clone achado: digite a pasta.",
  ),

  "automationSetup.extras.description": dict(
    "Optional. Without them it works the same, only the notices stay in the app and failed builds aren't diagnosed.",
    "Opcional. Sem eles funciona igual, só que os avisos ficam no app e os builds que falham não são diagnosticados.",
  ),
  "automationSetup.extras.teams": dict("Teams workflow URL", "URL do workflow do Teams"),
  "automationSetup.extras.teamsHelp": dict(
    'In the Teams channel (or chat) for the notices: ⋯ → Workflows → "Post to a channel when a webhook request is received" → finish and copy the URL it shows.',
    'No canal (ou chat) do Teams dos avisos: ⋯ → Workflows → "Post to a channel when a webhook request is received" → conclua e copie a URL que ele mostra.',
  ),
  "automationSetup.extras.jenkinsUser": dict("Jenkins user", "Usuário do Jenkins"),
  "automationSetup.extras.jenkinsToken": dict("Jenkins API token", "API token do Jenkins"),
  "automationSetup.extras.jenkinsHelp": dict(
    "In Jenkins: your name (top right) → Security (or Configure) → API Token → Add new token. Used to read why a build failed.",
    "No Jenkins: seu nome (canto superior direito) → Security (ou Configure) → API Token → Add new token. Usado pra ler por que um build falhou.",
  ),

  "automationSetup.finish.description": dict(
    "Pick what to turn on. It starts in simulation: it only shows in the Board what it would do. Commenting, approving and every other real action are turned on one by one later, in the Board's Automation settings.",
    "Escolha o que ligar. Começa em simulação: só mostra no Board o que faria. Comentar, aprovar e as outras ações de verdade são ligadas uma a uma depois, nas configurações de Automação do Board.",
  ),
  "automationSetup.feature.codeReview": dict(
    "Code review of the team's PRs",
    "Code review dos PRs do time",
  ),
  "automationSetup.feature.codeReview.help": dict(
    "Lists the PRs due for your review and, in simulation, what it would comment and approve.",
    "Lista os PRs que estão na sua vez de revisar e, em simulação, o que comentaria e aprovaria.",
  ),
  "automationSetup.feature.reviewSessions": dict("Review with Claude", "Review com o Claude"),
  "automationSetup.feature.reviewSessions.help": dict(
    "Each due PR gets a real Claude review (uses your plan). Off, PRs are only listed.",
    "Cada PR na sua vez ganha um review de verdade do Claude (usa o seu plano). Desligado, os PRs só são listados.",
  ),
  "automationSetup.feature.devQueue": dict(
    "Queue my To Do tasks",
    "Colocar minhas tarefas de To Do na fila",
  ),
  "automationSetup.feature.devQueue.help": dict(
    "Needs the To Do column. Puts your tasks in the app's queue, one at a time.",
    "Precisa da coluna To Do. Coloca as suas tarefas na fila do app, uma de cada vez.",
  ),
  "automationSetup.feature.testQueue": dict(
    "Pick up tests from Wait Test",
    "Pegar testes em Wait Test",
  ),
  "automationSetup.feature.testQueue.help": dict(
    "Needs the Waiting for test and Testing columns. Advanced: also see boardWatcher.json (test skill, network).",
    "Precisa das colunas Aguardando teste e Em teste. Avançado: veja também o boardWatcher.json (skill de teste, rede).",
  ),
  "automationSetup.feature.notices": dict("Notices on Teams", "Avisos no Teams"),
  "automationSetup.feature.notices.help": dict(
    "Needs the Teams workflow URL. Build failures, news on your PRs and a digest.",
    "Precisa da URL do workflow do Teams. Builds que falharam, novidades nos seus PRs e um resumo.",
  ),
  "automationSetup.finish.turnOn": dict("Turn on in simulation", "Ligar em simulação"),
  "automationSetup.finish.save": dict("Save", "Salvar"),
  "automationSetup.finish.done": dict(
    "On, in simulation. Open the Board in the header to see what it would do.",
    "Ligado, em simulação. Abra o Board no header pra ver o que ele faria.",
  ),
  "automationSetup.finish.betaOff": dict(
    "The board automations beta is off in Settings: turn it on there to run.",
    "O beta das automações do Board está desligado nas Settings: ligue lá pra rodar.",
  ),

  "settings.boardAutomations.setup": dict("Set up the automations", "Configurar as automações"),
};
