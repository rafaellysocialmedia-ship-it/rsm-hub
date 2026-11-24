import { createFileRoute } from "@tanstack/react-router";
import { PostsPage, validatePostsSearch } from "@/components/posts/posts-page";

export const Route = createFileRoute("/_authenticated/conteudo/calendario")({
  validateSearch: validatePostsSearch("calendario"),
  head: () => ({ meta: [{ title: "Calendário · Conteúdo · RSM Gestão de Marketing" }] }),
  component: () => <PostsPage section="calendario" />,
});
