import { relations } from "drizzle-orm/relations";
import { prizes, lotteryRecords, packages, orders, settlementRecords, merchants, merchantMarketingActivities, merchantCommunityConfigs, teamLotteryGroups, teamLotteryMembers, merchantTeamLotteryConfigs } from "./schema";

export const lotteryRecordsRelations = relations(lotteryRecords, ({one}) => ({
	prize: one(prizes, {
		fields: [lotteryRecords.prizeId],
		references: [prizes.id]
	}),
}));

export const prizesRelations = relations(prizes, ({many}) => ({
	lotteryRecords: many(lotteryRecords),
	merchantTeamLotteryConfigs: many(merchantTeamLotteryConfigs),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	package: one(packages, {
		fields: [orders.packageId],
		references: [packages.id]
	}),
	settlementRecords: many(settlementRecords),
	teamLotteryMembers: many(teamLotteryMembers),
	teamLotteryGroups: many(teamLotteryGroups),
}));

export const packagesRelations = relations(packages, ({many}) => ({
	orders: many(orders),
	settlementRecords: many(settlementRecords),
	teamLotteryGroups: many(teamLotteryGroups),
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
	merchantMarketingActivities: many(merchantMarketingActivities),
	merchantCommunityConfigs: many(merchantCommunityConfigs),
	merchantTeamLotteryConfigs: many(merchantTeamLotteryConfigs),
	teamLotteryGroups: many(teamLotteryGroups),
}));

export const merchantMarketingActivitiesRelations = relations(merchantMarketingActivities, ({one}) => ({
	merchant: one(merchants, {
		fields: [merchantMarketingActivities.merchantId],
		references: [merchants.id]
	}),
}));

export const merchantCommunityConfigsRelations = relations(merchantCommunityConfigs, ({one}) => ({
	merchant: one(merchants, {
		fields: [merchantCommunityConfigs.merchantId],
		references: [merchants.id]
	}),
}));

export const teamLotteryMembersRelations = relations(teamLotteryMembers, ({one}) => ({
	teamLotteryGroup: one(teamLotteryGroups, {
		fields: [teamLotteryMembers.groupId],
		references: [teamLotteryGroups.id]
	}),
	order: one(orders, {
		fields: [teamLotteryMembers.orderId],
		references: [orders.id]
	}),
}));

export const teamLotteryGroupsRelations = relations(teamLotteryGroups, ({one, many}) => ({
	teamLotteryMembers: many(teamLotteryMembers),
	merchant: one(merchants, {
		fields: [teamLotteryGroups.merchantId],
		references: [merchants.id]
	}),
	package: one(packages, {
		fields: [teamLotteryGroups.packageId],
		references: [packages.id]
	}),
	order: one(orders, {
		fields: [teamLotteryGroups.leaderOrderId],
		references: [orders.id]
	}),
}));

export const merchantTeamLotteryConfigsRelations = relations(merchantTeamLotteryConfigs, ({one}) => ({
	merchant: one(merchants, {
		fields: [merchantTeamLotteryConfigs.merchantId],
		references: [merchants.id]
	}),
	prize: one(prizes, {
		fields: [merchantTeamLotteryConfigs.leaderPrizeId],
		references: [prizes.id]
	}),
}));