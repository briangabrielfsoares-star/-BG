import { requireAdmin } from "../../_core/admin-auth";

type Diagnostic = { attempts: string[]; resolvedUrl?: string; shopId?: string; itemId?: string };

function getIds(url: string) {
  const patterns = [/i\.(\d+)\.(\d+)/, /product\/.+?\/(\d+)\/(\d+)/, /-(\d+)\.(\d+)(?:\?|$)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return { shopId: match[1], itemId: match[2] };
  }
  return null;
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  const diagnostic: Diagnostic = { attempts: [] };
  let target: URL;
  try { target = new URL(body.url || ""); } catch { return Response.json({ ok: false, error: "Cole um link válido da Shopee.", diagnostic }, { status: 400 }); }
  if (!/(^|\.)shopee\.com\.br$|(^|\.)shope\.ee$/.test(target.hostname)) return Response.json({ ok: false, error: "O link precisa ser da Shopee Brasil.", diagnostic }, { status: 400 });

  try {
    diagnostic.attempts.push("Resolvendo o link do anúncio");
    const resolved = await fetch(target, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; BGDropImporter/1.0)" } });
    diagnostic.resolvedUrl = resolved.url || target.toString();
    const ids = getIds(diagnostic.resolvedUrl);
    if (!ids) return Response.json({ ok: false, error: "Não foi possível identificar o código do produto nesse link.", diagnostic }, { status: 422 });
    diagnostic.shopId = ids.shopId;
    diagnostic.itemId = ids.itemId;
    diagnostic.attempts.push("Consultando os dados públicos do produto");
    const api = await fetch(`https://shopee.com.br/api/v4/item/get?itemid=${ids.itemId}&shopid=${ids.shopId}`, { headers: { accept: "application/json", referer: diagnostic.resolvedUrl, "user-agent": "Mozilla/5.0" } });
    if (!api.ok) throw new Error(`A Shopee respondeu com bloqueio HTTP ${api.status}`);
    const json = await api.json() as { data?: Record<string, unknown>; error?: number };
    const data = json.data;
    if (!data) throw new Error("A Shopee não devolveu os dados do anúncio");
    const images = Array.isArray(data.images) ? data.images.map((image) => `https://down-br.img.susercontent.com/file/${image}`) : [];
    const models = Array.isArray(data.models) ? data.models as Array<Record<string, unknown>> : [];
    const tierVariations = Array.isArray(data.tier_variations) ? data.tier_variations as Array<Record<string, unknown>> : [];
    const optionGroups = tierVariations.map((variation) => ({ name: String(variation.name || "Variação"), options: Array.isArray(variation.options) ? variation.options.map(String) : [] }));
    const sizes = optionGroups.find((group) => /tamanho|size|numera/i.test(group.name))?.options ?? [];
    const colors = optionGroups.find((group) => /cor|color/i.test(group.name))?.options ?? [];
    const priceRaw = Number(data.price_min ?? data.price ?? 0);
    const oldPriceRaw = Number(data.price_before_discount ?? 0);
    const videoInfo = Array.isArray(data.video_info_list) ? data.video_info_list as Array<Record<string, unknown>> : [];
    const videos = videoInfo.map((video) => String(video.video_url || video.default_format?.toString() || "")).filter(Boolean);
    const stock = models.reduce((sum, model) => sum + Number(model.stock || 0), 0) || Number(data.stock || 0);
    return Response.json({ ok: true, product: {
      name: String(data.name || ""), description: String(data.description || ""), price: priceRaw / 100000, oldPrice: oldPriceRaw / 100000,
      category: "Tênis", brand: String(data.brand || data.shop_name || ""), stock, sold: Number(data.historical_sold || data.sold || 0), rating: Number((data.item_rating as Record<string, unknown> | undefined)?.rating_star || 0),
      badge: "IMPORTADO", colors, sizes, images, videos, measurements: [], published: false, featured: false,
    }, diagnostic });
  } catch (error) {
    diagnostic.attempts.push(error instanceof Error ? error.message : "Falha desconhecida");
    return Response.json({ ok: false, error: "A Shopee bloqueou ou não disponibilizou os dados deste anúncio agora. Tente novamente mais tarde ou preencha o produto manualmente.", diagnostic }, { status: 502 });
  }
}
