export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '分销中心',
      enableShareAppMessage: true,
      enableShareTimeline: true
    })
  : {
      navigationBarTitleText: '分销中心',
      enableShareAppMessage: true,
      enableShareTimeline: true
    }
