export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '果园设置后台' })
  : { navigationBarTitleText: '果园设置后台' }
