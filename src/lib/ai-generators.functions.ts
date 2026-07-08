import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export type GeneratorKind = "caption" | "ideas" | "hashtags" | "rewrite" | "script";

export type GeneratorInput = {
  kind: GeneratorKind;
  topic: string;
  network?: string;
  tone?: string;
  extra?: string;
};

function buildPrompt(input: GeneratorInput): { system: string; user: string } {
  const base = `Rede: ${input.network || "não especificada"}\nTom: ${input.tone || "natural, profissional"}\n${input.extra ? `Contexto extra: ${input.extra}\n` : ""}`;
  switch (input.kind) {
    case "caption":
      return {
        system: "Você é copywriter de social media brasileiro. Escreva legendas curtas, com hook forte na 1ª linha, corpo com valor e um CTA claro. Nunca use emojis exagerados. Responda em markdown.",
        user: `${base}\nTópico: ${input.topic}\n\nGere 3 opções de legenda numeradas.`,
      };
    case "ideas":
      return {
        system: "Você é estrategista de conteúdo brasileiro. Gere ideias de pauta acionáveis, específicas, com ângulo claro. Responda em markdown com lista numerada.",
        user: `${base}\nTema/nicho: ${input.topic}\n\nGere 8 ideias de post com título e ângulo/gancho para cada uma.`,
      };
    case "hashtags":
      return {
        system: "Você é especialista em hashtags para redes sociais brasileiras. Misture hashtags de alto, médio e baixo volume. Sem símbolos extras, apenas #tag separadas por espaço.",
        user: `${base}\nTópico: ${input.topic}\n\nGere 3 conjuntos de hashtags (curto: 5, médio: 15, longo: 25). Formate cada conjunto em bloco de código.`,
      };
    case "rewrite":
      return {
        system: "Você reescreve textos de social media mantendo a intenção, ajustando o tom e melhorando clareza, ritmo e CTA. Responda em markdown.",
        user: `${base}\nTexto original:\n"""\n${input.topic}\n"""\n\nGere 3 reescritas numeradas.`,
      };
    case "script":
      return {
        system: "Você é roteirista de Reels/Shorts brasileiro. Estruture: HOOK (3s), DESENVOLVIMENTO, CTA. Curto, ritmado, com indicações visuais entre colchetes. Markdown.",
        user: `${base}\nTópico/produto: ${input.topic}\n\nGere um roteiro de 30-45 segundos.`,
      };
  }
}

export const runAiGenerator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown): GeneratorInput => {
    const i = input as GeneratorInput;
    if (!i?.kind || !i?.topic || typeof i.topic !== "string") {
      throw new Error("Campos obrigatórios ausentes");
    }
    return i;
  })
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const { system, user } = buildPrompt(data);
    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system,
      prompt: user,
    });
    return { text };
  });
