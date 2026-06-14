# Funcionalidade: Fluxos de Processos (React Flow)

## Objetivo

Adicionar uma nova funcionalidade ao Planejador de Tarefas: uma tela de
**Fluxos de Processos**, onde o usuário desenha visualmente o passo a
passo de uma rotina (de onde vem, o que fazer, para onde vai), podendo
vincular cada etapa a uma tarefa real do sistema ou deixar como
anotação livre.

O objetivo é documentar processos recorrentes (profissionais ou
pessoais) de forma visual, para que outras pessoas da equipe entendam
o fluxo e possam executá-lo como rotina.

**Biblioteca**: usar `@xyflow/react` (React Flow) para o canvas de
diagrama — é a biblioteca certa para nós conectados por setas, com
drag-and-drop e exportação nativa.

---

## 1. Novas tabelas no Supabase

Com RLS, seguindo o padrão já usado em `tasks`. **Importante**: como o
app agora permite cadastro aberto de qualquer usuário (allowlist
removida), o isolamento por `user_id` nessas tabelas é essencial —
cada usuário só pode ver e editar os próprios fluxos.

```sql
process_flows (
  id uuid PK,
  user_id uuid FK -> auth.users,
  nome text,
  tipo text check in ('profissional', 'pessoal'),
  criado_em timestamp,
  atualizado_em timestamp
)

process_flow_nodes (
  id uuid PK,
  flow_id uuid FK -> process_flows,
  tipo text check in ('tarefa', 'nota'),
  task_id uuid FK -> tasks (nullable, só preenchido se tipo='tarefa'),
  texto text (nullable, só preenchido se tipo='nota'),
  posicao_x float,
  posicao_y float,
  cor text (uma das: blue, coral, red, green, amber, purple, teal, pink, gray),
  red_flag boolean default false
)

process_flow_edges (
  id uuid PK,
  flow_id uuid FK -> process_flows,
  source_node_id uuid FK -> process_flow_nodes,
  target_node_id uuid FK -> process_flow_nodes
)
```

RLS: usuário só vê/edita seus próprios fluxos (via `user_id` em
`process_flows`, e join para as tabelas filhas em `process_flow_nodes`
e `process_flow_edges`).

---

## 2. Nova rota `/processos` (lista de fluxos)

- Grid de cards, um por fluxo salvo
- Cada card mostra: nome do fluxo, tipo (badge Profissional/Pessoal),
  data de atualização
- Filtro por tipo (Profissional / Pessoal / Todos)
- Botão "Novo fluxo" abre o editor em branco
- Clicar num card abre o editor daquele fluxo (`/processos/$id`)
- Botão "Duplicar" em cada card — cria uma cópia completa do fluxo
  (nós, posições, conexões, cores) com novo nome, para servir de
  template em próximas execuções da mesma rotina. Os nós do tipo
  'tarefa' na cópia ficam SEM `task_id` vinculado (usuário vincula a
  uma tarefa nova depois)

---

## 3. Editor do fluxo `/processos/$id` (canvas React Flow)

- Canvas livre: usuário arrasta nós, redimensiona, conecta com setas
- Botão "Adicionar nó" com duas opções:
  - **Nó Tarefa**: abre busca/seleção de uma tarefa existente OU
    criação de tarefa nova (reaproveitar o `TaskForm` já existente);
    o nó mostra o título da tarefa
  - **Nó Nota**: campo de texto livre, sem vínculo com `tasks`
- Cada nó tem:
  - Seleção de cor (paleta com 9 opções: blue, coral, red, green,
    amber, purple, teal, pink, gray — aplicada como fundo do nó)
  - Toggle "Red flag" (booleano) — quando ativo, exibe um ícone/badge
    de bandeira vermelha no canto superior direito do nó, sobreposto
    à cor escolhida, indicando atenção/prioridade
- Clicar num **nó do tipo Tarefa** abre o `TaskCard` (modal já
  existente) daquela tarefa, permitindo editar prioridade, prazo,
  status etc. sem sair da tela
- Clicar num **nó do tipo Nota** abre edição inline do texto
- Salvar automaticamente (ou botão "Salvar") as posições, cores, red
  flags e conexões no Supabase

---

## 4. Exportação

- Botão "Exportar" no editor, usando a exportação nativa do React Flow
  para gerar **PNG** e **SVG** do diagrama completo
- Arquivo exportado deve ter fundo sólido (não transparente) para
  ficar legível quando enviado por WhatsApp/e-mail

---

## 5. Navegação

- Adicionar "Processos" ao menu lateral do `AppShell.tsx`, junto com
  Painel, Agenda, Histórico, Configurações

---

## Restrições

**NÃO alterar** nada do que já existe em `/principal`, `/agenda`,
`/historico` ou nos componentes `TaskCard`/`TaskForm` além de
reutilizá-los conforme descrito acima.
