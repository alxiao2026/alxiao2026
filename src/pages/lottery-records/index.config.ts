export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '中奖记录',
    })
  : { navigationBarTitleText: '中奖记录' }
