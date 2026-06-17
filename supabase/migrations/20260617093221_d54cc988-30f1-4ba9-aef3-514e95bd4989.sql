
ALTER TABLE public.process_flow_nodes DROP CONSTRAINT IF EXISTS process_flow_nodes_tipo_check;
ALTER TABLE public.process_flow_nodes
  ADD CONSTRAINT process_flow_nodes_tipo_check
  CHECK (tipo IN ('tarefa','nota','comentario'));
