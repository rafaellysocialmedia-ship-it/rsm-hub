import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listClientsTool from "./tools/list-clients";
import listPostsTool from "./tools/list-posts";
import createPostTool from "./tools/create-post";
import updatePostStatusTool from "./tools/update-post-status";
import listTasksTool from "./tools/list-tasks";
import createTaskTool from "./tools/create-task";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "rsm",
  title: "RSM",
  version: "0.1.0",
  instructions:
    "Ferramentas do RSM (Social Media Hub): consulte clientes, publicações do calendário editorial e tarefas, crie publicações e tarefas e atualize o status de publicações. Todas as operações respeitam as permissões do usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listClientsTool,
    listPostsTool,
    createPostTool,
    updatePostStatusTool,
    listTasksTool,
    createTaskTool,
  ],
});
