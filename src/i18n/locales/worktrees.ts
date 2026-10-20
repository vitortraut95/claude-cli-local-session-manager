import { dict } from "../dict";

export const worktrees = {
  "cleanupModal.title": dict("Cleanup", "Limpeza"),
  "cleanupModal.close": dict("Close", "Fechar"),
  "cleanupModal.howItWorks.label": dict("How it works:", "Como funciona:"),
  "cleanupModal.howItWorks.body": dict(
    "locally checks the worktrees of every project known to the app for these situations:",
    "verifica localmente os worktrees de todos os projetos conhecidos pelo app para estas situações:",
  ),
  "cleanupModal.finding.manualDelete.label": dict(
    "Worktree deleted manually",
    "Worktree excluído manualmente",
  ),
  "cleanupModal.finding.manualDelete.body": dict(
    "(folder removed directly on disk, outside the app) — git still keeps its record of it; the fix only cleans up that record, without deleting anything.",
    "(pasta removida direto no disco, fora do app) — o git ainda mantém o registro dele; a correção só limpa esse registro, sem deletar nada.",
  ),
  "cleanupModal.finding.mergedBranch.label": dict(
    "Worktree with an already-merged branch",
    "Worktree com uma branch já mergeada",
  ),
  "cleanupModal.finding.mergedBranch.body": dict(
    "into the repository's default branch, with no active session or pending changes — can be safely removed (worktree and local branch together).",
    "na branch padrão do repositório, sem sessão ativa ou mudanças pendentes — pode ser removido com segurança (worktree e branch local juntos).",
  ),
  "cleanupModal.finding.abandonedWorktree.label": dict("Abandoned worktree", "Worktree abandonado"),
  "cleanupModal.finding.abandonedWorktree.body": dict(
    '(created by Claude/"New task" under .claude/worktrees/ but never used by any session) with no pending changes and no commit of its own — removing it loses nothing.',
    '(criado pelo Claude/"Nova tarefa" em .claude/worktrees/ mas nunca usado por nenhuma sessão) sem mudanças pendentes e sem nenhum commit próprio — removê-lo não perde nada.',
  ),
  "cleanupModal.finding.oldSessions.label": dict("Old local sessions", "Sessões locais antigas"),
  "cleanupModal.finding.oldSessions.body": dict(
    "once a project has more sessions than the configured limit (10 by default — edit " +
      '"keepRecentSessionsPerProject" in userPreferences.json to change it), the oldest ones ' +
      "can be deleted to free disk space and speed up the session list. The active session is never " +
      "suggested.",
    "quando um projeto tem mais sessões do que o limite configurado (10 por padrão — edite " +
      '"keepRecentSessionsPerProject" no userPreferences.json para mudar isso), as mais antigas ' +
      "podem ser excluídas para liberar espaço em disco e acelerar a listagem de sessões. A " +
      "sessão ativa nunca é sugerida.",
  ),
  "cleanupModal.finding.oldSessions.title": dict(
    '{count} old session(s) in "{project}"',
    '{count} sessão(ões) antiga(s) em "{project}"',
  ),
  "cleanupModal.finding.oldSessions.description": dict(
    "Keeping the {keep} most recently updated session(s) in this project. These {count} older " +
      "session(s) can be deleted, freeing about {freed}.",
    "Mantendo a(s) {keep} sessão(ões) mais recente(s) deste projeto. Estas {count} sessão(ões) " +
      "mais antiga(s) podem ser excluídas, liberando cerca de {freed}.",
  ),
  "cleanupModal.finding.oldSessions.warning": dict(
    "This permanently deletes the session transcript(s) listed below. This cannot be undone.",
    "Isso exclui permanentemente a(s) transcrição(ões) de sessão listada(s) abaixo. Isso não pode ser desfeito.",
  ),
  "cleanupModal.finding.prune.title": dict(
    'Worktrees deleted manually in "{project}"',
    'Worktrees excluídos manualmente em "{project}"',
  ),
  "cleanupModal.finding.prune.description": dict(
    "{count} worktree(s) ({branches}) were deleted directly on disk, outside the app — git still keeps their record. This only cleans up that internal record, without deleting anything.",
    "{count} worktree(s) ({branches}) foram excluídos direto no disco, fora do app — o git ainda mantém o registro deles. Isso só limpa esse registro interno, sem deletar nada.",
  ),
  "cleanupModal.finding.merged.title": dict(
    'Worktree "{branch}" already merged',
    'Worktree "{branch}" já mergeada',
  ),
  "cleanupModal.finding.merged.description": dict(
    'Branch "{branch}" is already merged into "{defaultBranch}" and the worktree has no active session or pending changes. The worktree and local branch can be safely removed.',
    'A branch "{branch}" já está mergeada em "{defaultBranch}" e o worktree não tem sessão ativa nem alterações pendentes. O worktree e a branch local podem ser removidos com segurança.',
  ),
  "cleanupModal.finding.abandoned.title": dict(
    'Abandoned worktree "{branch}" in "{project}"',
    'Worktree abandonado "{branch}" em "{project}"',
  ),
  "cleanupModal.finding.abandoned.description": dict(
    'No session ever ran in this worktree, it has no pending changes, and branch "{branch}" has no commit that isn\'t on another branch, remote or tag. The worktree and local branch can be safely removed.',
    'Nenhuma sessão rodou neste worktree, ele não tem alterações pendentes e a branch "{branch}" não tem nenhum commit que já não esteja em outra branch, no remoto ou numa tag. O worktree e a branch local podem ser removidos com segurança.',
  ),
  "cleanupModal.loading": dict("Loading...", "Carregando..."),
  "cleanupModal.loadError": dict(
    "Could not fetch cleanup items.",
    "Não foi possível buscar os itens de limpeza.",
  ),
  "cleanupModal.empty": dict("Nothing found to clean up.", "Nada encontrado para limpar."),
  "cleanupModal.run": dict("Run", "Executar"),
  "cleanupModal.resolved": dict("Item resolved successfully.", "Item resolvido com sucesso."),
  "cleanupModal.runError": dict(
    "Could not run this cleanup.",
    "Não foi possível executar essa limpeza.",
  ),
  "worktreeToRootModal.title": dict("Worktree → root", "Worktree → raiz"),
  "worktreeToRootModal.cancel": dict("Cancel", "Cancelar"),
  "worktreeToRootModal.back": dict("Back", "Voltar"),
  "worktreeToRootModal.keepCard": dict("Keep the card", "Manter o card"),
  "worktreeToRootModal.confirmContinue": dict("Continue", "Continuar"),
  "worktreeToRootModal.confirmYesDoIt": dict("Yes, do it", "Sim, pode fazer"),
  "worktreeToRootModal.confirmDeleteSession": dict("Delete this session", "Excluir esta sessão"),
  "worktreeToRootModal.steps.resetRoot": dict(
    "Discard uncommitted changes in the root folder",
    "Descartar alterações não commitadas na pasta raiz",
  ),
  "worktreeToRootModal.steps.copy": dict(
    "Copy the worktree's files into the root folder",
    "Copiar os arquivos do worktree para a pasta raiz",
  ),
  "worktreeToRootModal.steps.removeAndCheckout": dict(
    "Remove the worktree and check out its branch in the root folder",
    "Remover o worktree e fazer checkout da branch dele na pasta raiz",
  ),
  "worktreeToRootModal.fileListBox.none": dict("None", "Nenhum"),
  "worktreeToRootModal.choice.intro": dict(
    "Both options start by discarding any uncommitted changes currently in the root folder — pick which one, then you'll see exactly what will happen before confirming anything.",
    "As duas opções começam descartando qualquer alteração não commitada que exista agora na pasta raiz — escolha uma, e você vai ver exatamente o que vai acontecer antes de confirmar qualquer coisa.",
  ),
  "worktreeToRootModal.choice.copyTitle": dict("Copy files only", "Copiar apenas os arquivos"),
  "worktreeToRootModal.choice.copyBody": dict(
    "Copies the worktree's current files into the root folder. The worktree is left exactly as it is — nothing there is deleted or checked out. Root's branch doesn't change either; it just ends up with the worktree's files as uncommitted changes. No commits, no history — meant as a disposable preview you'll likely discard afterward.",
    "Copia os arquivos atuais do worktree para a pasta raiz. O worktree fica exatamente como está — nada nele é excluído ou passa por checkout. A branch da raiz também não muda; ela só acaba com os arquivos do worktree como alterações não commitadas. Sem commits, sem histórico — pensado como um preview descartável que você provavelmente vai jogar fora depois.",
  ),
  "worktreeToRootModal.choice.checkoutTitle": dict(
    "Remove worktree & checkout branch",
    "Remover worktree e fazer checkout da branch",
  ),
  "worktreeToRootModal.choice.checkoutBody": dict(
    "Deletes the worktree's folder and checks its branch out directly in the root folder instead — a real git checkout with full history preserved. The branch itself is never deleted. This session's transcript can no longer be resumed afterward, since it's tied to the worktree folder that just got removed.",
    "Exclui a pasta do worktree e faz checkout da branch dele direto na pasta raiz — um checkout de git real, com todo o histórico preservado. A branch em si nunca é excluída. A transcrição desta sessão não pode mais ser retomada depois, já que está vinculada à pasta do worktree que acabou de ser removida.",
  ),
  "worktreeToRootModal.preview.loading": dict(
    "Reading the worktree and root folder…",
    "Lendo o worktree e a pasta raiz…",
  ),
  "worktreeToRootModal.preview.errorFallback": dict(
    "Could not read the worktree/root folders.",
    "Não foi possível ler as pastas do worktree/raiz.",
  ),
  "worktreeToRootModal.preview.rootFolderLabel": dict("Root folder", "A pasta raiz"),
  "worktreeToRootModal.preview.currentlyOnBranch": dict(
    "is currently on branch",
    "está atualmente na branch",
  ),
  "worktreeToRootModal.preview.detachedHead": dict("(detached HEAD)", "(HEAD destacado)"),
  "worktreeToRootModal.preview.switchToPrefix": dict(
    "It will be switched to",
    "Ela vai ser trocada para",
  ),
  "worktreeToRootModal.preview.switchToSuffix": dict(
    "— the worktree's own branch.",
    "— a própria branch do worktree.",
  ),
  "worktreeToRootModal.preview.unknownBranch": dict("(unknown)", "(desconhecida)"),
  "worktreeToRootModal.preview.dirtyFilesNoneTitle": dict(
    "Uncommitted files in root (none — nothing will be lost there)",
    "Arquivos não commitados na raiz (nenhum — nada será perdido ali)",
  ),
  "worktreeToRootModal.preview.dirtyFilesTitle": dict(
    "Uncommitted files in root that will be discarded",
    "Arquivos não commitados na raiz que serão descartados",
  ),
  "worktreeToRootModal.preview.openInVSCode": dict(
    "Open the root folder in VS Code",
    "Abrir a pasta raiz no VS Code",
  ),
  "worktreeToRootModal.preview.addedTitle": dict("Added to root", "Adicionados à raiz"),
  "worktreeToRootModal.preview.modifiedTitle": dict("Modified in root", "Modificados na raiz"),
  "worktreeToRootModal.preview.removedTitle": dict("Removed from root", "Removidos da raiz"),
  "worktreeToRootModal.preview.checkoutWarning": dict(
    "The worktree's folder will be deleted (its branch and commits are kept). This session's transcript is tied to that exact folder, so it won't be resumable from this app afterward — the code itself isn't lost, it's just in the root folder now.",
    "A pasta do worktree será excluída (a branch e os commits dele são mantidos). A transcrição desta sessão está vinculada exatamente a essa pasta, então ela não poderá ser retomada a partir deste app depois — o código em si não é perdido, só que fica na pasta raiz agora.",
  ),
  "worktreeToRootModal.preview.rootLockedCopy": dict(
    'The root is in use by {owner} (files copied from {branch}) — finish testing it and use "Reset root" before bringing another task there.',
    'A raiz está em uso pela {owner} (arquivos copiados de {branch}) — termine o teste dela e use "Resetar raiz" antes de trazer outra tarefa.',
  ),
  "worktreeToRootModal.preview.rootLockedCheckout": dict(
    "The root is in use by {owner} (branch {branch} checked out there) — switch the root back to another branch before bringing another task there.",
    "A raiz está em uso pela {owner} (branch {branch} em checkout lá) — volte a raiz pra outra branch antes de trazer outra tarefa.",
  ),
  "worktreeToRootModal.preview.rootActiveWarning": dict(
    "A session is currently active in the root folder — close its terminal before continuing.",
    "Uma sessão está ativa agora na pasta raiz — encerre o terminal dela antes de continuar.",
  ),
  "worktreeToRootModal.preview.worktreeActiveWarning": dict(
    "A session is still active in this worktree — close its terminal before removing it.",
    "Uma sessão ainda está ativa neste worktree — encerre o terminal dela antes de removê-lo.",
  ),
  "worktreeToRootModal.confirm.stashIntro": dict(
    "Root's current uncommitted changes will be stashed first (recoverable afterward via",
    "As alterações não commitadas atuais da raiz serão colocadas no stash primeiro (recuperáveis depois via",
  ),
  "worktreeToRootModal.confirm.stashIntroSuffix": dict(
    "), then cleared from the working tree.",
    "), e então removidas da working tree.",
  ),
  "worktreeToRootModal.confirm.checkoutWarning": dict(
    "After that, the worktree's folder will be permanently deleted (its branch and commits are kept) and root will switch to that branch.",
    "Depois disso, a pasta do worktree será excluída permanentemente (a branch e os commits dele são mantidos) e a raiz vai mudar para essa branch.",
  ),
  "worktreeToRootModal.confirm.copyWarning": dict(
    "The worktree itself is never touched by any of this.",
    "O worktree em si nunca é afetado por nada disso.",
  ),
  "worktreeToRootModal.confirm.doubleChecking": dict(
    "Double-checking the root folder hasn't changed since you opened this…",
    "Verificando de novo se a pasta raiz não mudou desde que você abriu isso…",
  ),
  "worktreeToRootModal.confirm.dirtyNoneTitle": dict(
    "Uncommitted files in root right now (none)",
    "Arquivos não commitados na raiz agora (nenhum)",
  ),
  "worktreeToRootModal.confirm.dirtyTitle": dict(
    "Uncommitted files in root right now — about to be stashed",
    "Arquivos não commitados na raiz agora — serão colocados no stash",
  ),
  "worktreeToRootModal.done.message": dict(
    "Done — the root folder is now on the worktree's branch, with full history preserved.",
    "Concluído — a pasta raiz agora está na branch do worktree, com todo o histórico preservado.",
  ),
  "worktreeToRootModal.done.explanation": dict(
    "This session's transcript was tied to the worktree folder that just got removed, so it can't be resumed from this app anymore — the code itself is safe, it's just in the root folder now. Delete this now-dead card, or keep it around as a record.",
    "A transcrição desta sessão estava vinculada à pasta do worktree que acabou de ser removida, então ela não pode mais ser retomada a partir deste app — o código em si está seguro, só que agora está na pasta raiz. Exclua este card agora inativo, ou mantenha-o como registro.",
  ),
  "worktreeToRootModal.toast.openingVSCode": dict(
    "Opening the root folder in VS Code…",
    "Abrindo a pasta raiz no VS Code…",
  ),
  "worktreeToRootModal.toast.openVSCodeError": dict(
    "Could not open VS Code.",
    "Não foi possível abrir o VS Code.",
  ),
  "worktreeToRootModal.toast.stashNote": dict(
    'Root\'s previous state is saved — recover it with "git stash apply {stashRef}".',
    'O estado anterior da raiz foi salvo — recupere com "git stash apply {stashRef}".',
  ),
  "worktreeToRootModal.toast.copySuccess": dict(
    "Copied the worktree's files into the root folder.",
    "Arquivos do worktree copiados para a pasta raiz.",
  ),
  "worktreeToRootModal.toast.checkoutSuccessWithPrevious": dict(
    'Worktree removed — root switched from "{previousBranch}" to "{newBranch}".',
    'Worktree removido — a raiz mudou de "{previousBranch}" para "{newBranch}".',
  ),
  "worktreeToRootModal.toast.checkoutSuccessNoPrevious": dict(
    'Worktree removed — root switched to "{newBranch}".',
    'Worktree removido — a raiz mudou para "{newBranch}".',
  ),
  "worktreeToRootModal.toast.unexpectedFailure": dict("Unexpected failure.", "Falha inesperada."),
  "worktreeToRootModal.toast.failedPrefix": dict("Failed: {message}", "Falhou: {message}"),
  "worktreeToRootModal.stashList.title": dict(
    "Previous resets, still recoverable:",
    "Resets anteriores, ainda recuperáveis:",
  ),
  "worktreeToRootModal.stashList.copyTooltip": dict(
    'Copy "git stash apply" for this one',
    'Copiar "git stash apply" para este',
  ),
  "worktreeToRootModal.stashList.copiedTooltip": dict("Copied!", "Copiado!"),
  "worktreeToRootModal.stashList.copyError": dict(
    "Could not copy to clipboard.",
    "Não foi possível copiar.",
  ),
  "resetRootConfirmModal.title": dict("Reset root", "Resetar raiz"),
  "resetRootConfirmModal.confirmLabel": dict("Reset root", "Resetar raiz"),
  "resetRootConfirmModal.cancel": dict("Cancel", "Cancelar"),
  "resetRootConfirmModal.warningIntro": dict(
    "Stashes (recoverable via",
    "Coloca no stash (recuperável via",
  ),
  "resetRootConfirmModal.warningMiddle": dict(
    ") then clears every uncommitted change in the root folder. The branch it's on doesn't change, and nothing gitignored (like",
    ") e então limpa todas as alterações não commitadas na pasta raiz. A branch em que ela está não muda, e nada ignorado pelo git (como",
  ),
  "resetRootConfirmModal.warningEnd": dict(") is touched.", ") é tocado."),
  "resetRootConfirmModal.loading": dict("Reading the root folder…", "Lendo a pasta raiz…"),
  "resetRootConfirmModal.statusErrorFallback": dict(
    "Could not read the root folder's status.",
    "Não foi possível ler o status da pasta raiz.",
  ),
  "resetRootConfirmModal.branchPrefix": dict(
    "Root folder is on branch",
    "A pasta raiz está na branch",
  ),
  "resetRootConfirmModal.detachedHead": dict("(detached HEAD)", "(HEAD destacado)"),
  "resetRootConfirmModal.dirtyNoneTitle": dict(
    "Uncommitted files right now (none)",
    "Arquivos não commitados agora (nenhum)",
  ),
  "resetRootConfirmModal.dirtyTitle": dict(
    "Uncommitted files right now — about to be stashed",
    "Arquivos não commitados agora — serão colocados no stash",
  ),
  "resetRootConfirmModal.toast.resetWithStash": dict(
    'Root folder reset. Previous changes saved — recover with "git stash apply {stashRef}".',
    'Pasta raiz resetada. As alterações anteriores foram salvas — recupere com "git stash apply {stashRef}".',
  ),
  "resetRootConfirmModal.toast.resetClean": dict(
    "Root folder was already clean — nothing to reset.",
    "A pasta raiz já estava limpa — nada para resetar.",
  ),
  "resetRootConfirmModal.toast.resetErrorFallback": dict(
    "Could not reset the root folder.",
    "Não foi possível resetar a pasta raiz.",
  ),
};
