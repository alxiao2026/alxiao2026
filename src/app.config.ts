export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/tuantuan/index',
    'pages/user-center/index',
    'pages/admin/index',
    'pages/package-detail/index',
    'pages/package-admin/index',
    'pages/merchant-admin/index',
    'pages/merchant-qualification/index',
    'pages/order-list/index',
    'pages/order-detail/index',
    'pages/refund-apply/index',
    'pages/profile-edit/index',
    'pages/login/index',
    'pages/verification/index',
    'pages/product-manage/index',
    'pages/prize-manage/index',
    'pages/merchant/index',
    'pages/lottery-settings/index',
    'pages/order-details/index',
    'pages/lottery-records/index',
    'pages/admin-lottery-records/index',
    'pages/admin-orders/index',
    'pages/lottery/index',
    'pages/package-settlement-config/index',
    'pages/merchant-balance/index',
    'pages/settlement-records/index',
    'pages/withdrawal-review/index',
    'pages/notify-template-config/index',
    'pages/wechat-config/index',
    'pages/platform-commission/index',
    'pages/notification-center/index',
    'pages/distribution/index',
    'pages/distribution-audit/index',
    'pages/customer-service-admin/index',
    'pages/orchard/index',
    'pages/orchard-tasks/index',
    'pages/orchard-coupons/index',
    'pages/orchard-me/index',
    'pages/orchard-points/index',
    'pages/orchard-exchange/index',
    'pages/orchard-assist/index',
    'pages/orchard-help/index',
    'pages/orchard-admin/index'
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