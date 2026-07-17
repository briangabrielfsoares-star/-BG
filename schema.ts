import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  price: integer("price").notNull().default(0),
  oldPrice: integer("old_price").notNull().default(0),
  category: text("category").notNull().default("Tênis"),
  brand: text("brand").notNull().default(""),
  stock: integer("stock").notNull().default(0),
  sold: integer("sold").notNull().default(0),
  rating: integer("rating").notNull().default(500),
  badge: text("badge").notNull().default(""),
  colors: text("colors").notNull().default("[]"),
  sizes: text("sizes").notNull().default("[]"),
  measurements: text("measurements").notNull().default("[]"),
  images: text("images").notNull().default("[]"),
  videos: text("videos").notNull().default("[]"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  published: integer("published", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  image: text("image").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull().default(""),
  customerEmail: text("customer_email").notNull().default(""),
  total: integer("total").notNull().default(0),
  status: text("status").notNull().default("novo"),
  items: text("items").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const coupons = sqliteTable("coupons", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  discount: integer("discount").notNull().default(0),
  kind: text("kind").notNull().default("percent"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  expiresAt: text("expires_at").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
