export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '营销模块管理',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '营销模块管理',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    }
