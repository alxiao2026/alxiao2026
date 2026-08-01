export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'black',
      backgroundColor: '#ffffff'
    })
  : {
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom',
      navigationBarTextStyle: 'black',
      backgroundColor: '#ffffff'
    }
