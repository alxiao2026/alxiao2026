export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商家首页',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
    })
  : { navigationBarTitleText: '商家首页', enableShareAppMessage: true }
