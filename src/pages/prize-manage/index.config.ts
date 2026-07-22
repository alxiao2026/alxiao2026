export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '奖品管理', navigationStyle: 'custom' })
  : { navigationBarTitleText: '奖品管理', navigationStyle: 'custom' }
