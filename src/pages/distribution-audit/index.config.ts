export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '分销管理' })
  : { navigationBarTitleText: '分销管理' }
