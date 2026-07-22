export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '抽奖设置', navigationStyle: 'custom' })
  : { navigationBarTitleText: '抽奖设置', navigationStyle: 'custom' }
