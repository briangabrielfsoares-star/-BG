import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../core/db";
import { categories, coupons, orders, products, settings } from "../../../core/schema";
import { requireAdmin } from "../../../core/admin-auth";

const json = (value: unknown) => JSON.stringify(Array.isArray(value) ? value : []);
const parse = (value: string) => { try { return JSON.parse(value); } catch { return []; } };
const id = () => crypto.randomUUID();
const slugify = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || id();

function formatProduct(product: typeof products.$inferSelect) {
  return { ...product, price: product.price / 100, oldPrice: product.oldPrice / 100, rating: product.rating / 100, colors: parse(product.colors), sizes: parse(product.sizes), measurements: parse(product.measurements), images: parse(product.images), videos: parse(product.videos) };
}

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  try {
    const db = getDb();
    const [productRows, categoryRows, orderRows, couponRows, settingRows] = await Promise.all([
      db.select().from(products).orderBy(desc(products.createdAt)),
      db.select().from(categories).orderBy(desc(categories.createdAt)),
      db.select().from(orders).orderBy(desc(orders.createdAt)),
      db.select().from(coupons).orderBy(desc(coupons.createdAt)),
      db.select().from(settings),
    ]);
    return Response.json({ products: productRows.map(formatProduct), categories: categoryRows, orders: orderRows.map((order) => ({ ...order, total: order.total / 100, items: parse(order.items) })), coupons: couponRows, settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao carregar dados" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as { action?: string; payload?: Record<string, unknown> };
  const payload = body.payload ?? {};
  const db = getDb();

  try {
    if (body.action === "product.save") {
      const name = String(payload.name ?? "").trim();
      if (!name) return Response.json({ error: "Informe o nome do produto." }, { status: 400 });
      const productId = String(payload.id || id());
      const values: typeof products.$inferInsert = {
        id: productId,
        name,
        slug: slugify(String(payload.slug || name)),
        description: String(payload.description ?? ""),
        price: Math.round(Number(payload.price || 0) * 100),
        oldPrice: Math.round(Number(payload.oldPrice || 0) * 100),
        category: String(payload.category || "Tênis"),
        brand: String(payload.brand || ""),
        stock: Number(payload.stock || 0),
        sold: Number(payload.sold || 0),
        rating: Math.round(Number(payload.rating || 5) * 100),
        badge: String(payload.badge || ""),
        colors: json(payload.colors),
        sizes: json(payload.sizes),
        measurements: json(payload.measurements),
        images: json(payload.images),
        videos: json(payload.videos),
        featured: Boolean(payload.featured),
        published: payload.published !== false,
        updatedAt: new Date().toISOString(),
      };
      await db.insert(products).values(values).onConflictDoUpdate({ target: products.id, set: values });
      return Response.json({ ok: true, id: productId });
    }

    if (body.action === "product.delete") {
      await db.delete(products).where(eq(products.id, String(payload.id)));
      return Response.json({ ok: true });
    }

    if (body.action === "category.save") {
      const name = String(payload.name ?? "").trim();
      if (!name) return Response.json({ error: "Informe o nome da categoria." }, { status: 400 });
      const categoryId = String(payload.id || id());
      const values: typeof categories.$inferInsert = { id: categoryId, name, slug: slugify(String(payload.slug || name)), image: String(payload.image || ""), active: payload.active !== false };
      await db.insert(categories).values(values).onConflictDoUpdate({ target: categories.id, set: values });
      return Response.json({ ok: true });
    }

    if (body.action === "category.delete") {
      await db.delete(categories).where(eq(categories.id, String(payload.id)));
      return Response.json({ ok: true });
    }

    if (body.action === "coupon.save") {
      const code = String(payload.code ?? "").trim().toUpperCase();
      if (!code) return Response.json({ error: "Informe o código do cupom." }, { status: 400 });
      const couponId = String(payload.id || id());
      const values: typeof coupons.$inferInsert = { id: couponId, code, discount: Number(payload.discount || 0), kind: String(payload.kind || "percent"), active: payload.active !== false, expiresAt: String(payload.expiresAt || "") };
      await db.insert(coupons).values(values).onConflictDoUpdate({ target: coupons.id, set: values });
      return Response.json({ ok: true });
    }

    if (body.action === "coupon.delete") {
      await db.delete(coupons).where(eq(coupons.id, String(payload.id)));
      return Response.json({ ok: true });
    }

    if (body.action === "order.status") {
      await db.update(orders).set({ status: String(payload.status || "novo") }).where(eq(orders.id, String(payload.id)));
      return Response.json({ ok: true });
    }

    if (body.action === "settings.save") {
      const entries = Object.entries((payload.settings as Record<string, unknown>) ?? {});
      for (const [key, value] of entries) {
        await db.insert(settings).values({ key, value: String(value ?? ""), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: settings.key, set: { value: String(value ?? ""), updatedAt: new Date().toISOString() } });
      }
      return Response.json({ ok: true });
    }

    if (body.action === "backup.import") {
      const backup = payload.backup as { products?: Array<Record<string, unknown>>; categories?: Array<Record<string, unknown>>; coupons?: Array<Record<string, unknown>>; settings?: Record<string, unknown> };
      for (const product of backup?.products ?? []) {
        await db.insert(products).values({
          id: String(product.id || id()), name: String(product.name || "Produto"), slug: slugify(String(product.slug || product.name || id())), description: String(product.description || ""),
          price: Math.round(Number(product.price || 0) * 100), oldPrice: Math.round(Number(product.oldPrice || 0) * 100), category: String(product.category || "Tênis"), brand: String(product.brand || ""), stock: Number(product.stock || 0), sold: Number(product.sold || 0), rating: Math.round(Number(product.rating || 5) * 100), badge: String(product.badge || ""), colors: json(product.colors), sizes: json(product.sizes), measurements: json(product.measurements), images: json(product.images), videos: json(product.videos), featured: Boolean(product.featured), published: product.published !== false,
        }).onConflictDoNothing();
      }
      for (const [key, value] of Object.entries(backup?.settings ?? {})) await db.insert(settings).values({ key, value: String(value ?? "") }).onConflictDoUpdate({ target: settings.key, set: { value: String(value ?? "") } });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Erro ao salvar" }, { status: 500 });
  }
}
