export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '一键连WiFi',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      backgroundColor: '#F9FAFB',
    })
  : {
      navigationBarTitleText: '一键连WiFi',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      backgroundColor: '#F9FAFB',
    }
