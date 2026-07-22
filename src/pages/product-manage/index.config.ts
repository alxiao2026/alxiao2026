export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商品管理',
      navigationBarBackgroundColor: '#2478E5',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '商品管理',
      navigationBarBackgroundColor: '#2478E5',
      navigationBarTextStyle: 'white',
    }
