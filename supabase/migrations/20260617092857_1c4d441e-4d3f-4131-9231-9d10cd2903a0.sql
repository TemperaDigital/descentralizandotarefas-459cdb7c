
ALTER TABLE public.process_flow_nodes
  ADD COLUMN IF NOT EXISTS cor_texto text,
  ADD COLUMN IF NOT EXISTS comentario text;

ALTER TABLE public.process_flows
  ADD COLUMN IF NOT EXISTS canvas_extras jsonb NOT NULL DEFAULT '{}'::jsonb;
