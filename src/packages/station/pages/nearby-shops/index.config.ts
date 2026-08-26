export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '附近好店',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    })
  : {
      navigationBarTitleText: '附近好店',
      navigationBarBackgroundColor: '#FFB347',
      navigationBarTextStyle: 'black',
      backgroundColor: '#F7F8FA',
    }
