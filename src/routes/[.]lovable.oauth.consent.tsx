import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

// Minimal typed wrapper for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; logo_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
};
type OAuthNamespace = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};
function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-md">
        <h1 className="font-semibold mb-2">Não foi possível carregar a autorização</h1>
        <p className="text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "um aplicativo";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold leading-tight">Conectar {clientName}</h1>
            <p className="text-xs text-muted-foreground">Autorize acesso à sua conta do Planejador.</p>
          </div>
        </div>
        <p className="text-sm mb-4">
          {clientName} poderá usar as ferramentas do Planejador em seu nome (listar/criar tarefas e anotações).
          Você pode revogar o acesso a qualquer momento.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive mb-3">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aprovar
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
            Recusar
          </Button>
        </div>
      </Card>
    </main>
  );
}