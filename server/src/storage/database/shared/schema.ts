import { pgTable, serial, timestamp, varchar, text, boolean, numeric, integer, index, jsonb } from "drizzle-orm/pg-core"
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
	category: text("category"), // 商品品类
	package_type: varchar("package_type", { length: 20 }), // 团购类型：combo/voucher
	merchant_id: varchar("merchant_id", { length: 36 }), // 商家 ID
	combinations: jsonb("combinations"), // 商品搭配 JSON
	// 交易规则
	purchase_limit: integer("purchase_limit").default(0), // 限购数量，0为不限制
	purchase_limit_type: varchar("purchase_limit_type", { length: 20 }).default("unlimited"), // unlimited/limited
	purchase_limit_per_day: integer("purchase_limit_per_day").default(0), // 每人每天限购
	purchase_limit_per_month: integer("purchase_limit_per_month").default(0), // 每人每月限购
	valid_days: integer("valid_days").default(60), // 有效天数
	valid_from_purchase: boolean("valid_from_purchase").default(true), // 购买当天可用
	valid_date_type: varchar("valid_date_type", { length: 20 }).default("days"), // days/date
	valid_date_start: varchar("valid_date_start", { length: 20 }), // 指定日期开始
	valid_date_end: varchar("valid_date_end", { length: 20 }), // 指定日期结束
	unavailable_dates: jsonb("unavailable_dates"), // 不可用日期 JSON
	unavailable_date_type: varchar("unavailable_date_type", { length: 20 }).default("all"), // all/partial
	unavailable_weekdays: jsonb("unavailable_weekdays"), // 每周几不可用
	unavailable_holidays: jsonb("unavailable_holidays"), // 节假日不可用
	available_time_type: varchar("available_time_type", { length: 20 }).default("business_hours"), // business_hours/specified
	available_time_start: varchar("available_time_start", { length: 10 }), // 可用时段开始
	available_time_end: varchar("available_time_end", { length: 10 }), // 可用时段结束
	limit_usage_count: boolean("limit_usage_count").default(false), // 限制使用张数
	need_reservation: boolean("need_reservation").default(false), // 需要预约
	// 消费规则
	other_discount: text("other_discount"), // 店内其他优惠
	private_room: text("private_room"), // 包间说明
	dine_in_type: varchar("dine_in_type", { length: 20 }).default("all"), // 堂食外带约定
	has_extra_fee: boolean("has_extra_fee").default(false), // 是否有额外费用
	extra_fees: jsonb("extra_fees"), // 额外费用 JSON
	other_notes: text("other_notes"), // 其他说明
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