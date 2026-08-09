export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '搞钱中心',
      navigationBarBackgroundColor: '#12101F',
      navigationBarTextStyle: 'white',
      backgroundColor: '#12101F',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '搞钱中心',
      navigationBarBackgroundColor: '#12101F',
      navigationBarTextStyle: 'white',
      backgroundColor: '#12101F',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
