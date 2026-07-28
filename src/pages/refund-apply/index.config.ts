export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '申请退款' })
  : { navigationBarTitleText: '申请退款' }
