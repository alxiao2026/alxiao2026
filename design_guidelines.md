# 有奖销售小程序 - 设计指南

## 品牌定位
- **应用定位**：微信小程序 - 有奖销售工具，用户下单基础套餐后，分享给好友即可开奖
- **设计风格**：热闹、喜庆、期待感，像线下商场的"幸运转盘"促销区
- **目标用户**：微信用户，追求购物惊喜感

## 配色方案
- **主色 - 红橙**：`bg-red-500` / `text-red-500` (#FF4757) — 促销热烈感
- **辅色 - 金色**：`bg-orange-400` / `text-orange-400` (#FFA502) — 奖品质感
- **品牌底色**：`bg-gray-800` / `text-gray-800` (#2F3542)
- **页面背景**：`bg-gray-50` (#F8F9FA)
- **卡片背景**：`bg-white` + 柔和阴影
- **成功色**：`bg-green-400` / `text-green-400` (#2ED573)
- **文字主色**：`text-gray-800` (#2F3542)
- **文字辅色**：`text-gray-500` (#747D8C)

## 字体规范
- H1: text-2xl font-bold
- H2: text-xl font-semibold
- H3: text-lg font-semibold
- Body: text-sm
- Caption: text-xs text-gray-500

## 间距系统
- 页面边距：p-4
- 卡片内边距：p-4 / p-6
- 组件间距：gap-3 / gap-4
- 列表间距：gap-3

## 组件使用原则
- **通用组件优先用 `@/components/ui/*`**：Button、Card、Dialog、Badge、Input、Toast、Skeleton 等
- **禁止用 View/Text 手搓**：按钮、输入框、弹窗、卡片等通用组件
- **图标使用 lucide-react-taro**：Gift、Share2、Trophy、Star、Zap 等
- **Taro 原生组件**：仅用于 View、Text、Image、ScrollView 等容器/媒体组件

## 导航结构
- 单页面应用，无需 TabBar
- 首页：套餐展示 + 下单 + 抽奖入口
- 抽奖页：弹层形式在首页展示
- 管理页：单独页面用于配置奖品概率

## 小程序约束
- 图片使用 TOS 对象存储，不打包进项目
- 包体积控制：主包 < 2MB
- 分享功能：使用 Taro 的 useShareAppMessage 钩子