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
  "cleanupModal.finding.doneTask.label": dict(
    "Worktree of a done task",
    "Worktree de tarefa concluída",
  ),
  "cleanupModal.finding.doneTask.body": dict(
    '(status "Done" on its card) not merged yet, with no pending changes, no active session and every commit already pushed to origin — only the worktree is removed; the branch stays, locally and on origin, until it\'s merged.',
    '(status "Concluída" no card) ainda não mergeada, sem mudanças pendentes, sem sessão ativa e com todos os commits já no origin — só o worktree é removido; a branch fica, local e no origin, até ser mergeada.',
  ),
  "cleanupModal.finding.done.title": dict(
    'Done task worktree "{branch}" in "{project}"',
    'Worktree da tarefa concluída "{branch}" em "{project}"',
  ),
  "cleanupModal.finding.done.description": dict(
    'The task is marked done, the worktree has no pending changes or active session, and every commit of "{branch}" is on origin. Only the worktree is removed — the branch stays until it\'s merged.',
    'A tarefa está marcada como concluída, o worktree não tem alterações pendentes nem sessão ativa, e todos os commits de "{branch}" estão no origin. Só o worktree é removido — a branch fica até ser mergeada.',
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
};
