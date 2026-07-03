import openai from "./openai";

/**
 * text-embedding-3-small, native 1536 dimensions — see the v3 spec's Layer 3
 * for why this model over -large (no discrimination need at this catalog
 * size; cost/latency both favor the smaller model).
 */
export async function embedText(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: "text-embedding-3-small", input: text });
  return res.data[0].embedding;
}
