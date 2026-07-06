import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_notes",
  title: "Listar anotações",
  description: "Lista as anotações do usuário autenticado.",
  inputSchema: {
    search: z.string().optional().describe("Filtrar por texto no título ou conteúdo."),
    limit: z.number().int().min(1).max(100).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    let q = supabaseForUser(ctx)
      .from("notes")
      .select("id,title,plain_text,tags,updated_at")
      .eq("user_id", ctx.getUserId())
      .order("updated_at", { ascending: false })
      .limit(limit ?? 25);
    if (search) q = q.or(`title.ilike.%${search}%,plain_text.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { notes: data ?? [] },
    };
  },
});