export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '团团',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '团团',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
