export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '玩法规则' })
  : { navigationBarTitleText: '玩法规则' }
