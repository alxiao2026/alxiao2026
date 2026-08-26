export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '一键连WiFi',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#FFF3F4',
    })
  : {
      navigationBarTitleText: '一键连WiFi',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#FFF3F4',
    }
