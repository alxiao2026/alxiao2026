export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '附近热点',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F9FAFB',
    })
  : {
      navigationBarTitleText: '附近热点',
      navigationBarBackgroundColor: '#FFFFFF',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F9FAFB',
    }
