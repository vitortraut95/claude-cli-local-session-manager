import { dict } from "../dict";

export const sessions = {
  "nicknameModal.title": dict("Local nickname", "Apelido local"),
  "nicknameModal.save": dict("Save", "Salvar"),
  "nicknameModal.cancel": dict("Cancel", "Cancelar"),
  "nicknameModal.description": dict(
    "Only shown in this app's session list, alongside the session's real title — it won't rename the session or change what any terminal (including Warp) shows for it. Leave blank to remove the nickname.",
    "Aparece só na lista de sessões deste app, ao lado do título real da sessão — não renomeia a sessão nem muda o que qualquer terminal (incluindo o Warp) exibe para ela. Deixe em branco para remover o apelido.",
  ),
  "nicknameModal.placeholder": dict("Nickname", "Apelido"),
  "sessionBranchesModal.title": dict("Session branches", "Branches da sessão"),
  "sessionBranchesModal.description": dict(
    "Used by the Jenkins, preview and PR links. Saved only in this app — nothing is changed in git. Leave a field blank to go back to what the nickname or the session's transcript gives (shown in grey).",
    "Usadas nos links do Jenkins, das previews e do PR. Salvas só neste app — nada muda no git. Deixe um campo em branco para voltar ao que o apelido ou o histórico da sessão indica (mostrado em cinza).",
  ),
  "sessionBranchesModal.origin": dict(
    "Base (the branch the task was created from)",
    "Base (branch de onde a tarefa foi criada)",
  ),
  "sessionBranchesModal.destination": dict("Task branch", "Branch da tarefa"),
  "sessionBranchesModal.noFallback": dict("None", "Nenhuma"),
  "jenkinsLinksModal.title": dict("Jenkins", "Jenkins"),
  "jenkinsLinksModal.section.currentBranch": dict("Current branch", "Branch atual"),
  "jenkinsLinksModal.section.originBranch": dict("Branch it was created from", "Branch de origem"),
  "jenkinsLinksModal.section.envPreviews": dict("{branch} previews:", "Previews do {branch}:"),
  "jenkinsLinksModal.section.views": dict("Project", "Projeto"),
  "jenkinsLinksModal.project": dict("{project} (all branches)", "{project} (todas as branches)"),
  "jenkinsLinksModal.pullRequests": dict("Pull requests", "Pull requests"),
  "jenkinsLinksModal.tags": dict("Tags", "Tags"),
  "promptPreviewModal.loading": dict("Loading prompts…", "Carregando prompts…"),
  "promptPreviewModal.empty": dict(
    "No prompts found for this session.",
    "Nenhum prompt encontrado para esta sessão.",
  ),
  "promptPreviewModal.loadError": dict(
    "Couldn't load the full prompt text — showing a possibly truncated version.",
    "Não foi possível carregar o texto completo do prompt — mostrando uma versão possivelmente truncada.",
  ),
  "sessionCard.copyCommand.error": dict(
    "Could not copy the command.",
    "Não foi possível copiar o comando.",
  ),
  "sessionCard.branches.edit": dict(
    "Edit base and task branches",
    "Editar base e branch da tarefa",
  ),
  "sessionCard.branches.originLabel": dict("Base:", "Base:"),
  "sessionCard.task.label": dict("Task:", "Tarefa:"),
  "sessionCard.task.filter": dict("Search for this task", "Buscar esta tarefa"),
  "sessionCard.task.inferred": dict("Detected from the branch name", "Deduzida do nome da branch"),
  "sessionCard.task.alsoIn": dict("also in:", "também em:"),
  "sessionCard.task.alsoInCount": dict("also in {count} repos", "também em {count} repos"),
  "sessionCard.task.repoSessions.one": dict(
    "{branch} · {count} session — click to search for the task",
    "{branch} · {count} sessão — clique para buscar a tarefa",
  ),
  "sessionCard.task.repoSessions.many": dict(
    "{branch} · {count} sessions — click to search for the task",
    "{branch} · {count} sessões — clique para buscar a tarefa",
  ),
  "sessionCard.task.repoNoSession": dict(
    "{branch} · no session of its own — click to open the PR",
    "{branch} · sem sessão própria — clique para abrir o PR",
  ),
  "sessionCard.task.openPrError": dict(
    "Couldn't open a PR link for this repo.",
    "Não foi possível abrir um link de PR para este repo.",
  ),
  "sessionCard.branches.destinationLabel": dict("Task branch:", "Branch da tarefa:"),
  "sessionCard.nickname.edit": dict("Edit local nickname", "Editar apelido local"),
  "sessionCard.nickname.add": dict("Add local nickname", "Adicionar apelido local"),
  "sessionCard.nickname.localOnly": dict(
    "Local nickname — only shown in this app",
    "Apelido local — exibido apenas neste app",
  ),
  "sessionCard.continueDisabled.directoryMissing": dict(
    "Recreate the original folder (or a symlink to it) before resuming — the Claude CLI resolves sessions by working directory.",
    "Recrie a pasta original (ou um link simbólico pra ela) antes de retomar — o Claude CLI resolve sessões pela pasta de trabalho.",
  ),
  "sessionCard.resumeButton": dict("Resume (terminal)", "Retomar (terminal)"),
  "sessionCard.resumeIn.button": dict("Resume", "Retomar"),
  "sessionCard.deleteButton": dict("Delete", "Excluir"),
  "sessionCard.cancelButton": dict("Cancel", "Cancelar"),
  "sessionCard.checkbox.select": dict("Select session", "Selecionar sessão"),
  "sessionCard.checkbox.deselect": dict("Deselect session", "Desmarcar sessão"),
  "sessionCard.status.activeTooltip": dict(
    "Active — a terminal currently has this session resumed",
    "Ativa — um terminal está com esta sessão retomada agora",
  ),
  "sessionCard.status.inactiveTooltip": dict(
    "Inactive — no terminal currently has this session resumed",
    "Inativa — nenhum terminal está com esta sessão retomada agora",
  ),
  "sessionCard.status.activeLabel": dict("Active session", "Sessão ativa"),
  "sessionCard.status.inactiveLabel": dict("Inactive session", "Sessão inativa"),
  "sessionCard.directoryMissing.title": dict("Original folder missing", "Pasta original ausente"),
  "sessionCard.directoryMissing.tooltipWithPath": dict(
    "Original directory no longer exists: {path}",
    "O diretório original não existe mais: {path}",
  ),
  "sessionCard.directoryMissing.tooltipNoPath": dict(
    "This session's original directory no longer exists",
    "O diretório original desta sessão não existe mais",
  ),
  "sessionCard.directoryMissing.removedWorktree": dict(
    "This looks like a removed worktree — the project's root folder is still here:",
    "Isso parece um worktree removido — a pasta raiz do projeto ainda está aqui:",
  ),
  "sessionCard.directoryMissing.openRootAriaLabel": dict(
    "Open the project root in VS Code",
    "Abrir a raiz do projeto no VS Code",
  ),
  "sessionCard.codeButton": dict("code .", "code ."),
  "sessionCard.openEditor": dict("Open code", "Abrir code"),
  "sessionCard.openEditor.vscode": dict("VS Code", "VS Code"),
  "sessionCard.openEditor.cursor": dict("Cursor", "Cursor"),
  "sessionCard.directoryMissing.newSessionTooltip": dict(
    "The old transcript can't be resumed from a different folder — this starts a brand-new " +
      "conversation right here at the root, seeded with a recap of what the old session did.",
    "A transcrição antiga não pode ser retomada de uma pasta diferente — isso inicia uma " +
      "conversa totalmente nova aqui na raiz, alimentada com um resumo do que a sessão antiga " +
      "fez.",
  ),
  "sessionCard.newSessionAtRootButton": dict(
    "New session in this folder",
    "Nova sessão nesta pasta",
  ),
  "sessionCard.worktreeTooltip": dict("Git worktree — {path}", "Worktree do git — {path}"),
  "sessionCard.worktreeNameLabel": dict("Worktree name: {name}", "Nome do worktree: {name}"),
  "sessionCard.previewTooltip": dict(
    "Preview prompts sent in this session",
    "Veja os prompts enviados nesta sessão",
  ),
  "sessionCard.previewAriaLabel": dict("Preview prompts", "Ver prompts"),
  "sessionCard.openJenkinsTooltip": dict(
    "Jenkins links for this project and branch",
    "Links do Jenkins deste projeto e branch",
  ),
  "sessionCard.openJenkinsAriaLabel": dict("Jenkins links", "Links do Jenkins"),
  "sessionCard.openPrTooltip": dict(
    "Open this branch's compare/PR page (GitHub or Bitbucket)",
    "Abrir a página de comparação/PR desta branch (GitHub ou Bitbucket)",
  ),
  "sessionCard.openPrAriaLabel": dict("Open PR page", "Abrir página de PR"),
  "sessionCard.openPr.error": dict(
    "Couldn't open a PR link for this session.",
    "Não foi possível abrir um link de PR para esta sessão.",
  ),
  "openPrBaseChoiceModal.title": dict(
    "Compare against which base?",
    "Comparar com qual branch base?",
  ),
  "openPrBaseChoiceModal.intro": dict(
    "This task's branch was created off {branch} instead of the repo's default. Choose which comparison to open.",
    "A branch desta tarefa foi criada a partir de {branch}, e não da branch padrão do repositório. Escolha qual comparação abrir.",
  ),
  "openPrBaseChoiceModal.useBase.title": dict("Compare against {branch}", "Comparar com {branch}"),
  "openPrBaseChoiceModal.useBase.body": dict(
    "Opens the compare/PR page against the actual branch this task started from — the accurate diff.",
    "Abre a página de comparação/PR contra a branch que esta tarefa realmente usou como base — o diff correto.",
  ),
  "openPrBaseChoiceModal.useBase.button": dict("Compare with {branch}", "Comparar com {branch}"),
  "openPrBaseChoiceModal.useDefault.title": dict(
    "Compare against the repo's default",
    "Comparar com a branch padrão do repositório",
  ),
  "openPrBaseChoiceModal.useDefault.body": dict(
    "Opens the compare/PR page against the repo's usual default branch (main/master) instead.",
    "Abre a página de comparação/PR contra a branch padrão do repositório (main/master).",
  ),
  "openPrBaseChoiceModal.useDefault.button": dict("Compare with default", "Comparar com a padrão"),
  "openPrBaseChoiceModal.cancel": dict("Cancel", "Cancelar"),
  "sessionCard.cleanupWorktree.disabledTooltip": dict(
    "Close this session in its terminal before cleaning up the worktree.",
    "Encerre esta sessão no terminal antes de limpar o worktree.",
  ),
  "sessionCard.cleanupWorktree.tooltip": dict(
    "Clean up this worktree — removes its folder and the branch git created for it. Doesn't touch the session transcript.",
    "Limpa este worktree — remove a pasta e a branch que o git criou pra ele. Não afeta a transcrição da sessão.",
  ),
  "sessionCard.cleanupWorktreeAriaLabel": dict("Clean up worktree", "Limpar worktree"),
  "sessionCard.deleteDisabledTooltip": dict(
    "Close this session in its terminal before deleting.",
    "Encerre esta sessão no terminal antes de excluir.",
  ),
  "sessionCard.deleteWorktreeConfirm.title": dict("Clean up worktree", "Limpar worktree"),
  "sessionCard.deleteWorktreeConfirm.message": dict(
    "This removes the worktree's folder and the worktree-<name> branch git created for it, freeing the disk space it used. Uncommitted changes there will block the deletion — commit or stash them first if you need to keep them. The session transcript itself isn't affected.",
    "Isso remove a pasta do worktree e a branch worktree-<name> que o git criou pra ele, liberando o espaço em disco usado. Alterações não commitadas ali vão bloquear a exclusão — faça commit ou stash delas antes se precisar mantê-las. A transcrição da sessão em si não é afetada.",
  ),
  "useSessions.loadError": dict(
    "Could not load sessions.",
    "Não foi possível carregar as sessões.",
  ),
  "useSessions.worktreeDeleted": dict(
    "Worktree and its branch deleted.",
    "Worktree e sua branch excluídos.",
  ),
  "useSessions.cleanupWorktreeError": dict(
    "Could not clean up the worktree.",
    "Não foi possível limpar o worktree.",
  ),
  "useSessions.branchDeleted": dict('Branch "{branch}" deleted.', 'Branch "{branch}" excluída.'),
  "useSessions.deleteBranchError": dict(
    "Could not delete the branch.",
    "Não foi possível excluir a branch.",
  ),
  "useSessions.sessionDeleted": dict(
    "Session deleted successfully.",
    "Sessão excluída com sucesso.",
  ),
  "useSessions.deleteSessionError": dict(
    "Could not delete the session.",
    "Não foi possível excluir a sessão.",
  ),
  "useSessions.deleted.one": dict("Deleted 1 session.", "1 sessão excluída."),
  "useSessions.deleted.many": dict("Deleted {count} sessions.", "{count} sessões excluídas."),
  "useSessions.deleteFailed.one": dict(
    "Could not delete 1 session.",
    "Não foi possível excluir 1 sessão.",
  ),
  "useSessions.deleteFailed.many": dict(
    "Could not delete {count} sessions.",
    "Não foi possível excluir {count} sessões.",
  ),
  "useSessions.deletedPartial.one": dict(
    "Deleted 1 session, {failedCount} failed.",
    "1 sessão excluída, {failedCount} falharam.",
  ),
  "useSessions.deletedPartial.many": dict(
    "Deleted {count} sessions, {failedCount} failed.",
    "{count} sessões excluídas, {failedCount} falharam.",
  ),
  "useSessions.nicknameSaved": dict("Nickname saved.", "Apelido salvo."),
  "useSessions.nicknameRemoved": dict("Nickname removed.", "Apelido removido."),
  "useSessions.branchesSaved": dict("Branches saved.", "Branches salvas."),
  "useSessions.saveBranchesError": dict(
    "Could not save the branches.",
    "Não foi possível salvar as branches.",
  ),
  "useSessions.saveNicknameError": dict(
    "Could not save the nickname.",
    "Não foi possível salvar o apelido.",
  ),
  "useSessions.terminalOpened": dict(
    "Terminal opened. Check your taskbar if it didn't come to the front.",
    "Terminal aberto. Confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.resumeError": dict(
    "Could not resume the session.",
    "Não foi possível retomar a sessão.",
  ),
  "useSessions.stoppedAndResumed": dict(
    "Stopped the other terminal, checked out the branch, and opened a terminal here.",
    "O outro terminal foi parado, foi feito checkout da branch e um terminal foi aberto aqui.",
  ),
  "useSessions.switchSessionsError": dict(
    "Could not switch sessions.",
    "Não foi possível alternar entre as sessões.",
  ),
  "useSessions.openingVSCode": dict("Opening in VS Code…", "Abrindo no VS Code…"),
  "useSessions.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
  ),
  "useSessions.openingCursor": dict("Opening in Cursor…", "Abrindo no Cursor…"),
  "useSessions.openCursorError": dict("Could not open Cursor.", "Não foi possível abrir o Cursor."),
  "useSessions.openingRootVSCode": dict(
    "Opening the project root in VS Code…",
    "Abrindo a pasta raiz do projeto no VS Code…",
  ),
  "useSessions.newTerminalAtRoot": dict(
    "New terminal opened at the project root. Check your taskbar if it didn't come to the front.",
    "Novo terminal aberto na pasta raiz do projeto. Confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.startSessionError": dict(
    "Could not start a session there.",
    "Não foi possível iniciar uma sessão ali.",
  ),
  "useSessions.worktreeCreated": dict(
    "Worktree created. Terminal opened — check your taskbar if it didn't come to the front.",
    "Worktree criado. Terminal aberto — confira a barra de tarefas se ele não veio para frente.",
  ),
  "useSessions.createWorktreeError": dict(
    "Could not create the worktree.",
    "Não foi possível criar o worktree.",
  ),
  "useSessions.deleteWorktreeError": dict(
    "Could not delete the worktree.",
    "Não foi possível excluir o worktree.",
  ),
  "resumeConflictModal.title.selfConflict": dict(
    "This session is already open elsewhere",
    "Esta sessão já está aberta em outro lugar",
  ),
  "resumeConflictModal.title.otherConflict": dict(
    "Another session is active here",
    "Outra sessão está ativa aqui",
  ),
  "resumeConflictModal.intro.selfConflict": dict(
    "This exact session is already open in another terminal. Resuming it again here would start a second Claude process against the same transcript at once.",
    "Esta mesma sessão já está aberta em outro terminal. Retomá-la aqui de novo iniciaria um segundo processo do Claude contra a mesma transcrição ao mesmo tempo.",
  ),
  "resumeConflictModal.intro.otherConflictSuffix": dict(
    "is currently active in this project's folder. Resuming here too would put two Claude processes in the same working tree at once.",
    "está ativa agora nesta pasta do projeto. Retomar aqui também colocaria dois processos do Claude na mesma working tree ao mesmo tempo.",
  ),
  "resumeConflictModal.intro.pickOption": dict(
    "Pick one of the options below instead.",
    "Escolha uma das opções abaixo.",
  ),
  "resumeConflictModal.worktree.title": dict(
    "Create a worktree (recommended)",
    "Criar um worktree (recomendado)",
  ),
  "resumeConflictModal.worktree.bodyPrefix": dict("Starts a fresh", "Inicia uma conversa nova do"),
  "resumeConflictModal.worktree.bodyMiddle": dict(
    "conversation in a separate checkout of this project —",
    "em um checkout separado deste projeto —",
  ),
  "resumeConflictModal.worktree.selfTerminalLabel": dict(
    "the terminal that already has this session open",
    "o terminal que já tem esta sessão aberta",
  ),
  "resumeConflictModal.worktree.otherSessionLabel": dict(
    "the active session above",
    "a sessão ativa acima",
  ),
  "resumeConflictModal.worktree.bodySuffix": dict(
    "keeps running untouched. It won't resume this specific transcript (the CLI can't do that from a different folder), just a new one alongside it.",
    "continua rodando sem ser afetado. Isso não vai retomar esta transcrição específica (a CLI não consegue fazer isso a partir de uma pasta diferente), só inicia uma nova ao lado dela.",
  ),
  "resumeConflictModal.worktree.namePlaceholder": dict(
    "Worktree name, e.g. my-task",
    "Nome do worktree, ex.: minha-tarefa",
  ),
  "resumeConflictModal.worktree.createButton": dict("Create", "Criar"),
  "resumeConflictModal.stop.titleSelf": dict(
    "Stop the other terminal & continue here",
    "Parar o outro terminal e continuar aqui",
  ),
  "resumeConflictModal.stop.titleOther": dict(
    "Stop the other session & continue here",
    "Parar a outra sessão e continuar aqui",
  ),
  "resumeConflictModal.stop.bodySelf": dict(
    "Ends this session's other terminal process",
    "Encerra o outro processo de terminal desta sessão",
  ),
  "resumeConflictModal.stop.bodyOtherPrefix": dict("Ends", "Encerra o processo do terminal de"),
  "resumeConflictModal.stop.bodyOtherSuffix": dict("'s terminal process", ""),
  "resumeConflictModal.stop.bodyCommon": dict(
    ", checks out the branch below in this shared folder, then resumes this session there. Anything that terminal hadn't saved or committed yet can be lost — only do this if you're sure it's safe to interrupt.",
    ", faz checkout da branch abaixo nessa pasta compartilhada e então retoma esta sessão ali. Qualquer coisa que aquele terminal ainda não tivesse salvo ou commitado pode ser perdida — só faça isso se tiver certeza de que é seguro interromper.",
  ),
  "resumeConflictModal.stop.branchPlaceholder": dict(
    "Branch to check out",
    "Branch para fazer checkout",
  ),
  "resumeConflictModal.stop.confirmButton": dict("Stop & continue", "Parar e continuar"),
  "resumeConflictModal.cancel": dict("Cancel", "Cancelar"),
};
