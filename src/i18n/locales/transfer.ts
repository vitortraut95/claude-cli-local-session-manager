import { dict } from "../dict";

export const transfer = {
  "exportSessionModal.title": dict("Export session", "Exportar sessão"),
  "exportSessionModal.intro": dict(
    'Downloads this session as a single .claude-session.json.gz file. Send it to another dev (Teams, Slack, e-mail…) and they can import it with "Import session" in their own Claude Session Manager.',
    'Baixa esta sessão como um único arquivo .claude-session.json.gz. Envie para outro dev (Teams, Slack, e-mail…) e ele pode importar com "Importar sessão" no próprio Claude Session Manager.',
  ),
  "exportSessionModal.sensitiveWarning": dict(
    "The file holds the whole conversation, including the contents of every file Claude read and every command output it saw. Make sure it doesn't contain passwords, tokens or other secrets before sending it — you can review it with: zcat <file> | less",
    "O arquivo contém a conversa inteira, incluindo o conteúdo de todo arquivo que o Claude leu e toda saída de comando que ele viu. Confira se não há senhas, tokens ou outros segredos antes de enviar — dá pra revisar com: zcat <arquivo> | less",
  ),
  "exportSessionModal.recipientHint": dict(
    "Whoever imports it needs a clone of the same repository; the app finds it by the origin URL and rewrites the paths to theirs.",
    "Quem importar precisa ter um clone do mesmo repositório; o app encontra pelo URL do origin e reescreve os caminhos para os dele.",
  ),
  "exportSessionModal.confirm": dict("Download file", "Baixar arquivo"),
  "exportSessionModal.cancel": dict("Cancel", "Cancelar"),
  "exportSessionModal.success": dict("Session exported.", "Sessão exportada."),
  "exportSessionModal.error": dict(
    "Could not export the session.",
    "Não foi possível exportar a sessão.",
  ),
  "importSessionModal.title": dict("Import session", "Importar sessão"),
  "importSessionModal.intro": dict(
    "Pick a .claude-session.json.gz file exported from another machine. Nothing is written until you confirm.",
    "Escolha um arquivo .claude-session.json.gz exportado de outra máquina. Nada é gravado até você confirmar.",
  ),
  "importSessionModal.chooseFile": dict("Choose file…", "Escolher arquivo…"),
  "importSessionModal.chooseAnother": dict("Choose another file…", "Escolher outro arquivo…"),
  "importSessionModal.inspectError": dict(
    "Could not read this file.",
    "Não foi possível ler este arquivo.",
  ),
  "importSessionModal.importError": dict(
    "Could not import the session.",
    "Não foi possível importar a sessão.",
  ),
  "importSessionModal.success": dict("Session imported.", "Sessão importada."),
  "importSessionModal.successCopy": dict(
    "Session imported as a copy (it already existed here).",
    "Sessão importada como cópia (ela já existia aqui).",
  ),
  "importSessionModal.confirm": dict("Import", "Importar"),
  "importSessionModal.confirmOverwrite": dict("Overwrite and import", "Sobrescrever e importar"),
  "importSessionModal.successOverwrite": dict(
    "Session imported, replacing the local copy.",
    "Sessão importada, substituindo a cópia local.",
  ),
  "importSessionModal.cancel": dict("Cancel", "Cancelar"),
  "importSessionModal.field.title": dict("Title", "Título"),
  "importSessionModal.field.nickname": dict("Nickname", "Apelido"),
  "importSessionModal.field.branch": dict("Branch", "Branch"),
  "importSessionModal.field.remote": dict("Repository", "Repositório"),
  "importSessionModal.field.originalFolder": dict("Original folder", "Pasta original"),
  "importSessionModal.field.lastActivity": dict("Last activity", "Última atividade"),
  "importSessionModal.field.size": dict("Size", "Tamanho"),
  "importSessionModal.subagents": dict("{count} subagent(s)", "{count} subagente(s)"),
  "importSessionModal.conflict.title": dict(
    "This session already exists on this machine. Choose what to do:",
    "Esta sessão já existe nesta máquina. Escolha o que fazer:",
  ),
  "importSessionModal.conflict.local": dict("Here now", "Aqui agora"),
  "importSessionModal.conflict.incoming": dict("In the file", "No arquivo"),
  "importSessionModal.conflict.incomingNewer": dict(
    "The file is newer.",
    "O arquivo é mais recente.",
  ),
  "importSessionModal.conflict.incomingOlder": dict(
    "The file is older than the local copy.",
    "O arquivo é mais antigo que a cópia local.",
  ),
  "importSessionModal.conflict.incomingSame": dict(
    "Same version as the local copy.",
    "Mesma versão da cópia local.",
  ),
  "importSessionModal.conflict.copy.title": dict(
    "Import as a copy (new id)",
    "Importar como cópia (novo id)",
  ),
  "importSessionModal.conflict.copy.body": dict(
    "Both stay: the local session is untouched and the imported one gets a new id.",
    "As duas ficam: a sessão local não é alterada e a importada ganha um novo id.",
  ),
  "importSessionModal.conflict.overwrite.title": dict(
    "Overwrite the local session",
    "Sobrescrever a sessão local",
  ),
  "importSessionModal.conflict.overwrite.body": dict(
    "Replaces the local conversation (and its subagents) with the file's, keeping the same id. The local version is lost.",
    "Substitui a conversa local (e seus subagentes) pela do arquivo, mantendo o mesmo id. A versão local é perdida.",
  ),
  "importSessionModal.conflict.overwrite.blockedActive": dict(
    "Unavailable — the local session is active in a terminal. Close it first, or import a copy.",
    "Indisponível — a sessão local está ativa num terminal. Feche-a antes, ou importe uma cópia.",
  ),
  "importSessionModal.targetLabel": dict(
    "Import into this local clone",
    "Importar neste clone local",
  ),
  "importSessionModal.sameRepoOption": dict(
    "{path} (same repository)",
    "{path} (mesmo repositório)",
  ),
  "importSessionModal.otherFolderOption": dict("Other folder…", "Outra pasta…"),
  "importSessionModal.otherFolderPlaceholder": dict(
    "/absolute/path/to/your/clone",
    "/caminho/absoluto/do/seu/clone",
  ),
  "importSessionModal.subfolderHint": dict(
    "The session ran in a subfolder — it will be resumed from:",
    "A sessão rodou numa subpasta — ela será retomada a partir de:",
  ),
  "importSessionModal.remoteMismatch": dict(
    "This folder's origin doesn't match the exported session's repository — Claude may refer to files that don't exist here.",
    "O origin desta pasta não bate com o repositório da sessão exportada — o Claude pode citar arquivos que não existem aqui.",
  ),
  "importSessionModal.commitMissing": dict(
    "Commit {commit} (where the session left off) isn't in this clone yet — run git fetch, or the branch may not have been pushed.",
    "O commit {commit} (onde a sessão parou) ainda não está neste clone — rode git fetch, ou a branch pode não ter sido enviada (push).",
  ),
  "importSessionModal.checkoutLabel": dict(
    "Check out {branch} before importing",
    "Fazer checkout de {branch} antes de importar",
  ),
  "importSessionModal.checkoutHint": dict(
    "Fetched from origin if you don't have it locally. Uncommitted changes that would be overwritten block the checkout.",
    "Busca no origin se você não tiver localmente. Alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
  ),
  "importSessionModal.checkoutHintWithCurrent": dict(
    "This folder is on {current} now. Fetched from origin if you don't have it locally; uncommitted changes that would be overwritten block the checkout.",
    "Esta pasta está em {current} agora. Busca no origin se você não tiver localmente; alterações não commitadas que seriam sobrescritas bloqueiam o checkout.",
  ),
  "importSessionModal.checkoutBlocked": dict(
    "Unavailable — another Claude session is active in this folder.",
    "Indisponível — outra sessão do Claude está ativa nesta pasta.",
  ),
  "importSessionModal.alreadyOnBranch": dict(
    "This folder is already on {branch}.",
    "Esta pasta já está em {branch}.",
  ),
};
