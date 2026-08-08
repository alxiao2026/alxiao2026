export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '套餐详情',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    })
  : {
      navigationBarTitleText: '套餐详情',
      navigationBarBackgroundColor: '#FF4757',
      navigationBarTextStyle: 'white',
      enableShareAppMessage: true,
      enableShareTimeline: true,
    }
