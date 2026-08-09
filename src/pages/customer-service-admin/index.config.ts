export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '客服配置' })
  : { navigationBarTitleText: '客服配置' }
