export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '附近WiFi',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      backgroundColor: '#F9FAFB',
    })
  : {
      navigationBarTitleText: '附近WiFi',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      backgroundColor: '#F9FAFB',
    }
