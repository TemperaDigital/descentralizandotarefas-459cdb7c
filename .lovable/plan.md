## Objetivo

1. Cada tarefa recebe um **número classificador automático** por usuário, exibido no card.
2. No card, adicionar botão **"Nota"** que cria/abre uma anotação vinculada à tarefa.
3. Anexos passam a ter ícone de **olho** para visualizar imagem/documento em nova aba.
4. No formulário, mostrar aviso do **tamanho máximo (10 MB)** por arquivo.

Nada além disso é alterado — sem refatoração.

---

## Banco de dados (uma migração)

- `public.tasks`: adicionar coluna `numero bigint`.
  - Sequência por usuário via função + trigger `BEFORE INSERT`: `SELECT COALESCE(MAX(numero),0)+1 FROM tasks WHERE user_id = NEW.user_id` (com `advisory lock` por `user_id` para evitar corrida). Preenche automaticamente se `NEW.numero IS NULL`.
  - Backfill das tarefas existentes por usuário, ordenando por `created_at`.
  - Índice único `(user_id, numero)`.
- `public.notes`: adicionar `task_id uuid` (nullable) com FK `REFERENCES public.tasks(id) ON DELETE SET NULL` e índice.
- RLS/policies existentes já cobrem `user_id`; nada a mudar.

## Frontend

### `src/components/TaskCard.tsx`
- Exibir `#{task.numero}` como badge/rótulo pequeno ao lado do título.
- Adicionar botão **"Nota"** (ícone `StickyNote` do lucide) entre Editar e Avisar. Clique navega para `/anotacoes?taskId=<id>&titulo=<titulo>`.

### `src/routes/_authenticated/anotacoes.tsx`
- Ler `taskId` e `titulo` de `useSearch`.
- Se `taskId` presente e ainda não houver nota selecionada para essa tarefa:
  - buscar `notes` com `task_id = taskId`; se existir, selecionar a mais recente; senão, criar uma nova nota já com `task_id` preenchido e `title` = "Nota — {titulo da tarefa}".
- Renderizar um chip "Vinculada à tarefa #{numero} — {titulo}" no topo do editor da nota, com link para `/cadastro/{taskId}`.

### `src/components/TaskForm.tsx`
- Já existente: constante `MAX_FILE = 10 MB`. Exibir texto auxiliar visível: *"Tamanho máximo por arquivo: 10 MB. Formatos comuns aceitos (imagens, PDF, docs)."*
- Listar anexos já salvos da tarefa (query em `task_attachments` por `task_id`), com:
  - ícone **olho** que chama `supabase.storage.from('task-attachments').createSignedUrl(path, 60)` e abre em nova aba.
  - manter listagem dos arquivos pendentes (ainda não enviados) como hoje.

### `src/lib/task-utils.ts`
- Tipagem `Task` é gerada automaticamente a partir de `types.ts` — sem edição manual.

## Validação

- Criar tarefa nova → aparece `#N` no card, N+1 na próxima.
- Clicar "Nota" no card → abre `/anotacoes` com nota nova vinculada; ao voltar e clicar de novo, abre a mesma nota.
- Editar tarefa com anexo → botão olho abre o arquivo em nova aba.
- Tentar anexar arquivo >10 MB → toast de erro (já existe) e o aviso de limite fica visível ao lado do campo.

## Fora do escopo

- Reordenar/renumerar manualmente.
- Múltiplas notas por tarefa com seletor (será sempre "a mais recente vinculada" ou uma nova).
- Preview embutido de PDF/imagem no próprio formulário (abrir em nova aba já resolve).

Confirma que posso implementar exatamente isso?
