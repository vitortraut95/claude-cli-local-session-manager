import { dict } from "../dict";

export const newTask = {
  "newTaskModal.title": dict("New task", "Nova tarefa"),
  "newTaskModal.confirm": dict("Create and open terminal", "Criar e abrir terminal"),
  "newTaskModal.cancel": dict("Cancel", "Cancelar"),
  "newTaskModal.clear": dict("Clear", "Limpar"),
  "newTaskModal.step.repo": dict(
    "Confirm the folder is a git repository",
    "Confirmar que a pasta é um repositório git",
  ),
  "newTaskModal.step.base": dict(
    "Fetch the latest version of the base branch",
    "Buscar a versão mais recente da branch base",
  ),
  "newTaskModal.step.worktree": dict(
    "Create the branch and isolated worktree",
    "Criar a branch e o worktree isolado",
  ),
  "newTaskModal.step.worktreeNoWorktree": dict(
    "Create the branch directly in the project folder (no worktree)",
    "Criar a branch diretamente na pasta do projeto (sem worktree)",
  ),
  "newTaskModal.step.extraRepo": dict(
    "Create the branch in {project} and link it to the task",
    "Criar a branch em {project} e vincular à tarefa",
  ),
  "newTaskModal.extraRepos.label": dict(
    "Other repos of this task (optional)",
    "Outros repos desta tarefa (opcional)",
  ),
  "newTaskModal.extraRepos.hint": dict(
    "Each gets the same branch ({branch}), off the base you type (blank = the repo's default), and joins the session via --add-dir. You can also add repos later from the card.",
    "Cada um recebe a mesma branch ({branch}), a partir da base indicada (vazio = padrão do repo), e entra na sessão via --add-dir. Também dá para adicionar depois, pelo card.",
  ),
  "newTaskModal.extraRepos.needsKey": dict(
    "Needs a ticket key in the link (e.g. PROJ-123) to group the repos into one task.",
    "Precisa de uma chave de ticket no link (ex.: PROJ-123) para agrupar os repos numa tarefa.",
  ),
  "newTaskModal.extraRepos.needsLinkFirst": dict(
    "First paste the ticket link (with its key, e.g. PROJ-123) — the extra repos are grouped by it.",
    "Primeiro cole o link do Jira (com a chave, ex.: PROJ-123) — os repos extras são agrupados por ela.",
  ),
  "newTaskModal.extraRepos.yes": dict("Yes", "Sim"),
  "newTaskModal.extraRepos.no": dict("No", "Não"),
  "newTaskModal.extraRepos.add": dict("+ Add a repo…", "+ Adicionar repo…"),
  "newTaskModal.extraRepos.remove": dict("Remove", "Remover"),
  "newTaskModal.extraRepos.promptNote": dict(
    "This task also spans these folders (already added with --add-dir): {dirs}",
    "Esta tarefa também envolve estas pastas (já adicionadas com --add-dir): {dirs}",
  ),
  "newTaskModal.extraRepos.partialFailure": dict(
    "The task started, but some repo couldn't be added — see the checklist.",
    "A tarefa foi iniciada, mas algum repo não pôde ser adicionado — veja a lista de passos.",
  ),
  "newTaskModal.step.launch": dict(
    "Open terminal and start Claude",
    "Abrir terminal e iniciar o Claude",
  ),
  "newTaskModal.jiraLinkLabel": dict("Task link (Jira)", "Link da tarefa (Jira)"),
  "newTaskModal.taskPrefix": dict("Task", "Tarefa"),
  "newTaskModal.projectLabel": dict("Project (folder)", "Projeto (pasta)"),
  "newTaskModal.loadingProjects": dict("Loading projects…", "Carregando projetos…"),
  "newTaskModal.selectProject": dict("Select a project", "Selecione um projeto"),
  "newTaskModal.recentProjectsGroup": dict("Recent", "Recentes"),
  "newTaskModal.workspaceProjectsGroup": dict(
    "Other repos (from your folders)",
    "Outros repositórios (das suas pastas)",
  ),
  "newTaskModal.otherFolder": dict("Other (paste folder path)", "Outro (cole o caminho da pasta)"),
  "newTaskModal.readingRepoInfo": dict(
    "Reading repository information…",
    "Lendo as informações do repositório…",
  ),
  "newTaskModal.repoInfoError": dict(
    "Could not read this repository's information.",
    "Não foi possível ler as informações deste repositório.",
  ),
  "newTaskModal.promptLabel": dict("Prompt", "Prompt"),
  "newTaskModal.saving": dict("Saving…", "Salvando…"),
  "newTaskModal.saveAsDefault": dict("Save as default", "Salvar como padrão"),
  "newTaskModal.promptSaved": dict("Default prompt saved.", "Prompt padrão salvo."),
  "newTaskModal.promptSaveError": dict(
    "Could not save the default prompt.",
    "Não foi possível salvar o prompt padrão.",
  ),
  "newTaskModal.loadingDefaultPrompt": dict(
    "Loading default prompt…",
    "Carregando o prompt padrão…",
  ),
  "newTaskModal.promptPlaceholder": dict("Instructions for Claude…", "Instruções para o Claude…"),
  "newTaskModal.baseBranchLabel": dict("Base branch", "Branch base"),
  "newTaskModal.useLocalBaseBranchLabel": dict(
    "Use the local branch instead of fetching the latest from the remote.",
    "Usar a branch local em vez de buscar a mais recente do remoto.",
  ),
  "newTaskModal.branchTypeLabel": dict("Branch type", "Tipo de branch"),
  "newTaskModal.otherBranchType": dict("Other", "Outro"),
  "newTaskModal.customPrefixPlaceholder": dict("custom prefix", "prefixo personalizado"),
  "newTaskModal.branchNameLabel": dict("Branch name", "Nome da branch"),
  "newTaskModal.branchPreview": dict("Preview:", "Pré-visualização:"),
  "newTaskModal.useWorktreeLabel": dict(
    "Use an isolated worktree — instead of switching the branch directly in the project folder.",
    "Usar um worktree isolado — em vez de trocar a branch diretamente na pasta do projeto.",
  ),
  "newTaskModal.useAsDefault": dict("Use as default", "Usar como padrão"),
  "newTaskModal.worktreePrefSaved": dict(
    "Worktree preference saved.",
    "Preferência de worktree salva.",
  ),
  "newTaskModal.worktreePrefSaveError": dict(
    "Could not save this preference.",
    "Não foi possível salvar essa preferência.",
  ),
  "newTaskModal.noWorktreeWarning": dict(
    "Without a worktree, the new branch is switched directly in the project's main folder — this can cause conflicts if another terminal or session is already active there.",
    "Sem um worktree, a nova branch é trocada diretamente na pasta principal do projeto — isso pode causar conflitos se outro terminal ou sessão já estiver ativo ali.",
  ),
  "newTaskModal.worktreeAutoExplanation": dict(
    "We only suggest an isolated worktree when this project's main folder already has an active session — otherwise the branch is switched directly there, which is simpler and doesn't leave an extra folder behind. You can always override this checkbox by hand.",
    "Só sugerimos um worktree isolado quando a pasta principal deste projeto já tem uma sessão ativa — caso contrário, a branch é trocada diretamente ali, o que é mais simples e não deixa uma pasta extra para trás. Você sempre pode sobrescrever essa opção manualmente.",
  ),
  "newTaskModal.checkingActiveSession": dict(
    "Checking whether this project already has an active session…",
    "Verificando se este projeto já tem uma sessão ativa…",
  ),
  "newTaskModal.activeSessionDetected": dict(
    "Active session detected in this project's main folder — suggesting an isolated worktree so this new task doesn't interfere with it.",
    "Sessão ativa detectada na pasta principal deste projeto — sugerindo um worktree isolado para essa nova tarefa não interferir nela.",
  ),
  "newTaskModal.noActiveSessionDetected": dict(
    "No active session detected in this project's main folder, so a worktree isn't needed.",
    "Nenhuma sessão ativa detectada na pasta principal deste projeto, então um worktree não é necessário.",
  ),
  "newTaskModal.permissionModeAutoLabel": dict(
    "Skip permission prompts (--permission-mode auto)",
    "Pular confirmações de permissão (--permission-mode auto)",
  ),
  "newTaskModal.permissionModeAutoExplanation": dict(
    "Starts the session with Claude Code's own \"auto\" permission mode, so it stops asking for approval before most actions. Useful here specifically because a background terminal window can't be brought to front on some setups (see the app's own notes on this) — if it's sitting at an unanswered prompt you never saw, this avoids that entirely. Remembered as whatever you last left it at.",
    'Inicia a sessão no modo de permissão "auto" do próprio Claude Code, então ele para de pedir aprovação antes da maioria das ações. Útil aqui especificamente porque a janela do terminal em segundo plano não pode ser trazida para frente em algumas configurações — se ela estiver parada num prompt que você nunca viu, isso evita esse problema por completo. Fica lembrado como você deixou da última vez.',
  ),
  "newTaskModal.progressLabel": dict("Progress:", "Progresso:"),
  "newTaskModal.whatWillHappen": dict(
    'What will happen when you click "Create and open terminal":',
    'O que vai acontecer quando você clicar em "Criar e abrir terminal":',
  ),
  "newTaskModal.explain.repo.pre": dict("Confirms that", "Confirma que"),
  "newTaskModal.explain.folderPlaceholder": dict("(chosen folder)", "(pasta escolhida)"),
  "newTaskModal.explain.repo.post": dict("is a git repository.", "é um repositório git."),
  "newTaskModal.explain.base.pre.remote": dict(
    "Fetches the latest version of the base branch",
    "Busca a versão mais recente da branch base",
  ),
  "newTaskModal.explain.base.pre.local": dict(
    "Uses the local base branch",
    "Usa a branch base local",
  ),
  "newTaskModal.explain.basePlaceholder": dict("(base branch)", "(branch base)"),
  "newTaskModal.explain.base.post.remote": dict(
    "directly from the remote — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "diretamente do remoto — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
  ),
  "newTaskModal.explain.base.post.local": dict(
    "as-is, without fetching from the remote first — without checking it out or touching the project's main folder (doesn't affect any session already active there).",
    "como está, sem buscar do remoto primeiro — sem fazer checkout ou tocar na pasta principal do projeto (não afeta nenhuma sessão já ativa ali).",
  ),
  "newTaskModal.explain.branch.pre": dict("Creates the new branch", "Cria a nova branch"),
  "newTaskModal.explain.branchPlaceholder": dict("(branch name)", "(nome da branch)"),
  "newTaskModal.explain.branch.post": dict(
    "from that updated version.",
    "a partir dessa versão atualizada.",
  ),
  "newTaskModal.explain.worktree.skip": dict(
    "Switches to that branch directly in the project's main folder — without a worktree, this can conflict with another terminal already open there.",
    "Troca para essa branch diretamente na pasta principal do projeto — sem um worktree, isso pode conflitar com outro terminal já aberto ali.",
  ),
  "newTaskModal.explain.worktree.create": dict(
    "Creates an isolated worktree (its own folder, separate from the main one) already on that branch — this is what lets you work on this task without interfering with another terminal open on the same project.",
    "Cria um worktree isolado (uma pasta própria, separada da principal) já naquela branch — é isso que permite trabalhar nessa tarefa sem interferir em outro terminal aberto no mesmo projeto.",
  ),
  "newTaskModal.explain.launch.pre": dict("Opens a new terminal", "Abre um novo terminal"),
  "newTaskModal.explain.launch.inProjectFolder": dict(
    "in the project folder",
    "na pasta do projeto",
  ),
  "newTaskModal.explain.launch.insideWorktree": dict(
    "inside that worktree",
    "dentro daquele worktree",
  ),
  "newTaskModal.explain.launch.and": dict("and starts", "e inicia o"),
  "newTaskModal.explain.launch.post": dict(
    "with the prompt above as the first message.",
    "com o prompt acima como primeira mensagem.",
  ),
  "newTaskModal.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Verifique a barra de tarefas se ele não veio para a frente.",
  ),
  "newTaskModal.unexpectedFailure": dict("Unexpected failure.", "Falha inesperada."),
  "newTaskModal.createFailed": dict(
    "Failed to create task: {message}",
    "Falha ao criar a tarefa: {message}",
  ),
  "newSessionModal.title": dict("New session", "Nova sessão"),
  "newSessionModal.intro": dict(
    "Starts Claude straight in the project's folder, on whatever branch it's on — no Jira link, branch or worktree.",
    "Inicia o Claude direto na pasta do projeto, na branch em que ela estiver — sem link do Jira, branch nem worktree.",
  ),
  "newSessionModal.confirm": dict("Start session", "Iniciar sessão"),
  "newSessionModal.promptPlaceholder": dict(
    "Instructions for Claude (optional — leave blank to just open Claude)…",
    "Instruções para o Claude (opcional — deixe em branco para só abrir o Claude)…",
  ),
  "newSessionModal.launchFailed": dict(
    "Failed to start the session: {message}",
    "Falha ao iniciar a sessão: {message}",
  ),
  "newSessionModal.activeSessionTitle": dict(
    "There's already a session in this repository",
    "Já existe uma sessão neste repositório",
  ),
  "newSessionModal.activeSessionMessage": dict(
    "A Claude session is already running in {folder}. Both sessions will work on the same files and branch at the same time. Start anyway?",
    "Já há uma sessão do Claude rodando em {folder}. As duas sessões vão mexer nos mesmos arquivos e na mesma branch ao mesmo tempo. Iniciar mesmo assim?",
  ),
  "newSessionModal.activeSessionConfirm": dict("Start anyway", "Iniciar mesmo assim"),
  "testTaskModal.title": dict("Test task", "Testar tarefa"),
  "testTaskModal.intro": dict(
    "Opens a terminal in {dir} running {command}. The skill does the rest: finds the project, plans and runs the test.",
    "Abre um terminal em {dir} rodando {command}. A skill faz o resto: acha o projeto, planeja e executa o teste.",
  ),
  "testTaskModal.linkLabel": dict("Task link", "Link da tarefa"),
  "testTaskModal.linkPlaceholder": dict(
    "https://company.atlassian.net/browse/PROJ-123",
    "https://company.atlassian.net/browse/PROJ-123",
  ),
  "testTaskModal.permissionModeAutoExplanation": dict(
    "On by default here: the test skill only reads code and the ticket, and its terminal usually sits in the background. Remembered as whatever you last left it at.",
    "Ligado por padrão aqui: a skill de teste só lê o código e o ticket, e o terminal dela costuma ficar em segundo plano. Fica lembrado como você deixou da última vez.",
  ),
  "testTaskModal.confirm": dict("Test", "Testar"),
  "testTaskModal.nickname": dict("Test - {link}", "Teste - {link}"),
  "testTaskModal.launchFailed": dict(
    "Failed to start the test: {message}",
    "Falha ao iniciar o teste: {message}",
  ),
  "taskTestSkill.title": dict("Task test skill", "Skill de teste da tarefa"),
  "taskTestSkill.description": dict(
    "The skill the header's \"Test task\" button runs with the task's link. The button only shows up once one is chosen.",
    'A skill que o botão "Testar tarefa" do header roda com o link da tarefa. O botão só aparece depois que uma é escolhida.',
  ),
  "taskTestSkill.none": dict("None (button hidden)", "Nenhuma (botão escondido)"),
  "taskTestSkill.missing": dict("{skill} (not installed)", "{skill} (não instalada)"),
};
