import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_task",
  title: "Criar tarefa",
  description: "Cria uma nova tarefa para o usuário autenticado.",
  inputSchema: {
    titulo: z.string().min(1).describe("Título da tarefa."),
    descricao: z.string().optional().describe("Descrição detalhada."),
    data: z
      .string()
      .optional()
      .describe("Data no formato YYYY-MM-DD. Padrão: hoje."),
    tipo: z.enum(["profissional", "pessoal"]).optional().describe("Tipo da tarefa."),
    prioridade: z.enum(["baixa", "media", "alta"]).optional().describe("Prioridade."),
    responsavel: z.string().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const row = {
      user_id: ctx.getUserId(),
      titulo: input.titulo,
      descricao: input.descricao ?? null,
      data: input.data ?? new Date().toISOString().slice(0, 10),
      tipo: input.tipo ?? "profissional",
      prioridade: input.prioridade ?? "media",
      responsavel: input.responsavel ?? null,
    };
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .insert(row)
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Tarefa criada: ${data.id}` }],
      structuredContent: { task: data },
    };
  },
});