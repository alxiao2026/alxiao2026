export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '查件跳转',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
    })
  : {
      navigationBarTitleText: '查件跳转',
      navigationBarBackgroundColor: '#000000',
      navigationBarTextStyle: 'white',
      backgroundColor: '#000000',
    }
