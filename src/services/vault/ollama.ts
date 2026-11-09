const OLLAMA_URL = process.env.VAULT_OLLAMA_URL ?? 'http://127.0.0.1:11434';
export const VAULT_MODEL = process.env.VAULT_MODEL ?? 'qwen2.5-coder:7b';

const SYSTEM_PROMPT =
  'You are a local configuration assistant. You are shown .env files that contain live secrets. ' +
  'Answer the question about their structure: which keys exist, which differ, what is missing, ' +
  'what looks misconfigured. Refer to values ONLY by key name. Never repeat, quote, encode, ' +
  'split, or paraphrase any value. Be brief.';

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

/** One local chat call. keep_alive=0 unloads the model right after, so it never sits in RAM. */
export async function askLocalModel(context: string, question: string): Promise<string> {
  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(OLLAMA_URL)) {
    throw new Error(`VAULT_OLLAMA_URL must be a loopback address, got ${OLLAMA_URL}`);
  }
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: VAULT_MODEL,
        stream: false,
        keep_alive: 0,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${context}\n\nQuestion: ${question}` },
        ],
      }),
      signal: AbortSignal.timeout(180_000),
    });
  } catch (err) {
    throw new Error(
      `Local model unreachable at ${OLLAMA_URL} (is Ollama running? \`ollama serve\`): ${(err as Error).message}`
    );
  }
  const body = (await res.json()) as OllamaChatResponse;
  if (!res.ok || body.error) throw new Error(`Ollama error: ${body.error ?? res.status}`);
  return body.message?.content ?? '';
}
