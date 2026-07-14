export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '有奖销售' })
  : { navigationBarTitleText: '有奖销售' }