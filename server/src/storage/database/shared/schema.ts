import { pgTable, text, timestamp, serial, index, unique, varchar, numeric, integer, boolean, foreignKey, uuid, jsonb, check, date, uniqueIndex, smallint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const notificationTemplateConfigs = pgTable("notification_template_configs", {
	type: text().primaryKey().notNull(),
	templateId: text("template_id").default('').notNull(),
	remark: text().default(''),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const orchardCoupons = pgTable("orchard_coupons", {
	id: varchar({ length: 36 }).default(sql`(gen_random_uuid())::text`).primaryKey().notNull(),
	code: varchar({ length: 32 }).notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	defId: varchar("def_id", { length: 20 }).notNull(),
	type: varchar({ length: 20 }).default('amount').notNull(),
	title: varchar({ length: 128 }).notNull(),
	threshold: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	amount: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	status: varchar({ length: 20 }).default('unused').notNull(),
	claimedAt: timestamp("claimed_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	usedAt: timestamp("used_at", { withTimezone: true, mode: 'string' }),
	expireAt: timestamp("expire_at", { withTimezone: true, mode: 'string' }),
	fromTree: integer("from_tree").default(0).notNull(),
	verifyOrderId: varchar("verify_order_id", { length: 36 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("orchard_coupons_code_idx").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("orchard_coupons_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("orchard_coupons_code_key").on(table.code),
]);

export const orchardHelps = pgTable("orchard_helps", {
	id: varchar({ length: 36 }).default(sql`(gen_random_uuid())::text`).primaryKey().notNull(),
	shareUserId: varchar("share_user_id", { length: 128 }).notNull(),
	helperUserId: varchar("helper_user_id", { length: 128 }).notNull(),
	helperName: varchar("helper_name", { length: 128 }),
	date: varchar({ length: 20 }).notNull(),
	claimed: boolean().default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("orchard_helps_helper_idx").using("btree", table.helperUserId.asc().nullsLast().op("text_ops")),
	index("orchard_helps_share_idx").using("btree", table.shareUserId.asc().nullsLast().op("text_ops")),
]);

export const lotteryRecords = pgTable("lottery_records", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	orderId: varchar("order_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	prizeId: varchar("prize_id", { length: 36 }),
	prizeName: varchar("prize_name", { length: 128 }),
	isWinner: boolean("is_winner").default(false).notNull(),
	redemptionCode: varchar("redemption_code", { length: 64 }),
	refundAmount: numeric("refund_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	refundStatus: varchar("refund_status", { length: 20 }).default('').notNull(),
	userWeight: numeric("user_weight", { precision: 10, scale:  2 }).default('0').notNull(),
	ipAddress: varchar("ip_address", { length: 45 }).default('').notNull(),
	nickName: varchar("nick_name", { length: 128 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	refundedAt: timestamp("refunded_at", { withTimezone: true, mode: 'string' }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	redeemedAt: timestamp("redeemed_at", { withTimezone: true, mode: 'string' }),
	redeemedBy: text("redeemed_by"),
}, (table) => [
	index("lottery_records_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("lottery_records_is_winner_idx").using("btree", table.isWinner.asc().nullsLast().op("bool_ops")),
	index("lottery_records_order_id_idx").using("btree", table.orderId.asc().nullsLast().op("text_ops")),
	index("lottery_records_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.prizeId],
			foreignColumns: [prizes.id],
			name: "lottery_records_prize_id_fkey"
		}),
]);

export const shareQrCodes = pgTable("share_qr_codes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	code: varchar({ length: 16 }).notNull(),
	page: varchar({ length: 128 }).notNull(),
	params: jsonb().default({}),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("share_qr_codes_code_key").on(table.code),
]);

export const merchantQualifications = pgTable("merchant_qualifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	businessLicenseUrl: text("business_license_url"),
	foodLicenseUrl: text("food_license_url"),
	otherLicenseUrls: jsonb("other_license_urls").default([]).notNull(),
	bankAccountName: varchar("bank_account_name", { length: 100 }),
	bankCardNo: varchar("bank_card_no", { length: 32 }),
	bankName: varchar("bank_name", { length: 100 }),
	bankBranch: varchar("bank_branch", { length: 200 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("merchant_qualifications_merchant_id_key").on(table.merchantId),
]);

export const orchardConfig = pgTable("orchard_config", {
	id: integer().default(1).primaryKey().notNull(),
	config: jsonb().default({}).notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const payments = pgTable("payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	userId: text("user_id").notNull(),
	prepayId: text("prepay_id"),
	transactionId: text("transaction_id"),
	channel: text().default('mock').notNull(),
	status: text().default('prepay').notNull(),
	originalAmount: numeric("original_amount", { precision: 10, scale:  2 }).notNull(),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	payAmount: numeric("pay_amount", { precision: 10, scale:  2 }).notNull(),
	refundAmount: numeric("refund_amount", { precision: 10, scale:  2 }).default('0'),
	lotteryRecordId: uuid("lottery_record_id"),
	notifyCount: integer("notify_count").default(0).notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	refundedAt: timestamp("refunded_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	orchardCouponCode: varchar("orchard_coupon_code", { length: 32 }),
}, (table) => [
	index("payments_orchard_coupon_idx").using("btree", table.orchardCouponCode.asc().nullsLast().op("text_ops")),
	unique("payments_prepay_id_key").on(table.prepayId),
	unique("payments_transaction_id_key").on(table.transactionId),
]);

export const merchantBalances = pgTable("merchant_balances", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	balance: numeric({ precision: 10, scale:  2 }).default('0'),
	totalSettled: numeric("total_settled", { precision: 10, scale:  2 }).default('0'),
	totalWithdrawn: numeric("total_withdrawn", { precision: 10, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("merchant_balances_merchant_id_key").on(table.merchantId),
]);

export const packageSettlementConfigs = pgTable("package_settlement_configs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	packageId: varchar("package_id").notNull(),
	settlementType: integer("settlement_type").default(1).notNull(),
	commissionRate: numeric("commission_rate", { precision: 5, scale:  2 }).default('0'),
	settlementPrice: numeric("settlement_price", { precision: 10, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("package_settlement_configs_package_id_key").on(table.packageId),
	check("package_settlement_configs_settlement_type_check", sql`settlement_type = ANY (ARRAY[1, 2])`),
]);

export const settlementRevocations = pgTable("settlement_revocations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: uuid("order_id").notNull(),
	merchantId: integer("merchant_id").notNull(),
	packageId: uuid("package_id"),
	revokeCount: integer("revoke_count").default(0).notNull(),
	rollbackAmount: numeric("rollback_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	rollbackCommission: numeric("rollback_commission", { precision: 10, scale:  2 }).default('0').notNull(),
	operatorId: text("operator_id"),
	operatorName: text("operator_name"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("idx_settlement_revocations_order").using("btree", table.orderId.asc().nullsLast().op("uuid_ops")),
]);

export const lotteryLogs = pgTable("lottery_logs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	orderId: varchar("order_id", { length: 36 }),
	action: varchar({ length: 64 }).notNull(),
	userWeight: numeric("user_weight", { precision: 10, scale:  2 }).default('0').notNull(),
	prizeId: varchar("prize_id", { length: 36 }),
	prizeName: varchar("prize_name", { length: 128 }),
	isWinner: boolean("is_winner").default(false).notNull(),
	ipAddress: varchar("ip_address", { length: 45 }).default('').notNull(),
	userAgent: text("user_agent"),
	detail: jsonb(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("lottery_logs_action_idx").using("btree", table.action.asc().nullsLast().op("text_ops")),
	index("lottery_logs_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("lottery_logs_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const lotterySettings = pgTable("lottery_settings", {
	settingKey: varchar("setting_key", { length: 64 }).primaryKey().notNull(),
	settingValue: text("setting_value").notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const orders = pgTable("orders", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	nickName: varchar("nick_name", { length: 128 }),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	packageId: varchar("package_id", { length: 36 }),
	packageName: varchar("package_name", { length: 128 }).notNull(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	originalPrice: numeric("original_price", { precision: 10, scale:  2 }),
	status: varchar({ length: 20 }).default('pending').notNull(),
	shared: boolean().default(false).notNull(),
	quantity: integer().default(1).notNull(),
	verifiedCount: integer("verified_count").default(0).notNull(),
	verificationCode: varchar("verification_code", { length: 20 }),
	verifiedAt: timestamp("verified_at", { withTimezone: true, mode: 'string' }),
	expireAt: timestamp("expire_at", { withTimezone: true, mode: 'string' }),
	shopName: varchar("shop_name", { length: 128 }),
	orderNo: varchar("order_no", { length: 64 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	couponRecordId: text("coupon_record_id"),
	couponDiscount: numeric("coupon_discount", { precision: 10, scale:  2 }),
	verifiedBy: text("verified_by"),
	refundAmount: numeric("refund_amount", { precision: 10, scale:  2 }),
	payAmount: numeric("pay_amount", { precision: 10, scale:  2 }),
	originalAmount: numeric("original_amount", { precision: 10, scale:  2 }),
	discountAmount: numeric("discount_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	paidAt: timestamp("paid_at", { withTimezone: true, mode: 'string' }),
	payExpireAt: timestamp("pay_expire_at", { withTimezone: true, mode: 'string' }),
	refundedQuantity: integer("refunded_quantity").default(0).notNull(),
	pointsAwarded: integer("points_awarded").default(0).notNull(),
}, (table) => [
	index("orders_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("orders_package_id_idx").using("btree", table.packageId.asc().nullsLast().op("text_ops")),
	index("orders_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("orders_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.packageId],
			foreignColumns: [packages.id],
			name: "orders_package_id_fkey"
		}),
]);

export const merchants = pgTable("merchants", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 128 }).notNull(),
	logo: varchar({ length: 512 }),
	images: jsonb(),
	address: text(),
	phone: varchar({ length: 20 }),
	businessHours: varchar("business_hours", { length: 128 }),
	category: varchar({ length: 64 }),
	description: text(),
	latitude: varchar({ length: 20 }),
	longitude: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	settlementType: integer("settlement_type"),
	commissionRate: numeric("commission_rate", { precision: 5, scale:  2 }),
	settlementPrice: numeric("settlement_price", { precision: 10, scale:  2 }),
	wifiSsid: varchar("wifi_ssid", { length: 64 }),
	wifiPassword: varchar("wifi_password", { length: 64 }),
	merchantCode: varchar("merchant_code"),
	marketingFeatures: jsonb("marketing_features").default({"wifi":true}),
	wifiEnabled: boolean("wifi_enabled").default(false),
}, (table) => [
	unique("merchants_merchant_code_key").on(table.merchantCode),
]);

export const packages = pgTable("packages", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	merchantId: varchar("merchant_id", { length: 36 }),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	originalPrice: numeric("original_price", { precision: 10, scale:  2 }),
	badge: varchar({ length: 64 }),
	features: text(),
	coverImage: varchar("cover_image", { length: 512 }),
	environmentImages: text("environment_images"),
	stock: integer().default(0).notNull(),
	saleStartDate: varchar("sale_start_date", { length: 20 }),
	saleEndDate: varchar("sale_end_date", { length: 20 }),
	autoRenew: boolean("auto_renew").default(false).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	purchaseLimit: integer("purchase_limit"),
	purchaseLimitType: varchar("purchase_limit_type", { length: 20 }),
	purchaseLimitPerPerson: integer("purchase_limit_per_person"),
	purchaseLimitPerDay: integer("purchase_limit_per_day"),
	purchaseLimitPerMonth: integer("purchase_limit_per_month"),
	validDays: integer("valid_days"),
	validFromPurchase: boolean("valid_from_purchase"),
	validDateType: varchar("valid_date_type", { length: 20 }),
	validDateStart: varchar("valid_date_start", { length: 20 }),
	validDateEnd: varchar("valid_date_end", { length: 20 }),
	unavailableDates: jsonb("unavailable_dates"),
	unavailableDateType: varchar("unavailable_date_type", { length: 20 }),
	unavailableWeekdays: jsonb("unavailable_weekdays"),
	unavailableHolidays: jsonb("unavailable_holidays"),
	availableTimeType: varchar("available_time_type", { length: 20 }),
	availableTimeStart: varchar("available_time_start", { length: 10 }),
	availableTimeEnd: varchar("available_time_end", { length: 10 }),
	limitUsageCount: boolean("limit_usage_count"),
	usageCountLimit: integer("usage_count_limit"),
	needReservation: boolean("need_reservation"),
	reservationHours: integer("reservation_hours"),
	otherDiscount: text("other_discount"),
	privateRoom: varchar("private_room", { length: 20 }),
	dineInType: varchar("dine_in_type", { length: 20 }),
	hasExtraFee: boolean("has_extra_fee"),
	extraFees: jsonb("extra_fees"),
	otherNotes: text("other_notes"),
	category: varchar({ length: 64 }),
	packageType: varchar("package_type", { length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	combinations: jsonb(),
}, (table) => [
	index("packages_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	index("packages_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("packages_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("text_ops")),
]);

export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	nickName: varchar("nick_name", { length: 128 }),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	phone: varchar({ length: 20 }),
	password: varchar({ length: 255 }),
	loginType: varchar("login_type", { length: 20 }).default('wechat').notNull(),
	openId: varchar("open_id", { length: 128 }),
	gender: varchar({ length: 10 }).default('unknown').notNull(),
	birthday: varchar({ length: 20 }),
	memberLevel: varchar("member_level", { length: 20 }).default('normal').notNull(),
	points: integer().default(0).notNull(),
	totalOrders: integer("total_orders").default(0).notNull(),
	totalSpent: numeric("total_spent", { precision: 12, scale:  2 }).default('0').notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	role: varchar({ length: 20 }).default('consumer').notNull(),
	merchantId: integer("merchant_id"),
	shareCount: integer("share_count").default(0).notNull(),
	socialPostCount: integer("social_post_count").default(0).notNull(),
	lastLoginAt: timestamp("last_login_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("users_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	index("users_phone_idx").using("btree", table.phone.asc().nullsLast().op("text_ops")),
	index("users_role_idx").using("btree", table.role.asc().nullsLast().op("text_ops")),
	index("users_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	unique("users_phone_unique").on(table.phone),
]);

export const prizes = pgTable("prizes", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	name: varchar({ length: 128 }).notNull(),
	description: text(),
	probability: numeric({ precision: 10, scale:  4 }).default('0').notNull(),
	imageUrl: varchar("image_url", { length: 512 }),
	stock: integer().default(0).notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	prizeType: varchar("prize_type", { length: 20 }).default('coupon').notNull(),
	couponAmount: numeric("coupon_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	couponMinSpend: numeric("coupon_min_spend", { precision: 10, scale:  2 }).default('0').notNull(),
	productName: varchar("product_name", { length: 128 }).default('').notNull(),
	productValue: numeric("product_value", { precision: 10, scale:  2 }).default('0').notNull(),
	merchantId: integer("merchant_id"),
	validityHours: integer("validity_hours"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
	dailyQuota: integer("daily_quota"),
	isFallback: boolean("is_fallback").default(false),
	discountRate: numeric("discount_rate", { precision: 4, scale:  1 }).default('0').notNull(),
	discountCap: numeric("discount_cap", { precision: 10, scale:  2 }).default('0').notNull(),
}, (table) => [
	index("prizes_is_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("prizes_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	index("prizes_stock_idx").using("btree", table.stock.asc().nullsLast().op("int4_ops")),
]);

export const customerServiceConfig = pgTable("customer_service_config", {
	id: serial().primaryKey().notNull(),
	enabled: boolean().default(true),
	qrcodeUrl: varchar("qrcode_url", { length: 500 }),
	title: varchar({ length: 64 }).default('联系客服'),
	welcomeText: varchar("welcome_text", { length: 255 }).default('扫码添加客服企业微信，有问题随时找我们'),
	serviceId: varchar("service_id", { length: 64 }),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	communityEnabled: boolean("community_enabled").default(false),
	communityTitle: varchar("community_title").default('加店长领券享88折'),
	communitySubtitle: varchar("community_subtitle").default('进群抽免单，天天享9折'),
	communityButtonText: varchar("community_button_text").default('长按识别二维码加店长'),
	communityQrcodeUrl: varchar("community_qrcode_url"),
});

export const distributionConfigs = pgTable("distribution_configs", {
	id: serial().primaryKey().notNull(),
	enabled: boolean().default(true),
	level1Rate: numeric("level1_rate", { precision: 5, scale:  2 }).default('10.00'),
	level2Rate: numeric("level2_rate", { precision: 5, scale:  2 }).default('5.00'),
	level3Rate: numeric("level3_rate", { precision: 5, scale:  2 }).default('2.00'),
	minWithdraw: numeric("min_withdraw", { precision: 10, scale:  2 }).default('10.00'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	bindExpireDays: integer("bind_expire_days").default(0),
	merchantRate: numeric("merchant_rate").default('70'),
	poolRate: numeric("pool_rate").default('20'),
	platformRate: numeric("platform_rate").default('10'),
	coolingDays: integer("cooling_days").default(7),
});

export const withdrawalRecords = pgTable("withdrawal_records", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	amount: numeric({ precision: 10, scale:  2 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	failureReason: text("failure_reason"),
	requestedAt: timestamp("requested_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	paymentProofImage: text("payment_proof_image"),
	paymentTransactionNo: varchar("payment_transaction_no", { length: 100 }),
	paymentProofNote: text("payment_proof_note"),
});

export const distributionWithdraws = pgTable("distribution_withdraws", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	amount: numeric({ precision: 12, scale:  2 }).notNull(),
	status: varchar({ length: 16 }).default('pending'),
	rejectReason: varchar("reject_reason", { length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	processedAt: timestamp("processed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("idx_dist_withdraws_user").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const orchardRecords = pgTable("orchard_records", {
	id: varchar({ length: 36 }).default(sql`(gen_random_uuid())::text`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	amount: integer().default(0).notNull(),
	reason: varchar({ length: 30 }).notNull(),
	remark: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("orchard_records_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const settlementRecords = pgTable("settlement_records", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderId: varchar("order_id").notNull(),
	merchantId: integer("merchant_id").notNull(),
	packageId: varchar("package_id").notNull(),
	orderAmount: numeric("order_amount", { precision: 10, scale:  2 }).notNull(),
	settlementType: integer("settlement_type").notNull(),
	commissionRate: numeric("commission_rate", { precision: 5, scale:  2 }).default('0'),
	commissionAmount: numeric("commission_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	settlementAmount: numeric("settlement_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	settlementDate: date("settlement_date").notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	settledAt: timestamp("settled_at", { withTimezone: true, mode: 'string' }),
	withdrawnAt: timestamp("withdrawn_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	verifiedQty: integer("verified_qty").default(0).notNull(),
	rebateAmount: numeric("rebate_amount", { precision: 10, scale:  2 }).default('0').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "settlement_records_order_id_fkey"
		}),
	foreignKey({
			columns: [table.packageId],
			foreignColumns: [packages.id],
			name: "settlement_records_package_id_fkey"
		}),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "settlement_records_merchant_id_fkey"
		}),
	unique("settlement_records_order_id_key").on(table.orderId),
]);

export const notificationRemindLogs = pgTable("notification_remind_logs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	remindType: varchar("remind_type").notNull(),
	targetId: varchar("target_id").notNull(),
	remindPoint: varchar("remind_point").notNull(),
	sentAt: timestamp("sent_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("notification_remind_logs_remind_type_target_id_remind_point_key").on(table.remindType, table.targetId, table.remindPoint),
]);

export const notifications = pgTable("notifications", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id").notNull(),
	type: varchar().notNull(),
	title: varchar().notNull(),
	content: text().notNull(),
	data: jsonb(),
	isRead: boolean("is_read").default(false),
	wechatSent: boolean("wechat_sent").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_notifications_user").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.isRead.asc().nullsLast().op("bool_ops"), table.createdAt.desc().nullsFirst().op("bool_ops")),
]);

export const distributionCommissions = pgTable("distribution_commissions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	orderNo: varchar("order_no", { length: 64 }).notNull(),
	buyerId: varchar("buyer_id", { length: 64 }).notNull(),
	beneficiaryId: varchar("beneficiary_id", { length: 64 }).notNull(),
	level: smallint().notNull(),
	orderAmount: numeric("order_amount", { precision: 12, scale:  2 }).notNull(),
	commissionAmount: numeric("commission_amount", { precision: 12, scale:  2 }).notNull(),
	status: varchar({ length: 16 }).default('settled'),
	remark: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	settleStatus: varchar("settle_status").default('settled'),
	availableAt: timestamp("available_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_dist_commissions_beneficiary").using("btree", table.beneficiaryId.asc().nullsLast().op("text_ops"), table.status.asc().nullsLast().op("text_ops")),
	uniqueIndex("uq_dist_commissions_order_level").using("btree", table.orderNo.asc().nullsLast().op("int2_ops"), table.beneficiaryId.asc().nullsLast().op("int2_ops"), table.level.asc().nullsLast().op("int2_ops")),
]);

export const merchantMarketingActivities = pgTable("merchant_marketing_activities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	type: varchar({ length: 50 }).default('coupon').notNull(),
	title: varchar({ length: 200 }).notNull(),
	status: varchar({ length: 20 }).default('draft').notNull(),
	startTime: timestamp("start_time", { withTimezone: true, mode: 'string' }),
	endTime: timestamp("end_time", { withTimezone: true, mode: 'string' }),
	config: jsonb().default({}).notNull(),
	description: text(),
	sortOrder: integer("sort_order").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("merchant_marketing_activities_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	index("merchant_marketing_activities_sort_idx").using("btree", table.sortOrder.asc().nullsLast().op("int4_ops")),
	index("merchant_marketing_activities_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "merchant_marketing_activities_merchant_id_fkey"
		}).onDelete("cascade"),
]);

export const distributionMembers = pgTable("distribution_members", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 64 }).notNull(),
	inviterId: varchar("inviter_id", { length: 64 }),
	status: varchar({ length: 16 }).default('active'),
	totalCommission: numeric("total_commission", { precision: 12, scale:  2 }).default('0'),
	availableCommission: numeric("available_commission", { precision: 12, scale:  2 }).default('0'),
	withdrawnCommission: numeric("withdrawn_commission", { precision: 12, scale:  2 }).default('0'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	boundAt: timestamp("bound_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	pendingCommission: numeric("pending_commission").default('0'),
}, (table) => [
	index("idx_dist_members_inviter").using("btree", table.inviterId.asc().nullsLast().op("text_ops")),
	unique("distribution_members_user_id_key").on(table.userId),
]);

export const orchardUsers = pgTable("orchard_users", {
	userId: varchar("user_id", { length: 128 }).primaryKey().notNull(),
	growth: integer().default(0).notNull(),
	stage: integer().default(0).notNull(),
	harvested: integer().default(0).notNull(),
	availableTrees: integer("available_trees").default(0).notNull(),
	plantedAt: timestamp("planted_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	cycleMakeupUsed: integer("cycle_makeup_used").default(0).notNull(),
	treeHistory: jsonb("tree_history").default([]).notNull(),
	wateredDates: jsonb("watered_dates").default([]).notNull(),
	currentStreak: integer("current_streak").default(0).notNull(),
	maxStreak: integer("max_streak").default(0).notNull(),
	lastWaterDate: varchar("last_water_date", { length: 20 }),
	makeupCards: integer("makeup_cards").default(0).notNull(),
	tasksState: jsonb("tasks_state").default({}).notNull(),
	taskDate: varchar("task_date", { length: 20 }),
	mealsClaimed: jsonb("meals_claimed").default({}).notNull(),
	mealsDate: varchar("meals_date", { length: 20 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const merchantCommunityConfigs = pgTable("merchant_community_configs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	enabled: boolean().default(false).notNull(),
	title: varchar({ length: 200 }).default('加店长领券享88折').notNull(),
	subtitle: varchar({ length: 200 }).default('进群抽免单，天天享9折').notNull(),
	buttonText: varchar("button_text", { length: 200 }).default('长按识别二维码加店长').notNull(),
	qrcodeUrl: text("qrcode_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("merchant_community_configs_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "merchant_community_configs_merchant_id_fkey"
		}).onDelete("cascade"),
	unique("merchant_community_configs_merchant_id_key").on(table.merchantId),
]);

export const lotteryRateLimits = pgTable("lottery_rate_limits", {
	ipAddress: varchar("ip_address", { length: 45 }).primaryKey().notNull(),
	requestCount: integer("request_count").default(1).notNull(),
	windowStart: timestamp("window_start", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const wechatConfig = pgTable("wechat_config", {
	id: integer().default(1).primaryKey().notNull(),
	appid: text().default(''),
	secret: text().default(''),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	mchId: text("mch_id").default(''),
	mchSerialNo: text("mch_serial_no").default(''),
	privateKey: text("private_key").default(''),
	apiV3Key: text("api_v3_key").default(''),
	payPublicKey: text("pay_public_key").default(''),
	payPublicKeyId: text("pay_public_key_id").default(''),
	payNotifyUrl: text("pay_notify_url").default(''),
}, (table) => [
	check("single_row", sql`id = 1`),
]);

export const teamLotteryMembers = pgTable("team_lottery_members", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	groupId: varchar("group_id", { length: 36 }).notNull(),
	userId: varchar("user_id", { length: 128 }).notNull(),
	orderId: varchar("order_id", { length: 36 }),
	lotteryRecordId: varchar("lottery_record_id", { length: 36 }),
	isWinner: boolean("is_winner").default(false).notNull(),
	prizeId: varchar("prize_id", { length: 36 }),
	prizeName: varchar("prize_name", { length: 128 }),
	prizeType: varchar("prize_type", { length: 20 }),
	redemptionCode: varchar("redemption_code", { length: 64 }),
	couponCode: varchar("coupon_code", { length: 32 }),
	refundAmount: numeric("refund_amount", { precision: 10, scale:  2 }).default('0').notNull(),
	drewAt: timestamp("drew_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("team_lottery_members_group_id_idx").using("btree", table.groupId.asc().nullsLast().op("text_ops")),
	index("team_lottery_members_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [teamLotteryGroups.id],
			name: "team_lottery_members_group_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "team_lottery_members_order_id_fkey"
		}).onDelete("set null"),
	unique("team_lottery_members_group_user_key").on(table.groupId, table.userId),
]);

export const merchantTeamLotteryConfigs = pgTable("merchant_team_lottery_configs", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	enabled: boolean().default(false).notNull(),
	teamSize: integer("team_size").default(3).notNull(),
	durationHours: integer("duration_hours").default(24).notNull(),
	leaderPrizeId: varchar("leader_prize_id", { length: 36 }),
	memberPrizeIds: jsonb("member_prize_ids").default([]).notNull(),
	shareTitle: varchar("share_title", { length: 120 }).default('组队抽奖，免费抽大奖').notNull(),
	shareDesc: varchar("share_desc", { length: 240 }).default('好友组队，满员开奖，100%中奖').notNull(),
	shareImageUrl: varchar("share_image_url", { length: 512 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	logoImageUrl: varchar("logo_image_url", { length: 512 }),
	leaderBonusPrizeIds: jsonb("leader_bonus_prize_ids").default([]).notNull(),
	leaderBonusRate: integer("leader_bonus_rate").default(0).notNull(),
}, (table) => [
	index("merchant_team_lottery_configs_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "merchant_team_lottery_configs_merchant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leaderPrizeId],
			foreignColumns: [prizes.id],
			name: "merchant_team_lottery_configs_leader_prize_id_fkey"
		}).onDelete("set null"),
	unique("merchant_team_lottery_configs_merchant_id_key").on(table.merchantId),
]);

export const teamLotteryGroups = pgTable("team_lottery_groups", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	merchantId: integer("merchant_id").notNull(),
	packageId: varchar("package_id", { length: 36 }).notNull(),
	leaderOrderId: varchar("leader_order_id", { length: 36 }).notNull(),
	leaderUserId: varchar("leader_user_id", { length: 128 }).notNull(),
	teamSize: integer("team_size").notNull(),
	currentCount: integer("current_count").default(1).notNull(),
	status: varchar({ length: 20 }).default('active').notNull(),
	leaderRefunded: boolean("leader_refunded").default(false).notNull(),
	expiresAt: timestamp("expires_at", { withTimezone: true, mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	inviteCode: varchar("invite_code", { length: 32 }),
}, (table) => [
	index("team_lottery_groups_expires_at_idx").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("team_lottery_groups_leader_user_id_idx").using("btree", table.leaderUserId.asc().nullsLast().op("text_ops")),
	index("team_lottery_groups_merchant_id_idx").using("btree", table.merchantId.asc().nullsLast().op("int4_ops")),
	index("team_lottery_groups_package_id_idx").using("btree", table.packageId.asc().nullsLast().op("text_ops")),
	index("team_lottery_groups_status_idx").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.merchantId],
			foreignColumns: [merchants.id],
			name: "team_lottery_groups_merchant_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.packageId],
			foreignColumns: [packages.id],
			name: "team_lottery_groups_package_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leaderOrderId],
			foreignColumns: [orders.id],
			name: "team_lottery_groups_leader_order_id_fkey"
		}).onDelete("cascade"),
	unique("team_lottery_groups_leader_order_id_key").on(table.leaderOrderId),
	unique("team_lottery_groups_invite_code_key").on(table.inviteCode),
]);
