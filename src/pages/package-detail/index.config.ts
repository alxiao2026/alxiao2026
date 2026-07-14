export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '套餐详情',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    })
  : {
      navigationBarTitleText: '套餐详情',
      navigationBarBackgroundColor: '#ffffff',
      navigationBarTextStyle: 'black',
    }
