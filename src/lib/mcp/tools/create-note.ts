import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_note",
  title: "Criar anotação",
  description: "Cria uma nova anotação para o usuário autenticado.",
  inputSchema: {
    title: z.string().min(1).describe("Título da anotação."),
    content: z.string().describe("Conteúdo da anotação (texto simples ou HTML)."),
    tags: z.array(z.string()).optional().describe("Etiquetas opcionais."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ title, content, tags }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const { data, error } = await supabaseForUser(ctx)
      .from("notes")
      .insert({
        user_id: ctx.getUserId(),
        title,
        content,
        plain_text: content,
        tags: tags ?? [],
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Anotação criada: ${data.id}` }],
      structuredContent: { note: data },
    };
  },
});