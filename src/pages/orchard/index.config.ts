export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '我的果园' })
  : { navigationBarTitleText: '我的果园' }
