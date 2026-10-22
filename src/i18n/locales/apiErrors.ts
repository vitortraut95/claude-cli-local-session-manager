import { dict } from "../dict";

export const apiErrors = {
  // Server error codes (see resolveApiErrorMessage) — generic, since only the code is known.
  "apiError.sessionNotFound": dict("Session not found.", "Sessão não encontrada."),
  "apiError.sessionActive": dict(
    "This session (or its folder) is already open in another terminal.",
    "Esta sessão (ou a pasta dela) já está aberta em outro terminal.",
  ),
  "apiError.invalidSessionId": dict("Invalid session id.", "Id de sessão inválido."),
  "apiError.limuxNotInstalled": dict(
    "Limux isn't installed (github.com/am-will/limux) — install it, or set sessions to open in tabs in Settings.",
    "O Limux não está instalado (github.com/am-will/limux) — instale, ou volte as sessões pra abas nas Configurações.",
  ),
  "apiError.taskFolderRequired": dict(
    "A project folder is required.",
    "É necessário informar a pasta do projeto.",
  ),
  "apiError.taskFolderNotFound": dict("That folder doesn't exist.", "Essa pasta não existe."),
  "apiError.taskNotGitRepo": dict(
    "That folder isn't inside a git repository.",
    "Essa pasta não está dentro de um repositório git.",
  ),
  "apiError.taskBaseBranchRequired": dict(
    "A source branch is required.",
    "É necessário informar a branch de origem.",
  ),
  "apiError.taskBranchNameRequired": dict(
    "A branch name is required.",
    "É necessário informar o nome da branch.",
  ),
  "apiError.taskInvalidBranchName": dict(
    'Not a valid branch name (letters, numbers, "-", "_", "." and "/" only, must start with a ' +
      "letter or number).",
    'Nome de branch inválido (apenas letras, números, "-", "_", "." e "/", precisa começar com ' +
      "letra ou número).",
  ),
  "apiError.taskBaseBranchRefRequired": dict(
    "A resolved base branch is required.",
    "É necessário resolver a branch base primeiro.",
  ),
  "apiError.taskInvalidKey": dict(
    "That isn't a ticket key (e.g. PROJ-123) or a ticket link.",
    "Isso não é uma chave de ticket (ex.: PROJ-123) nem um link de ticket.",
  ),
  "apiError.taskRepoNotFound": dict(
    "That repo isn't part of this task.",
    "Esse repo não faz parte desta tarefa.",
  ),
  "apiError.taskBranchExists": dict("That branch already exists.", "Essa branch já existe."),
  "apiError.taskWorktreeExists": dict(
    "The worktree folder for this branch name is already in use — try a different branch name, or remove the worktree occupying it.",
    "A pasta de worktree para esse nome de branch já está em uso — tente outro nome de branch, ou remova o worktree que a está ocupando.",
  ),
  "apiError.taskWorktreePathRequired": dict(
    "A worktree path is required.",
    "É necessário informar o caminho do worktree.",
  ),
  "apiError.taskTestLinkRequired": dict("Paste the task's link.", "Cole o link da tarefa."),
  "apiError.taskTestSkillNotConfigured": dict(
    "No test skill is configured. Choose one in Settings or in the Skills window.",
    "Nenhuma skill de teste configurada. Escolha uma em Configurações ou na janela de Skills.",
  ),
  "apiError.taskTestSkillNotInstalled": dict(
    "The configured test skill isn't installed on this machine anymore. Choose another one or install it again.",
    "A skill de teste configurada não está mais instalada nesta máquina. Escolha outra ou instale de novo.",
  ),
  "apiError.malformedPreferences": dict(
    "Malformed preferences payload.",
    "Payload de preferências malformado.",
  ),
  "apiError.usageNoCredentials": dict(
    'Could not find Claude\'s login credentials — run "claude" and sign in first.',
    'Não foi possível encontrar as credenciais de login do Claude — rode "claude" e faça login primeiro.',
  ),
  "apiError.usageCredentialsUnreadable": dict(
    "Claude's credentials file is unreadable.",
    "O arquivo de credenciais do Claude está ilegível.",
  ),
  "apiError.usageNoToken": dict(
    'No Claude login token found — run "claude" and sign in first.',
    'Nenhum token de login do Claude encontrado — rode "claude" e faça login primeiro.',
  ),
  "apiError.usageEndpointUnreachable": dict(
    "Could not reach Anthropic's usage endpoint.",
    "Não foi possível acessar o endpoint de uso da Anthropic.",
  ),
  "apiError.usageTokenExpired": dict(
    'Claude\'s login token has expired — run "claude" once to refresh it.',
    'O token de login do Claude expirou — rode "claude" uma vez para renová-lo.',
  ),
  "apiError.usageRateLimited": dict(
    "Anthropic is rate-limiting usage checks (HTTP 429) — the app pauses them and tries again by itself in a few minutes.",
    "A Anthropic está limitando as consultas de uso (HTTP 429) — o app pausa as consultas e tenta de novo sozinho em alguns minutos.",
  ),
  "apiError.usageFetchFailed": dict(
    "Could not fetch usage data.",
    "Não foi possível buscar os dados de uso.",
  ),
  "apiError.updateAlreadyRunning": dict(
    "An update is already in progress.",
    "Uma atualização já está em andamento.",
  ),
  "apiError.updateFetchFailed": dict(
    "Could not reach the remote repository.",
    "Não foi possível acessar o repositório remoto.",
  ),
  "apiError.updateUnexpectedGitOutput": dict(
    "Unexpected output while checking for updates.",
    "Saída inesperada ao verificar atualizações.",
  ),
  "apiError.updateGitPullFailed": dict(
    "Failed to pull the latest changes. If this keeps happening, open a terminal in the " +
      "project folder and run: git fetch origin && git reset --hard origin/main (this discards " +
      "any local changes in favor of the remote).",
    "Falha ao buscar as atualizações mais recentes. Se isso continuar acontecendo, abra um " +
      "terminal na pasta do projeto e rode: git fetch origin && git reset --hard origin/main " +
      "(isso descarta qualquer alteração local em favor do remoto).",
  ),
  "apiError.updateYarnInstallFailed": dict(
    "Failed to install dependencies.",
    "Falha ao instalar as dependências.",
  ),
  "apiError.cleanupMissingTarget": dict(
    "Missing worktree path or branch for this cleanup item.",
    "Faltam o caminho do worktree ou a branch para este item de limpeza.",
  ),
  "apiError.cleanupTargetGone": dict(
    "That folder no longer exists — refresh the list.",
    "Essa pasta não existe mais — atualize a lista.",
  ),
  "apiError.cleanupBranchNotMerged": dict(
    "That branch is no longer merged into the default branch — cancelled for safety.",
    "Essa branch não está mais mergeada na branch padrão — cancelado por segurança.",
  ),
  "apiError.cleanupUncommittedChanges": dict(
    "That folder now has uncommitted changes — cancelled for safety.",
    "Essa pasta agora tem alterações não commitadas — cancelado por segurança.",
  ),
  "apiError.malformedCleanupFinding": dict(
    "Malformed cleanup finding.",
    "Item de limpeza malformado.",
  ),
  "apiError.taskBaseBranchNotFound": dict(
    "That base branch wasn't found locally or on origin.",
    "Essa branch base não foi encontrada localmente nem no origin.",
  ),
  "apiError.notAGitWorktree": dict(
    "That folder is no longer a git worktree.",
    "Essa pasta não é mais um worktree do git.",
  ),
  "apiError.sessionNoWorkingDirectory": dict(
    "This session has no known working directory.",
    "Esta sessão não tem um diretório de trabalho conhecido.",
  ),
  "apiError.sessionDirectoryMissing": dict(
    "This session's original directory no longer exists. Recreate the folder (or a symlink) at " +
      "the old path to continue working with it.",
    "O diretório original desta sessão não existe mais. Recrie a pasta (ou um link simbólico) no " +
      "caminho antigo para continuar trabalhando com ela.",
  ),
  "apiError.directoryMissing": dict(
    "That directory no longer exists.",
    "Essa pasta não existe mais.",
  ),
  "apiError.vscodeCommandNotFound": dict(
    'Could not open VS Code — the "code" command wasn\'t found on PATH.',
    'Não foi possível abrir o VS Code — o comando "code" não foi encontrado no PATH.',
  ),
  "apiError.cursorCommandNotFound": dict(
    'Could not open Cursor — the "cursor" command wasn\'t found on PATH.',
    'Não foi possível abrir o Cursor — o comando "cursor" não foi encontrado no PATH.',
  ),
  "apiError.notAppWorktree": dict(
    "This session's directory doesn't look like one of this app's own worktrees.",
    "O diretório desta sessão não parece ser um worktree criado por este app.",
  ),
  "apiError.projectRootMissing": dict(
    "The project's root folder no longer exists either.",
    "A pasta raiz do projeto também não existe mais.",
  ),
  "apiError.terminalLaunchFailed": dict(
    "Could not open a terminal.",
    "Não foi possível abrir um terminal.",
  ),
  "apiError.worktreeNameRequired": dict(
    "A worktree name is required.",
    "É necessário informar o nome do worktree.",
  ),
  "apiError.notAWorktreeSession": dict(
    "This session isn't running in a git worktree.",
    "Esta sessão não está rodando em um worktree do git.",
  ),
  "apiError.protectedBranchDeleteForbidden": dict(
    "Refusing to delete that branch — it looks like the repo's primary branch.",
    "Não é possível excluir essa branch — ela parece ser a branch principal do repositório.",
  ),
  "apiError.importInvalidBundle": dict(
    "This file isn't a session exported by Claude Session Manager.",
    "Este arquivo não é uma sessão exportada pelo Claude Session Manager.",
  ),
  "apiError.importUnsupportedVersion": dict(
    "This session was exported by a newer version of the app — update it first.",
    "Esta sessão foi exportada por uma versão mais nova do app — atualize-o primeiro.",
  ),
  "apiError.importTargetRequired": dict(
    "Choose the folder to import the session into.",
    "Escolha a pasta para onde importar a sessão.",
  ),
  "apiError.importTargetMissing": dict(
    "That folder doesn't exist on this machine.",
    "Essa pasta não existe nesta máquina.",
  ),
  "apiError.importSessionExists": dict(
    "This session already exists here — choose whether to overwrite it or import a copy.",
    "Esta sessão já existe aqui — escolha entre sobrescrever ou importar uma cópia.",
  ),
  "apiError.importOverwriteActive": dict(
    "The local session is active in a terminal — close it before overwriting, or import a copy.",
    "A sessão local está ativa num terminal — feche-a antes de sobrescrever, ou importe uma cópia.",
  ),
  "apiError.importCheckoutBlockedActive": dict(
    "Another Claude session is active in that folder — close it before switching branches, or import without checking out.",
    "Outra sessão do Claude está ativa nessa pasta — feche-a antes de trocar de branch, ou importe sem fazer checkout.",
  ),
  "apiError.worktreeUncommittedChanges": dict(
    "That worktree still has uncommitted changes, so it wasn't removed — commit or discard them " +
      'first (or use "copy" mode instead, which doesn\'t require the worktree to be clean).',
    "Esse worktree ainda tem alterações não commitadas, então não foi removido — commite ou " +
      'descarte elas primeiro (ou use o modo "copiar", que não exige que o worktree esteja limpo).',
  ),
  "apiError.taskSessionHasNoBranch": dict(
    "This session isn't on a git branch, so it can't be linked to a task.",
    "Esta sessão não está numa branch git, então não dá para vinculá-la a uma tarefa.",
  ),
  "apiError.malformedPreferencesFile": dict(
    "That file isn't a settings file.",
    "Esse arquivo não é um arquivo de configurações.",
  ),
  "apiError.cleanupBranchHasCommits": dict(
    "That branch now has commits of its own — cancelled for safety.",
    "Essa branch agora tem commits próprios — cancelado por segurança.",
  ),
  "apiError.cleanupWorktreeHasSession": dict(
    "A session now exists in that worktree — cancelled for safety.",
    "Agora existe uma sessão nesse worktree — cancelado por segurança.",
  ),
  "apiError.skillsHubRepoUrlMissing": dict(
    "The skills hub repo URL isn't set.",
    "A URL do repo do hub de skills não está configurada.",
  ),
  "apiError.skillsFolderOpenFailed": dict(
    "Couldn't open the folder in the file manager (xdg-open not available?).",
    "Não deu pra abrir a pasta no explorador de arquivos (xdg-open indisponível?).",
  ),
  "apiError.skillsHubNotFound": dict(
    "Skills hub clone not found.",
    "Clone do hub de skills não encontrado.",
  ),
  "apiError.skillsHubInvalidPath": dict(
    "That folder isn't a clone of the configured skills hub (needs a catalog/ folder and the configured repo as origin).",
    "Essa pasta não é um clone do hub de skills configurado (precisa ter a pasta catalog/ e o repo configurado como origin).",
  ),
  "apiError.skillsHubCloneParentMissing": dict(
    "The destination folder doesn't exist.",
    "A pasta de destino não existe.",
  ),
  "apiError.skillsHubCloneTargetExists": dict(
    "There's already a folder with that name there (and it isn't the hub).",
    "Já existe uma pasta com esse nome ali (e ela não é o hub).",
  ),
  "apiError.skillsDirUnwritable": dict(
    "Couldn't create Claude's skills folder (~/.claude/skills).",
    "Não foi possível criar a pasta de skills do Claude (~/.claude/skills).",
  ),
  "apiError.skillNotFound": dict(
    "Skill not found in the skills hub (maybe removed by the last update).",
    "Skill não encontrada no hub de skills (talvez removida na última atualização).",
  ),
  "apiError.previewLimit": dict(
    "The preview limit is reached — stop another preview first (limit in the Task queue window).",
    "O limite de previews foi atingido — pare outro preview antes (limite na janela da fila).",
  ),
};
