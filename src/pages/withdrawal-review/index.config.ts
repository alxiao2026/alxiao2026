export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '提现审核',
      enablePullDownRefresh: true,
    })
  : { navigationBarTitleText: '提现审核', enablePullDownRefresh: true }
