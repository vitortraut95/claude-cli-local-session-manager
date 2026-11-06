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
  "automationSetup.extras.teamsHelp.title": dict(
    "How to create the Teams workflow",
    "Como criar o workflow do Teams",
  ),
  "automationSetup.extras.teamsHelp.intro": dict(
    "The notices are personal (your PRs, your tests): a channel only you use, or a chat with yourself, works best.",
    "Os avisos são pessoais (seus PRs, seus testes): o melhor é um canal só seu ou um chat com você mesmo.",
  ),
  "automationSetup.extras.teamsHelp.step1": dict(
    "In Teams, open the channel where the notices should arrive.",
    "No Teams, abra o canal onde os avisos devem chegar.",
  ),
  "automationSetup.extras.teamsHelp.step2": dict(
    "Click ⋯ (More options) next to the channel's name and pick Workflows. In a chat, the ⋯ is at the top of the chat.",
    "Clique em ⋯ (Mais opções) ao lado do nome do canal e escolha Workflows. Num chat, o ⋯ fica no topo da conversa.",
  ),
  "automationSetup.extras.teamsHelp.step3": dict(
    'Pick the template "Post to a channel when a webhook request is received" (in a chat: "Post to a chat when a webhook request is received"). Search for "webhook" if it\'s not on the list.',
    'Escolha o modelo "Post to a channel when a webhook request is received" (num chat: "Post to a chat when a webhook request is received"). Busque por "webhook" se ele não estiver na lista.',
  ),
  "automationSetup.extras.teamsHelp.step4": dict(
    "Give it a name (e.g. Board automations), check the team and channel it shows, then Next → Add workflow.",
    "Dê um nome (por exemplo, Automações do Board), confira a equipe e o canal que ele mostra e clique em Próximo → Adicionar fluxo de trabalho.",
  ),
  "automationSetup.extras.teamsHelp.step5": dict(
    "At the end it shows a URL: copy it and paste it above.",
    "No fim ele mostra uma URL: copie e cole no campo acima.",
  ),
  "automationSetup.extras.teamsHelp.lost": dict(
    "Lost the URL? Teams → Workflows app → open the workflow → Edit → the first step (When a Teams webhook request is received) → HTTP URL.",
    "Perdeu a URL? Teams → app Workflows → abra o fluxo → Editar → primeiro passo (When a Teams webhook request is received) → HTTP URL.",
  ),
  "automationSetup.extras.teamsHelp.secret": dict(
    "Treat it like a password: anyone with it can post in that channel.",
    "Trate como senha: quem tiver a URL consegue postar nesse canal.",
  ),
  "automationSetup.extras.jenkinsUser": dict("Jenkins user", "Usuário do Jenkins"),
  "automationSetup.extras.jenkinsToken": dict("Jenkins API token", "API token do Jenkins"),
  "automationSetup.extras.jenkinsUser.help": dict(
    "Your Jenkins user id, as in your profile's address (…/user/<id>/), not the display name.",
    "O seu ID de usuário no Jenkins, como na URL do seu perfil (…/user/<id>/), não o nome que aparece na tela.",
  ),
  "automationSetup.extras.jenkinsHelp.title": dict(
    "How to get the Jenkins user and token",
    "Como conseguir o usuário e o token do Jenkins",
  ),
  "automationSetup.extras.jenkinsHelp.intro": dict(
    'Used to read why a build failed (the diagnosis), to run a build again and for "Point to homolog".',
    'Usados pra ler por que um build falhou (o diagnóstico), rodar build de novo e o "Apontar pra homolog".',
  ),
  "automationSetup.extras.jenkinsHelp.step1": dict(
    "Open the team's Jenkins and log in.",
    "Abra o Jenkins do time e faça login.",
  ),
  "automationSetup.extras.jenkinsHelp.step2": dict(
    "Click your name at the top right. The address becomes …/user/<id>/: that <id> is the Jenkins user (often your login, not the name shown).",
    "Clique no seu nome no canto superior direito. A URL vira …/user/<id>/: esse <id> é o Usuário do Jenkins (muitas vezes o seu login, não o nome que aparece).",
  ),
  "automationSetup.extras.jenkinsHelp.step3": dict(
    "Open Security (Configure on older versions).",
    "Abra Security (Configure, nas versões mais antigas).",
  ),
  "automationSetup.extras.jenkinsHelp.step4": dict(
    "Under API Token, click Add new token, give it a name (e.g. Board automations) and Generate.",
    "Em API Token, clique em Add new token, dê um nome (por exemplo, Automações do Board) e clique em Generate.",
  ),
  "automationSetup.extras.jenkinsHelp.step5": dict(
    "Copy the token right away (it's shown only once) and paste it in Jenkins API token.",
    "Copie o token na hora (ele só aparece uma vez) e cole em API token do Jenkins.",
  ),
  "automationSetup.extras.jenkinsHelp.open": dict(
    "Open the team's Jenkins",
    "Abrir o Jenkins do time",
  ),
  "automationSetup.extras.jenkinsHelp.secret": dict(
    "The token acts as you in Jenkins: don't share it.",
    "O token age como você no Jenkins: não compartilhe.",
  ),

  "automationSetup.finish.description": dict(
    "Pick a mode for each automation. Simulation only shows in the Board what it would do; On does it in your name. These are the same cards as in the Board's Automation settings, where they can be changed any time.",
    "Escolha um modo pra cada automação. Simulação só mostra no Board o que faria; Ligado faz no seu nome. São os mesmos cards das configurações de Automação do Board, onde dá pra mudar a qualquer hora.",
  ),
  "automationSetup.needs.todo": dict(
    "map the To Do column in step 3.",
    "marque a coluna To Do na etapa 3.",
  ),
  "automationSetup.needs.testColumns": dict(
    "map the Waiting for test and Testing columns in step 3.",
    "marque as colunas Aguardando teste e Em teste na etapa 3.",
  ),
  "automationSetup.needs.jenkins": dict(
    "fill in the Jenkins user and token in step 6.",
    "preencha o usuário e o token do Jenkins na etapa 6.",
  ),
  "automationSetup.needs.teams": dict(
    "fill in the Teams workflow URL in step 6.",
    "preencha a URL do workflow do Teams na etapa 6.",
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
