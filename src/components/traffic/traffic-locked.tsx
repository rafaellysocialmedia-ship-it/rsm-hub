import { Link } from "@tanstack/react-router";
import { Megaphone, Target, TrendingUp, Users2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const BENEFITS = [
  { icon: Target, title: "Campanhas estratégicas", text: "Meta Ads e Google Ads planejados para o seu objetivo." },
  { icon: Users2, title: "Leads qualificados", text: "CRM completo para acompanhar cada contato gerado." },
  { icon: TrendingUp, title: "Resultados transparentes", text: "Investimento, CPA, CTR e ROAS atualizados." },
];

export function TrafficLocked() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      <Card className="p-10 text-center shadow-soft">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-brand">
          <Megaphone className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Você ainda não possui o serviço de Tráfego Pago.
        </h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Contrate a gestão de tráfego e acompanhe campanhas, leads e resultados diretamente aqui.
        </p>

        <div className="mt-8 grid gap-4 text-left sm:grid-cols-3">
          {BENEFITS.map((b) => (
            <div key={b.title} className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <b.icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-sm font-medium">{b.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>

        <Button asChild className="mt-8">
          <Link to="/marketplace">Contratar Tráfego Pago</Link>
        </Button>
      </Card>
    </div>
  );
}
