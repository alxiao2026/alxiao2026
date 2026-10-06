export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '营销功能管理' })
  : { navigationBarTitleText: '营销功能管理' }
