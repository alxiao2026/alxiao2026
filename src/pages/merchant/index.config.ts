export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商家首页',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : { navigationBarTitleText: '商家首页', enableShareAppMessage: true, enableShareTimeline: true }
