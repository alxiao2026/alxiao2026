export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商品管理',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '商品管理',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    }
