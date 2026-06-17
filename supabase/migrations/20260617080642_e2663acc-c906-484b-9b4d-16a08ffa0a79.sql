
-- Extend process_flows
ALTER TABLE public.process_flows
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- Create lanes table FIRST so nodes can FK to it
CREATE TABLE IF NOT EXISTS public.process_flow_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.process_flows(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT 'Nova raia',
  tipo text NOT NULL DEFAULT 'responsavel' CHECK (tipo IN ('responsavel','fase')),
  ordem integer NOT NULL DEFAULT 0,
  orientacao text NOT NULL DEFAULT 'horizontal' CHECK (orientacao IN ('horizontal','vertical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.process_flow_lanes TO authenticated;
GRANT ALL ON public.process_flow_lanes TO service_role;

ALTER TABLE public.process_flow_lanes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lanes by owner" ON public.process_flow_lanes;
CREATE POLICY "lanes by owner" ON public.process_flow_lanes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.process_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.process_flows f WHERE f.id = flow_id AND f.user_id = auth.uid()));

DROP TRIGGER IF EXISTS set_updated_at_process_flow_lanes ON public.process_flow_lanes;
CREATE TRIGGER set_updated_at_process_flow_lanes
  BEFORE UPDATE ON public.process_flow_lanes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend process_flow_nodes
ALTER TABLE public.process_flow_nodes
  ADD COLUMN IF NOT EXISTS duracao_estimada_minutes integer,
  ADD COLUMN IF NOT EXISTS etapa_tipo text NOT NULL DEFAULT 'intermediaria',
  ADD COLUMN IF NOT EXISTS lane_id uuid REFERENCES public.process_flow_lanes(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER TABLE public.process_flow_nodes
    ADD CONSTRAINT process_flow_nodes_etapa_tipo_check
    CHECK (etapa_tipo IN ('inicio','intermediaria','fim'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
