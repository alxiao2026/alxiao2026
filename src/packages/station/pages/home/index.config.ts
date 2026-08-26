export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '驿站查件',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    })
  : {
      navigationBarTitleText: '驿站查件',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    }
