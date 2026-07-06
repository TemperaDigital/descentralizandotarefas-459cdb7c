
-- 1) tasks.numero
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS numero bigint;

-- Backfill: numera tarefas existentes por usuário na ordem de criação
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.tasks
  WHERE numero IS NULL
)
UPDATE public.tasks t SET numero = r.rn FROM ranked r WHERE t.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_user_numero_uidx ON public.tasks(user_id, numero);

-- Função para atribuir próximo número por usuário
CREATE OR REPLACE FUNCTION public.tasks_assign_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num bigint;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tasks_numero:' || NEW.user_id::text, 0));
  SELECT COALESCE(MAX(numero), 0) + 1 INTO next_num FROM public.tasks WHERE user_id = NEW.user_id;
  NEW.numero := next_num;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tasks_assign_numero ON public.tasks;
CREATE TRIGGER trg_tasks_assign_numero
BEFORE INSERT ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.tasks_assign_numero();

-- 2) notes.task_id
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS notes_task_id_idx ON public.notes(task_id);
