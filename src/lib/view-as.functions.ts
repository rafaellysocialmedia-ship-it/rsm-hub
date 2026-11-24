import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * "Ver como": o administrador entra na conta de um cliente ou de alguém da
 * equipe para ver exatamente o que essa pessoa vê. Gera um acesso de uso único
 * para a conta escolhida; nenhum email é enviado e a senha não muda.
 * Outros administradores não podem ser acessados.
 */
export const startViewAs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { clientId?: string; userId?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const callerId = context.userId;

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: callerId,
      _role: "administrator",
    });
    if (roleError) throw new Error("Falha ao verificar permissão");
    if (!isAdmin) throw new Error("Apenas administradores podem usar o Ver como.");

    let targetId = data.userId ?? null;
    let clientName: string | null = null;
    if (data.clientId) {
      const { data: client, error } = await supabaseAdmin
        .from("clients")
        .select("id,name,user_id")
        .eq("id", data.clientId)
        .maybeSingle();
      if (error || !client) throw new Error("Cliente não encontrado.");
      if (!client.user_id)
        throw new Error("Este cliente ainda não tem login vinculado. Vincule um login no cadastro do cliente.");
      targetId = client.user_id;
      clientName = client.name;
    }
    if (!targetId) throw new Error("Escolha quem você quer visualizar.");
    if (targetId === callerId) throw new Error("Essa já é a sua conta.");

    const { data: targetIsAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: targetId,
      _role: "administrator",
    });
    if (targetIsAdmin) throw new Error("Não é possível entrar na conta de outro administrador.");

    const { data: target, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetId);
    if (userError || !target?.user?.email) throw new Error("Conta sem email cadastrado.");

    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.user.email,
    });
    if (linkError || !link?.properties?.hashed_token)
      throw new Error(linkError?.message ?? "Não foi possível gerar o acesso.");

    const [{ data: roles }, { data: profile }, { data: caller }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", targetId),
      supabaseAdmin.from("profiles").select("name").eq("id", targetId).maybeSingle(),
      supabaseAdmin.from("profiles").select("name,email").eq("id", callerId).maybeSingle(),
    ]);
    const role = roles?.some((r) => r.role === "client") ? "client" : "team";

    // Registro interno no histórico do cliente (não aparece para ele).
    let linkedClient = data.clientId ?? null;
    if (!linkedClient && role === "client") {
      const { data: c } = await supabaseAdmin
        .from("clients")
        .select("id,name")
        .eq("user_id", targetId)
        .limit(1)
        .maybeSingle();
      linkedClient = c?.id ?? null;
      clientName = clientName ?? c?.name ?? null;
    }
    if (linkedClient) {
      await supabaseAdmin.from("client_timeline").insert({
        client_id: linkedClient,
        event_type: "admin_view_as",
        title: "Administrador entrou no portal como o cliente",
        detail: `${caller?.name || caller?.email || "Administrador"} usou o Ver como.`,
        visibility: "internal",
        actor_id: callerId,
      });
    }

    return {
      tokenHash: link.properties.hashed_token,
      name: clientName ?? profile?.name ?? target.user.email,
      role,
    };
  });
