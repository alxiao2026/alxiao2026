export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '奖品管理' })
  : { navigationBarTitleText: '奖品管理' }
