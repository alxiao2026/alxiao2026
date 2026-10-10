export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '组队抽盲盒',
      navigationBarBackgroundColor: '#FF6B1A',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '组队抽盲盒',
      navigationBarBackgroundColor: '#FF6B1A',
      navigationBarTextStyle: 'white',
    }
