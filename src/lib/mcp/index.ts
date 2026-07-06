import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";
import completeTaskTool from "./tools/complete-task";
import listNotesTool from "./tools/list-notes";
import createNoteTool from "./tools/create-note";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "planejador-mcp",
  title: "Planejador de Tarefas",
  version: "0.1.0",
  instructions:
    "Ferramentas para o Planejador de Tarefas Diárias. Use estas ferramentas para listar, criar e concluir tarefas, além de gerenciar anotações do usuário autenticado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listTasksTool, createTaskTool, completeTaskTool, listNotesTool, createNoteTool],
});