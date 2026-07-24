export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '抽奖记录' })
  : { navigationBarTitleText: '抽奖记录' }
