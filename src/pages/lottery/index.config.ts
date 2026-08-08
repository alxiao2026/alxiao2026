export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '膨胀盲盒',
      navigationBarBackgroundColor: '#FF6B4A',
      navigationBarTextStyle: 'white',
      backgroundColor: '#FFF3CC',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : {
      navigationBarTitleText: '膨胀盲盒',
      navigationBarBackgroundColor: '#FF6B4A',
      navigationBarTextStyle: 'white',
      backgroundColor: '#FFF3CC',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    }
