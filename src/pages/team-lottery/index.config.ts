export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '组队抽奖',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    })
  : {
      navigationBarTitleText: '组队抽奖',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
    }
