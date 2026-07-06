import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tasks",
  title: "Listar tarefas",
  description: "Lista as tarefas do usuário autenticado, com filtros opcionais por status e data.",
  inputSchema: {
    status: z
      .enum(["pendente", "concluida", "arquivada"])
      .optional()
      .describe("Filtrar por status da tarefa."),
    limit: z.number().int().min(1).max(100).optional().describe("Quantidade máxima (padrão 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("tasks")
      .select("id,titulo,descricao,data,prazo,tipo,prioridade,status,responsavel")
      .eq("user_id", ctx.getUserId())
      .order("data", { ascending: false })
      .limit(limit ?? 25);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tasks: data ?? [] },
    };
  },
});