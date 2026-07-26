export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '平台订单明细' })
  : { navigationBarTitleText: '平台订单明细' }
