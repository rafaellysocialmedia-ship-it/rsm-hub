import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ReviewDialog } from "@/components/approval/review-dialog";
import { QueryState } from "@/components/workspace/account-panels";
import type { Post } from "@/lib/posts";
export const Route = createFileRoute("/_authenticated/review/$token")({
  component: ReviewLinkPage,
});
function ReviewLinkPage() {
  const { token } = Route.useParams();
  const [open, setOpen] = useState(true);
  const q = useQuery({
    queryKey: ["approval-link", token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_approval_link_post", { _token: token });
      if (error) throw error;
      return data as unknown as Post;
    },
  });
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Revisão de conteúdo</h1>
      {q.error && (
        <p role="alert" className="my-4 text-destructive">
          {q.error.message}
        </p>
      )}
      <QueryState loading={q.isLoading}>
        {q.data && open ? (
          <ReviewDialog
            post={q.data}
            token={token}
            onClose={() => {
              setOpen(false);
              void q.refetch();
            }}
          />
        ) : (
          <p className="my-4">Acompanhe seus conteúdos no portal.</p>
        )}
      </QueryState>
      <Link to="/portal" className="text-primary underline">
        Ir para o portal
      </Link>
    </main>
  );
}
