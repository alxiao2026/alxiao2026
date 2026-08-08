export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'black',
      backgroundColor: '#ffffff',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'black',
      backgroundColor: '#ffffff',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
