import { dict } from "../dict";

export const newTask = {
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
  "newTaskModal.extraRepos.yes": dict("Yes", "Sim"),
  "newTaskModal.extraRepos.no": dict("No", "Não"),
  "newTaskModal.extraRepos.add": dict("+ Add a repo…", "+ Adicionar repo…"),
  "newTaskModal.extraRepos.remove": dict("Remove", "Remover"),
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
  "newTaskModal.baseBranchLabel": dict("Base branch", "Branch base"),
  "newTaskModal.useLocalBaseBranchLabel": dict(
    "Use the local branch instead of fetching the latest from the remote.",
    "Usar a branch local em vez de buscar a mais recente do remoto.",
  ),
  "newTaskModal.branchNameLabel": dict("Branch name", "Nome da branch"),
  "newTaskModal.useWorktreeLabel": dict(
    "Use an isolated worktree — instead of switching the branch directly in the project folder.",
    "Usar um worktree isolado — em vez de trocar a branch diretamente na pasta do projeto.",
  ),
  "newTaskModal.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Verifique a barra de tarefas se ele não veio para a frente.",
  ),
  "newTaskModal.unexpectedFailure": dict("Unexpected failure.", "Falha inesperada."),
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
  "taskTestSkill.title": dict("Task test skill", "Skill de teste da tarefa"),
  "taskTestSkill.description": dict(
    "The skill the task queue's test entries run with the task's link. None = \"Test the task <link>\".",
    'A skill que os testes da fila de tarefas rodam com o link da tarefa. Nenhuma = "Teste a tarefa <link>".',
  ),
  "taskReviewSkill.title": dict("Code review skill", "Skill de code review"),
  "taskReviewSkill.description": dict(
    "The skill the task queue's code reviews run with the PR's link (the board automations queue them too). The app posts the result on the PR within the board's limits.",
    "A skill que os code reviews da fila de tarefas rodam com o link do PR (as automações do Board também colocam na fila). O app publica o resultado no PR dentro dos limites do Board.",
  ),
  "taskRefinementSkill.title": dict("Refinement skill", "Skill de refinamento"),
  "taskRefinementSkill.description": dict(
    'The skill "Refine tasks" runs with the chosen sprint or tasks to estimate them and draft the questions for the PO.',
    'A skill que o "Refinar tarefas" roda com a sprint ou as tarefas escolhidas pra pontuar e levantar as perguntas pro PO.',
  ),
  "refinementModal.title": dict("Refine tasks", "Refinar tarefas"),
  "refinementModal.intro": dict(
    'Name a sprint to refine all of it, or paste specific tasks (link or key, one per line). A new session prepares the whole batch, goes through the technical round with the devs one card at a time and then writes the comments for the PO. Nothing is written to Jira without your OK; "resume the refinement" in the session picks up where it stopped.',
    'Informe uma sprint pra refinar ela toda, ou cole tarefas específicas (link ou chave, uma por linha). Uma sessão nova prepara o lote todo, passa pela etapa técnica com os devs um card por vez e depois monta os comentários pro PO. Nada vai pro Jira sem o seu OK; "retoma o refinamento" na sessão volta de onde parou.',
  ),
  "refinementModal.skillLabel": dict("Skill", "Skill"),
  "refinementModal.skillRequired": dict(
    "Choose the refinement skill to fill in the sprint or the tasks.",
    "Escolha a skill de refinamento pra informar a sprint ou as tarefas.",
  ),
  "refinementModal.sprintLabel": dict("Sprint (optional)", "Sprint (opcional)"),
  "refinementModal.sprintPlaceholder": dict(
    "e.g. Team Q4SP3 11/04 - 11/17",
    "ex.: Time Q4SP3 04/11 - 17/11",
  ),
  "refinementModal.tasksLabel": dict("Tasks (optional)", "Tarefas (opcional)"),
  "refinementModal.tasksPlaceholder": dict(
    "https://your-site.atlassian.net/browse/PROJ-123\nPROJ-124",
    "https://seu-site.atlassian.net/browse/PROJ-123\nPROJ-124",
  ),
  "refinementModal.detected": dict("{count} task(s): {keys}", "{count} tarefa(s): {keys}"),
  "refinementModal.wholeSprint": dict(
    "No tasks: the skill lists the sprint's cards and confirms which ones to refine.",
    "Sem tarefas: a skill lista os cards da sprint e confirma quais refinar.",
  ),
  "refinementModal.nothingChosen": dict(
    "Neither sprint nor tasks: the skill offers the team's open and upcoming sprints.",
    "Sem sprint nem tarefas: a skill oferece as sprints abertas e as próximas do time.",
  ),
  "refinementModal.directToPoLabel": dict("Straight to the PO", "Direto pro PO"),
  "refinementModal.directToPoExplanation": dict(
    "Skips the technical round with the devs. For a single card or when the team isn't together.",
    "Pula a etapa técnica com os devs. Pra quando for um card só ou o time não estiver junto.",
  ),
  "refinementModal.notesLabel": dict("Additional notes", "Observações adicionais"),
  "refinementModal.notesPlaceholder": dict(
    'Exceptions the skill doesn\'t cover, e.g. "PROJ-123 already has the backend ready". Sent along with the tasks; the first line also goes into the session name.',
    'Exceções que a skill não cobre, ex.: "PROJ-123 já tem o backend pronto". Vai junto com as tarefas; a primeira linha também entra no nome da sessão.',
  ),
  "refinementModal.confirm": dict("Open session", "Abrir sessão"),
  "refinementModal.launched": dict("Refinement session opened.", "Sessão de refinamento aberta."),
  "refinementModal.launchFailed": dict(
    "Couldn't open the session: {message}",
    "Não foi possível abrir a sessão: {message}",
  ),
  "skillSelect.none": dict("None", "Nenhuma"),
  "skillSelect.other": dict("Outside the hub", "Fora do hub"),
  "skillSelect.notInstalled": dict("{skill} (install)", "{skill} (instalar)"),
  "skillSelect.installFailed": dict(
    "Couldn't install {skill}: another skill already uses that name ({conflicts}).",
    "Não foi possível instalar {skill}: outra skill já usa esse nome ({conflicts}).",
  ),
  "skillSelect.missing": dict("{skill} (not installed)", "{skill} (não instalada)"),
};
