# 膨胀团 - 设计指南

## 品牌定位
- **品牌名称**：膨胀团 — 越膨胀越惊喜！
- **应用定位**：微信小程序 - 有奖销售工具，用户下单基础套餐后，分享给好友即可开奖
- **设计风格**：热闹、喜庆、期待感，像线下商场的"幸运转盘"促销区
- **目标用户**：微信用户，追求购物惊喜感
- **Logo标识**：圆形膨胀团logo，展示在页面顶部横幅左侧

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

## WiFi 模块（波普流体风 Pop Fluid）
- **意象锚点**：便利店收银台旁的免费 WiFi 贴纸 — 轻松、即得、无负担的小确幸
- **气质**：软糖、气泡、跳跃；像把红金汽水倒在屏幕上
- **配色（融入膨胀团红金）**：
  - 主色 `#FF4757` 膨胀红 / 辅色 `#FFA502` 金（按钮、渐变气泡）
  - 流体渐变：`linear-gradient(135deg, #FF4757, #FFA502)` 大气泡；`#FFE5EC → #FFF7E6` 浅气泡
  - 成功色 `#2ED573`（对勾、FREE 标签）；页面底 `#F9FAFB`
- **软糖卡片**：圆角 rounded-[2rem]（≈28px+），柔和投影 `0 8px 24px rgba(255,71,87,0.12)`
- **超大 emoji**：📶 ⚡ ✓ 🎉 点缀，大标题 font-black text-3xl，数字/大字层级对比强烈
- **微动效（页面级 css keyframes）**：信号波扩散（scale+opacity 脉冲）、呼吸光晕（box-shadow 脉冲）、成功打勾弹入（spring scale）、彩屑下落、卡片依次弹入
- **按钮**：胶囊形 rounded-full，点击涟漪用 `:active` 缩放反馈
- **底部 tab**：模块内自定义 tab（首页/附近/我的），“我的”跳膨胀团个人中心
- **跨端**：WiFi API 仅小程序端可用（Taro.startWifi/connectWifi/getConnectedWifi/scanWifi），H5 端整模块降级提示