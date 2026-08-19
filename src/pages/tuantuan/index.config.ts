export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的果园',
      navigationBarBackgroundColor: '#38BDF8',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '我的果园',
      navigationBarBackgroundColor: '#38BDF8',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
