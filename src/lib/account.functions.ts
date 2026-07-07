import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Lista recursivamente todos os arquivos (não pastas) sob um prefixo no
 * bucket — `storage.list()` só devolve o nível imediato, então pastas
 * (entradas com `id: null`) precisam ser exploradas uma a uma.
 */
async function listAllStorageFiles(
  sb: { storage: { from: (bucket: string) => { list: (path: string, opts?: { limit: number }) => Promise<{ data: { id: string | null; name: string }[] | null; error: unknown }> } } },
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const paths: string[] = [];
  for (const entry of data) {
    const fullPath = `${prefix}/${entry.name}`;
    if (entry.id === null) {
      paths.push(...(await listAllStorageFiles(sb, bucket, fullPath)));
    } else {
      paths.push(fullPath);
    }
  }
  return paths;
}

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = context.userId;

    // Storage: anexos de tarefas E imagens coladas no canvas de processos
    // vivem sob o mesmo prefixo `${uid}/...` no bucket "task-attachments" —
    // nunca eram removidos, nem aqui nem ao excluir uma tarefa avulsa,
    // ficando órfãos pra sempre depois que o usuário deixa de existir.
    const filePaths = await listAllStorageFiles(supabaseAdmin, "task-attachments", uid);
    if (filePaths.length > 0) {
      await supabaseAdmin.storage.from("task-attachments").remove(filePaths);
    }

    // Clean up user data first (in case FKs are not ON DELETE CASCADE)
    await supabaseAdmin.from("task_attachments").delete().eq("user_id", uid);
    // notes.user_id não tem FK/cascade pra auth.users — sem isto, as notas
    // do usuário ficavam órfãs no banco para sempre após a exclusão.
    await supabaseAdmin.from("notes").delete().eq("user_id", uid);
    await supabaseAdmin.from("tasks").delete().eq("user_id", uid);
    await supabaseAdmin.from("shortcuts").delete().eq("user_id", uid);
    await supabaseAdmin.from("profiles").delete().eq("id", uid);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });