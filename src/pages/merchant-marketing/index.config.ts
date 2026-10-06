export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '门店WiFi管理' })
  : { navigationBarTitleText: '门店WiFi管理' }
