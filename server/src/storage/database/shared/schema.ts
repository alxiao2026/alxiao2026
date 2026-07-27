import { pgTable, serial, timestamp, varchar, text, boolean, numeric, integer, index, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 商家表
export const merchants = pgTable("merchants", {
	id: serial().primaryKey(),
	name: varchar("name", { length: 255 }).notNull(),
	logo: varchar("logo", { length: 512 }),
	images: jsonb("images"), // 商家环境图 URL 数组
	address: varchar("address", { length: 512 }),
	phone: varchar("phone", { length: 50 }),
	business_hours: varchar("business_hours", { length: 100 }),
	category: varchar("category", { length: 100 }),
	description: text("description"),
	latitude: varchar("latitude", { length: 32 }),
	longitude: varchar("longitude", { length: 32 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 用户表（角色：consumer=普通消费者，merchant=商家用户，admin=系统管理员）
export const users = pgTable("users", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 128 }).notNull().unique(),
	nick_name: varchar("nick_name", { length: 128 }),
	avatar_url: varchar("avatar_url", { length: 512 }),
	phone: varchar("phone", { length: 20 }).unique(),
	password: varchar("password", { length: 128 }),
	login_type: varchar("login_type", { length: 20 }).notNull().default("password"), // password/sms/wechat
	open_id: varchar("open_id", { length: 128 }),
	gender: varchar("gender", { length: 10 }).notNull().default("unknown"),
	birthday: varchar("birthday", { length: 20 }),
	member_level: varchar("member_level", { length: 20 }).notNull().default("normal"),
	points: integer("points").notNull().default(0),
	total_orders: integer("total_orders").notNull().default(0),
	total_spent: numeric("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
	is_active: boolean("is_active").notNull().default(true),
	role: varchar("role", { length: 20 }).notNull().default("consumer"), // consumer/merchant/admin
	merchant_id: integer("merchant_id").references(() => merchants.id),
	share_count: integer("share_count").notNull().default(0), // 分享次数（抽奖权重）
	social_post_count: integer("social_post_count").notNull().default(0), // 社媒发布次数（抽奖权重）
	last_login_at: timestamp("last_login_at", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("users_phone_idx").on(table.phone),
	index("users_role_idx").on(table.role),
	index("users_merchant_id_idx").on(table.merchant_id),
]);

// 奖品表
export const prizes = pgTable("prizes", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	name: varchar("name", { length: 128 }).notNull(),
	description: text("description"),
	probability: numeric("probability", { precision: 5, scale: 2 }).notNull().default("0"), // 概率百分比 0-100
	image_url: varchar("image_url", { length: 512 }),
	stock: integer("stock").notNull().default(0),
	is_active: boolean("is_active").notNull().default(true),
	prize_type: varchar("prize_type", { length: 20 }).notNull().default("coupon"), // coupon=优惠券 / product=实物
	coupon_amount: numeric("coupon_amount", { precision: 10, scale: 2 }).notNull().default("0"), // 优惠券面额（旧字段，折扣券模式不再使用）
	coupon_min_spend: numeric("coupon_min_spend", { precision: 10, scale: 2 }).notNull().default("0"), // 优惠券最低消费（旧字段，折扣券模式不再使用）
	discount_rate: numeric("discount_rate", { precision: 4, scale: 1 }).notNull().default("0"), // 折扣券折扣（如 8.5 表示 8.5 折）
	discount_cap: numeric("discount_cap", { precision: 10, scale: 2 }).notNull().default("0"), // 折扣券单笔最高优惠金额（0 表示不封顶）
	product_name: varchar("product_name", { length: 128 }).notNull().default(""), // 实物奖品名称
	product_value: numeric("product_value", { precision: 10, scale: 2 }).notNull().default("0"), // 实物奖品价值
	merchant_id: integer("merchant_id"), // 所属商家（空为平台奖品）
	validity_hours: integer("validity_hours"), // 奖品兑换有效期（小时），空则跟随全局设置
	daily_quota: integer("daily_quota"), // 每日最多中出份数（空/0 表示不限）
	is_fallback: boolean("is_fallback").notNull().default(false), // 兜底奖：永远有货，承接兜底区间
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("prizes_is_active_idx").on(table.is_active),
	index("prizes_merchant_id_idx").on(table.merchant_id),
]);

// 订单表
export const orders = pgTable("orders", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 128 }).notNull(),
	nick_name: varchar("nick_name", { length: 128 }),
	avatar_url: varchar("avatar_url", { length: 512 }),
	package_id: varchar("package_id", { length: 36 }), // 关联套餐 ID（历史订单保留，不加强外键）
	package_name: varchar("package_name", { length: 128 }).notNull().default("基础套餐"),
	price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
	original_price: numeric("original_price", { precision: 10, scale: 2 }),
	quantity: integer("quantity").notNull().default(1), // 购买份数
	verified_count: integer("verified_count").notNull().default(0), // 已核销份数
	verification_code: varchar("verification_code", { length: 32 }), // 核销码
	verified_at: timestamp("verified_at", { withTimezone: true }), // 最近核销时间
	expire_at: timestamp("expire_at", { withTimezone: true }), // 过期时间
	shop_name: varchar("shop_name", { length: 128 }), // 消费门店名称
	order_no: varchar("order_no", { length: 64 }), // 订单编号
	status: varchar("status", { length: 20 }).notNull().default("created"), // created=待支付 / paid=已支付待使用 / used=已核销 / closed=超时关闭 / expired=已过期 / refunded=已退款
	original_amount: numeric("original_amount", { precision: 10, scale: 2 }), // 原始金额（后端算价：单价×数量）
	discount_amount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"), // 折扣券/霸王餐抵扣金额
	pay_amount: numeric("pay_amount", { precision: 10, scale: 2 }), // 实付金额（原始金额-抵扣，≥0.01）
	paid_at: timestamp("paid_at", { withTimezone: true }), // 支付完成时间
	pay_expire_at: timestamp("pay_expire_at", { withTimezone: true }), // 支付截止时间（创建+15分钟）
	refund_amount: numeric("refund_amount", { precision: 10, scale: 2 }), // 实际退款金额（=实付金额）
	shared: boolean("shared").notNull().default(false),
	verified_by: varchar("verified_by", { length: 128 }), // 最近核销人账号ID
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("orders_user_id_idx").on(table.user_id),
	index("orders_status_idx").on(table.status),
	index("orders_created_at_idx").on(table.created_at),
	index("orders_package_id_idx").on(table.package_id),
	index("orders_verification_code_idx").on(table.verification_code),
	index("orders_order_no_idx").on(table.order_no),
]);

// 支付流水表（Mock 通道，未来对接微信支付）
export const payments = pgTable("payments", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	order_id: varchar("order_id", { length: 36 }).notNull(), // 关联订单
	user_id: varchar("user_id", { length: 128 }).notNull(),
	prepay_id: varchar("prepay_id", { length: 64 }), // 预支付订单号（Mock 生成，未来为微信 prepay_id）
	transaction_id: varchar("transaction_id", { length: 64 }), // 支付流水号（幂等键）
	channel: varchar("channel", { length: 20 }).notNull().default("mock"), // mock / wechat
	status: varchar("status", { length: 20 }).notNull().default("prepay"), // prepay/paid/failed/refunding/refunded
	original_amount: numeric("original_amount", { precision: 10, scale: 2 }).notNull(), // 原始金额
	discount_amount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull().default("0"), // 抵扣金额
	pay_amount: numeric("pay_amount", { precision: 10, scale: 2 }).notNull(), // 实付金额
	refund_amount: numeric("refund_amount", { precision: 10, scale: 2 }).default("0"), // 已退金额
	lottery_record_id: varchar("lottery_record_id", { length: 36 }), // 抵扣所用中奖记录
	notify_count: integer("notify_count").notNull().default(0), // 回调次数（幂等审计）
	paid_at: timestamp("paid_at", { withTimezone: true }),
	refunded_at: timestamp("refunded_at", { withTimezone: true }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
	index("payments_order_id_idx").on(table.order_id),
	index("payments_user_id_idx").on(table.user_id),
	index("payments_status_idx").on(table.status),
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
	usage_count_limit: integer("usage_count_limit"), // 限用张数上限
	need_reservation: boolean("need_reservation").default(false), // 需要预约
	reservation_hours: integer("reservation_hours"), // 需提前预约小时数
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
	redemption_code: varchar("redemption_code", { length: 32 }),
	refund_amount: numeric("refund_amount", { precision: 10, scale: 2 }),
	refund_status: varchar("refund_status", { length: 32 }),
	redeemed_at: timestamp("redeemed_at", { withTimezone: true }),
	redeemed_by: varchar("redeemed_by", { length: 128 }),
	user_weight: numeric("user_weight", { precision: 6, scale: 2 }).notNull().default("1"), // 用户权重倍数
	ip_address: varchar("ip_address", { length: 64 }),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("lottery_records_order_id_idx").on(table.order_id),
	index("lottery_records_user_id_idx").on(table.user_id),
	index("lottery_records_prize_id_idx").on(table.prize_id),
]);

// 抽奖设置表（键值对存储）
export const lotterySettings = pgTable("lottery_settings", {
	setting_key: varchar("setting_key", { length: 64 }).primaryKey(),
	setting_value: text("setting_value"),
	updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// 抽奖接口限流表（按 IP 滑动窗口）
export const lotteryRateLimits = pgTable("lottery_rate_limits", {
	ip_address: varchar("ip_address", { length: 64 }).primaryKey(),
	request_count: integer("request_count").notNull().default(0),
	window_start: timestamp("window_start", { withTimezone: true }).defaultNow().notNull(),
});

// 抽奖操作日志表
export const lotteryLogs = pgTable("lottery_logs", {
	id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
	user_id: varchar("user_id", { length: 128 }).notNull(),
	order_id: varchar("order_id", { length: 36 }),
	action: varchar("action", { length: 32 }).notNull(),
	user_weight: numeric("user_weight", { precision: 6, scale: 2 }).notNull().default("1"), // 用户权重倍数
	prize_id: varchar("prize_id", { length: 36 }),
	prize_name: varchar("prize_name", { length: 128 }),
	is_winner: boolean("is_winner").notNull().default(false),
	ip_address: varchar("ip_address", { length: 64 }),
	user_agent: varchar("user_agent", { length: 512 }),
	detail: jsonb("detail"),
	created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("lottery_logs_user_id_idx").on(table.user_id),
	index("lottery_logs_order_id_idx").on(table.order_id),
	index("lottery_logs_created_at_idx").on(table.created_at),
]);
