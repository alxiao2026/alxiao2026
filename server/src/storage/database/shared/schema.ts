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