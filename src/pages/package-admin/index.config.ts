export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商品创建',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black'
    })
  : {
      navigationBarTitleText: '商品创建',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black'
    }
