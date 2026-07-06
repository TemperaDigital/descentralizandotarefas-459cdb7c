import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "complete_task",
  title: "Concluir tarefa",
  description: "Marca uma tarefa como concluída para o usuário autenticado.",
  inputSchema: {
    id: z.string().uuid().describe("ID da tarefa a concluir."),
    solucao: z.string().optional().describe("Descrição da solução aplicada."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ id, solucao }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .update({
        status: "concluida",
        concluida_em: new Date().toISOString(),
        ...(solucao ? { solucao } : {}),
      })
      .eq("id", id)
      .eq("user_id", ctx.getUserId())
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarefa ${id} concluída.` }],
      structuredContent: { task: data },
    };
  },
});