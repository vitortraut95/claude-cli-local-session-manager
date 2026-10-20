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
  "workStatus.saved": dict("Status saved.", "Status salvo."),
  "workStatus.saveError": dict("Couldn't save the status.", "Não foi possível salvar o status."),
  "workStatusFilter.ariaLabel": dict("Filter by status", "Filtrar por status"),
  "workStatusFilter.all": dict("All statuses", "Todos os status"),
  "workStatusFilter.open": dict("Not done (to resume)", "Não concluídas (pra retomar)"),
};
