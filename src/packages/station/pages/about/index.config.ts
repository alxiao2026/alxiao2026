export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '我的驿站',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    })
  : {
      navigationBarTitleText: '我的驿站',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    }
