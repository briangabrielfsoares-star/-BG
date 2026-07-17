import { requireAdmin } from "../../../_core/admin-auth";
import { getRuntimeBindings } from "../../../_core/runtime-env";

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({ error: "Selecione uma imagem válida." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return Response.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 400 });
  const bucket = getRuntimeBindings().BUCKET;
  if (!bucket) return Response.json({ error: "Armazenamento de imagens indisponível." }, { status: 503 });
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const key = `uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: "public, max-age=31536000, immutable" } });
  return Response.json({ ok: true, url: `/api/media/${key}` });
}
