## Problema

O botão **Editar** nas telas "Principal" e "Histórico" abre o formulário em branco (modo "Nova tarefa") em vez de carregar a tarefa para edição.

### Causa raiz

No TanStack Router (roteamento por arquivos), quando existe `cadastro.$id.tsx`, o arquivo `cadastro.tsx` deixa de ser uma página folha e passa a ser uma **rota de layout** para `/cadastro/*`. Porém, hoje `src/routes/_authenticated/cadastro.tsx` renderiza diretamente `<TaskForm />` (sem `id`), em vez de renderizar `<Outlet />`. Resultado: ao navegar para `/cadastro/<id>`, o layout monta o `TaskForm` sem `taskId` (formulário novo) e a rota filha nunca aparece.

## Correção

1. Transformar `src/routes/_authenticated/cadastro.tsx` em rota de layout pura:
   - `component: () => <Outlet />`
   - Manter `head` com título padrão.

2. Criar `src/routes/_authenticated/cadastro.index.tsx` (URL `/cadastro`) que renderiza `<TaskForm />` para nova tarefa, com `head` "Nova tarefa | Planejador".

3. `src/routes/_authenticated/cadastro.$id.tsx` permanece inalterado e passa a montar corretamente sob o layout, recebendo o `id`.

Nenhuma alteração em `TaskCard`, `TaskForm`, banco de dados ou outras telas. `routeTree.gen.ts` será regenerado automaticamente.

## Validação

- Em `/principal`, clicar **Editar** numa tarefa → abre `/cadastro/<id>` com os campos preenchidos.
- Em `/historico`, clicar **Editar** numa tarefa arquivada → idem.
- Botão "Nova tarefa" em `/cadastro` continua abrindo formulário vazio.
