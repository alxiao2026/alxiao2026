export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '团团',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white'
    })
  : {
      navigationBarTitleText: '团团',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white'
    }
