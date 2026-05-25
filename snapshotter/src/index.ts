import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { renderUrl } from "./render.js";
import { uploadToWalrus } from "./walrus.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));

app.post<{ Body: { url: string } }>("/snapshot", async (req, reply) => {
  const { url } = req.body ?? {};
  if (!url) return reply.code(400).send({ error: "url required" });

  const bundle = await renderUrl(url);
  const { blobId } = await uploadToWalrus(bundle.bytes);

  return {
    blob_id: blobId,
    sha256: bundle.sha256,
    captured_at_ms: bundle.capturedAtMs,
    original_url: url,
  };
});

const port = Number(process.env.PORT ?? 8080);
await app.listen({ port, host: "0.0.0.0" });
