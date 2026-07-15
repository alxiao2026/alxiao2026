import { pgTable, serial, timestamp, varchar, text, boolean, numeric, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 奖品表
export const prizes = pgTable("prizes", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 128 }).notNull(),
	description: text("description"),
	probability: numeric("probability", { precision: 5, scale: 2 }).notNull().default("0"), // 概率百分比 0-100
	image_url: varchar("image_url", { length: 512 }),
	stock: integer("stock").notNull().default(0),
	is_active: boolean("is_active").notNull().default(true),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("prizes_is_active_idx").on(table.is_active),
]);

// 订单表
export const orders = pgTable("orders", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 128 }).notNull(),
	nick_name: varchar("nick_name", { length: 128 }),
	avatar_url: varchar("avatar_url", { length: 512 }),
	package_name: varchar("package_name", { length: 128 }).notNull().default("基础套餐"),
	price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
	status: varchar("status", { length: 20 }).notNull().default("paid"), // paid, completed
	shared: boolean("shared").notNull().default(false),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("orders_user_id_idx").on(table.user_id),
	index("orders_status_idx").on(table.status),
	index("orders_created_at_idx").on(table.created_at),
]);

// 基础套餐表
export const packages = pgTable("packages", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 128 }).notNull(),
	description: text("description"),
	price: numeric("price", { precision: 10, scale: 2 }).notNull().default("9.90"),
	original_price: numeric("original_price", { precision: 10, scale: 2 }),
	badge: varchar("badge", { length: 64 }),
	features: text("features"), // JSON array of feature strings
	cover_image: varchar("cover_image", { length: 512 }), // 商品头图 URL
	environment_images: text("environment_images"), // JSON array of environment image URLs
	stock: integer("stock").notNull().default(0), // 库存数量
	sale_start_date: varchar("sale_start_date", { length: 20 }), // 售卖开始日期
	sale_end_date: varchar("sale_end_date", { length: 20 }), // 售卖结束日期
	auto_renew: boolean("auto_renew").notNull().default(false), // 自动延期
	is_active: boolean("is_active").notNull().default(true),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("packages_is_active_idx").on(table.is_active),
]);

// 抽奖记录表
export const lotteryRecords = pgTable("lottery_records", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	order_id: varchar("order_id", { length: 36 }).notNull().references(() => orders.id),
	user_id: varchar("user_id", { length: 128 }).notNull(),
	prize_id: varchar("prize_id", { length: 36 }).references(() => prizes.id),
	prize_name: varchar("prize_name", { length: 128 }),
	is_winner: boolean("is_winner").notNull().default(false),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("lottery_records_order_id_idx").on(table.order_id),
	index("lottery_records_user_id_idx").on(table.user_id),
	index("lottery_records_prize_id_idx").on(table.prize_id),
]);

// 商家表
export const merchants = pgTable("merchants", {
	id: serial().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	logo: varchar("logo", { length: 512 }),
	address: varchar("address", { length: 512 }),
	phone: varchar("phone", { length: 50 }),
	business_hours: varchar("business_hours", { length: 100 }),
	category: varchar("category", { length: 100 }),
	description: text("description"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});