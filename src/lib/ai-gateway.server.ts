import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createAiGatewayProvider(apiKey: string, baseURL: string) {
  return createOpenAICompatible({
    name: "rsm-ai",
    baseURL,
    apiKey,
  });
}
