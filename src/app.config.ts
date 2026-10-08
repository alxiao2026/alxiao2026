export default defineAppConfig({
  pages: [
    // ===== 主包：TabBar 页 + 用户主流程页（分享/扫码入口）=====
    'pages/index/index',
    'pages/tuantuan/index',
    'pages/user-center/index',
    'pages/login/index',
    'pages/merchant/index',
    'pages/package-detail/index',
    'pages/order-list/index',
    'pages/order-detail/index',
    'pages/order-details/index',
    'pages/refund-apply/index',
    'pages/profile-edit/index',
    'pages/lottery/index',
    'pages/lottery-records/index',
    'pages/notification-center/index',
    'pages/distribution/index',
    'pages/team-lottery/index',
    'pages/agreement/index',
    'pages/privacy/index'
  ],
  subPackages: [
    // ===== 分包：后台管理页 =====
    { root: 'pages/admin', pages: ['index'] },
    { root: 'pages/package-admin', pages: ['index'] },
    { root: 'pages/merchant-admin', pages: ['index'] },
    { root: 'pages/merchant-qualification', pages: ['index'] },
    { root: 'pages/verification', pages: ['index'] },
    { root: 'pages/product-manage', pages: ['index'] },
    { root: 'pages/prize-manage', pages: ['index'] },
    { root: 'pages/lottery-settings', pages: ['index'] },
    { root: 'pages/admin-lottery-records', pages: ['index'] },
    { root: 'pages/admin-orders', pages: ['index'] },
    { root: 'pages/package-settlement-config', pages: ['index'] },
    { root: 'pages/merchant-balance', pages: ['index'] },
    { root: 'pages/settlement-records', pages: ['index'] },
    { root: 'pages/withdrawal-review', pages: ['index'] },
    { root: 'pages/notify-template-config', pages: ['index'] },
    { root: 'pages/wechat-config', pages: ['index'] },
    { root: 'pages/platform-commission', pages: ['index'] },
    { root: 'pages/distribution-audit', pages: ['index'] },
    { root: 'pages/customer-service-admin', pages: ['index'] },
    { root: 'pages/merchant-marketing', pages: ['index'] },
    { root: 'pages/marketing-config', pages: ['index'] },
    // ===== 分包：果园模块 =====
    { root: 'pages/orchard-tasks', pages: ['index'] },
    { root: 'pages/orchard-coupons', pages: ['index'] },
    { root: 'pages/orchard-me', pages: ['index'] },
    { root: 'pages/orchard-points', pages: ['index'] },
    { root: 'pages/orchard-exchange', pages: ['index'] },
    { root: 'pages/orchard-assist', pages: ['index'] },
    { root: 'pages/orchard-help', pages: ['index'] },
    { root: 'pages/orchard-admin', pages: ['index'] },
    // ===== 分包：WiFi 模块 =====
    { root: 'pages/wifi', pages: ['index'] },
    { root: 'pages/wifi-nearby', pages: ['index'] },
    // ===== 独立分包：驿站快递查询（物理隔离，不依赖主包状态/账号/请求层）=====
    { root: 'packages/station', pages: ['pages/home/index', 'pages/transition/index', 'pages/about/index', 'pages/nearby-shops/index', 'pages/admin/index'] }
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FF4757',
    navigationBarTitleText: '有奖销售',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    custom: true,
    color: '#9CA3AF',
    selectedColor: '#FF4757',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/tabbar/house.png',
        selectedIconPath: './assets/tabbar/house-active.png'
      },
      {
        pagePath: 'pages/tuantuan/index',
        text: '团团',
        iconPath: './assets/tabbar/tuantuan.png',
        selectedIconPath: './assets/tabbar/tuantuan-active.png'
      },
      {
        pagePath: 'pages/user-center/index',
        text: '我的',
        iconPath: './assets/tabbar/user.png',
        selectedIconPath: './assets/tabbar/user-active.png'
      }
    ]
  },
  permission: {
    'scope.userLocation': {
      desc: '用于展示您与门店的距离并提供到店导航服务'
    }
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation']
})
