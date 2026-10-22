import { dict } from "../dict";

export const preview = {
  "preview.open": dict("Open {name}'s local URL", "Abrir a URL local de {name}"),
  "preview.stop": dict(
    "Stop this worktree preview ({name}) and free its memory",
    "Parar este preview do worktree ({name}) e liberar a memória",
  ),
  "preview.stopConfirmTitle": dict("Stop the preview?", "Parar o preview?"),
  "preview.stopConfirmMessage": dict(
    "{name} ({url}) will be stopped to free its memory. It stays on the card and can be started again.",
    "{name} ({url}) vai ser parado pra liberar a memória. Ele continua no card e dá pra religar.",
  ),
  "preview.stopConfirm": dict("Stop preview", "Parar preview"),
  "preview.stopped": dict("{name} stopped.", "{name} parado."),
  "preview.stopError": dict("Couldn't stop the preview.", "Não foi possível parar o preview."),
  "preview.stoppedState": dict("{name} is stopped ({url})", "{name} está parado ({url})"),
  "preview.remove": dict("Remove {name}'s container", "Remover o container de {name}"),
  "preview.removeConfirmTitle": dict("Remove the preview?", "Remover o preview?"),
  "preview.removeConfirmMessage": dict(
    "{name} ({url}) will be removed and leaves the card; starting it again takes the session (run-local). Previews are removed by themselves when the task is marked done.",
    "{name} ({url}) vai ser removido e sai do card; subir de novo fica com a sessão (run-local). Os previews são removidos sozinhos quando a tarefa é marcada como concluída.",
  ),
  "preview.removeConfirm": dict("Remove", "Remover"),
  "preview.removed": dict("{name} removed.", "{name} removido."),
  "preview.removeError": dict(
    "Couldn't remove the preview.",
    "Não foi possível remover o preview.",
  ),
  "preview.start": dict("Start {name} again", "Religar {name}"),
  "preview.started": dict(
    "{name} started — the first page load compiles for a few minutes.",
    "{name} religado — a primeira abertura compila por alguns minutos.",
  ),
  "preview.startError": dict("Couldn't start the preview.", "Não foi possível religar o preview."),
};
