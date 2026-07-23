export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '幸运盲盒',
      navigationBarBackgroundColor: '#1a0533',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '幸运盲盒',
      navigationBarBackgroundColor: '#1a0533',
      navigationBarTextStyle: 'white',
    }
