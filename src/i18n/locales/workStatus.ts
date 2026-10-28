import { dict } from "../dict";

export const workStatus = {
  "workStatus.todo": dict("To do", "A fazer"),
  "workStatus.inProgress": dict("In progress", "Em andamento"),
  "workStatus.waitingUser": dict("Waiting user", "Aguardando usuário"),
  "workStatus.done": dict("Done", "Concluída"),
  "workStatus.none": dict("No status", "Sem status"),
  "workStatus.ariaLabel": dict("Work status", "Status da tarefa"),
  "workStatus.taskTooltip": dict(
    "Status of {key} — shared by every session of the task",
    "Status da {key} — vale para todas as sessões da tarefa",
  ),
  "workStatus.sessionTooltip": dict(
    "Status of this session (it has no task)",
    "Status desta sessão (ela não tem tarefa)",
  ),
  "workStatus.testTooltip": dict(
    "Test of {key}: in progress, waiting (on a fix or a decision; the test worktrees stay for the re-test) or done. Once done and closed, its test worktrees are deleted (the session can still be resumed).",
    "Teste da {key}: em andamento, aguardando (ajuste ou decisão de alguém; os worktrees de teste ficam pro reteste) ou concluído. Concluído e fechado, os worktrees de teste são apagados (a sessão continua podendo ser retomada).",
  ),
  "workStatus.testChip": dict("Test", "Teste"),
  "workStatus.saved": dict("Status saved.", "Status salvo."),
  "workStatus.saveError": dict("Couldn't save the status.", "Não foi possível salvar o status."),
  "sessionCard.doneWorktree.title": dict(
    "Task done — remove its worktree?",
    "Tarefa concluída — remover o worktree?",
  ),
  "sessionCard.doneWorktree.message": dict(
    'Every commit of "{branch}" is on origin and the worktree has no pending changes. Only the worktree folder is removed — the branch stays, locally and on origin, until it\'s merged.',
    'Todos os commits de "{branch}" estão no origin e o worktree não tem alterações pendentes. Só a pasta do worktree é removida — a branch fica, local e no origin, até ser mergeada.',
  ),
  "sessionCard.doneWorktree.mergedMessage": dict(
    '"{branch}" is already merged into the default branch: the worktree and the local branch are removed (the remote branch isn\'t touched).',
    '"{branch}" já está mergeada na branch padrão: o worktree e a branch local são removidos (a branch remota não é mexida).',
  ),
  "sessionCard.doneWorktree.confirm": dict("Remove worktree", "Remover worktree"),
  "sessionCard.doneWorktree.keep": dict("Keep it", "Manter"),
  "sessionCard.doneWorktree.removed": dict("Worktree removed.", "Worktree removido."),
  "sessionCard.doneWorktree.keptNotPushed": dict(
    "Worktree kept: the branch has commits that aren't on origin yet — push them, then use Cleanup.",
    "Worktree mantido: a branch tem commits que ainda não estão no origin — dê push e depois use a Limpeza.",
  ),
  "sessionCard.doneWorktree.keptDirty": dict(
    "Worktree kept: it has uncommitted changes.",
    "Worktree mantido: ele tem alterações não commitadas.",
  ),
  "sessionCard.doneWorktree.keptActive": dict(
    "Worktree kept: its session is still open — close it, then use Cleanup to remove the worktree.",
    "Worktree mantido: a sessão dele ainda está aberta — feche e use a Limpeza pra remover o worktree.",
  ),
  "sessionsPage.resumeOpen.tooltip": dict(
    'Resumes the latest session of every task "In progress" or "Waiting user" that has nothing running — in the grid when that\'s where sessions open — up to the session limit. Tasks never started ("To do") aren\'t resumed.',
    'Retoma a sessão mais recente de cada tarefa "Em andamento" ou "Aguardando usuário" que não tem nada rodando — na grade, se é lá que as sessões abrem — até o limite de sessões. Tarefas que nunca começaram ("A fazer") não são retomadas.',
  ),
  "useSessions.resumeOpen.done": dict(
    "{count} session(s) resumed.",
    "{count} sessão(ões) retomada(s).",
  ),
  "useSessions.resumeOpen.limit": dict(
    "{count} left out: the session limit was reached — close one and click again.",
    "{count} ficaram de fora: limite de sessões atingido — feche uma e clique de novo.",
  ),
  "useSessions.resumeOpen.failed": dict(
    "{count} couldn't be resumed: {message}",
    "{count} não puderam ser retomadas: {message}",
  ),
  "useSessions.shownInGrid": dict(
    "Already running — shown in the grid.",
    "Já está rodando — mostrada na grade.",
  ),
  "useSessions.resumeOpen.none": dict("Nothing to resume.", "Nada pra retomar."),
  "workStatusFilter.ariaLabel": dict("Filter by status", "Filtrar por status"),
  "workStatusFilter.all": dict("All statuses", "Todos os status"),
  "workStatusFilter.open": dict("Not done (to resume)", "Não concluídas (pra retomar)"),
};
