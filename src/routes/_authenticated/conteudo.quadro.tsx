import { createFileRoute } from "@tanstack/react-router";
import { PostsPage, validatePostsSearch } from "@/components/posts/posts-page";

export const Route = createFileRoute("/_authenticated/conteudo/quadro")({
  validateSearch: validatePostsSearch("quadro"),
  head: () => ({ meta: [{ title: "Quadro · Conteúdo · RSM Gestão de Marketing" }] }),
  component: () => <PostsPage section="quadro" />,
});
