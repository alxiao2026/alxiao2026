import { relations } from "drizzle-orm/relations";
import { prizes, lotteryRecords, packages, orders, settlementRecords, merchants } from "./schema";

export const lotteryRecordsRelations = relations(lotteryRecords, ({one}) => ({
	prize: one(prizes, {
		fields: [lotteryRecords.prizeId],
		references: [prizes.id]
	}),
}));

export const prizesRelations = relations(prizes, ({many}) => ({
	lotteryRecords: many(lotteryRecords),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	package: one(packages, {
		fields: [orders.packageId],
		references: [packages.id]
	}),
	settlementRecords: many(settlementRecords),
}));

export const packagesRelations = relations(packages, ({many}) => ({
	orders: many(orders),
	settlementRecords: many(settlementRecords),
}));

export const settlementRecordsRelations = relations(settlementRecords, ({one}) => ({
	order: one(orders, {
		fields: [settlementRecords.orderId],
		references: [orders.id]
	}),
	package: one(packages, {
		fields: [settlementRecords.packageId],
		references: [packages.id]
	}),
	merchant: one(merchants, {
		fields: [settlementRecords.merchantId],
		references: [merchants.id]
	}),
}));

export const merchantsRelations = relations(merchants, ({many}) => ({
	settlementRecords: many(settlementRecords),
}));