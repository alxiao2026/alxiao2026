export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '团购创建',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black'
    })
  : {
      navigationBarTitleText: '团购创建',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black'
    }
