export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的果园',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '我的果园',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
