export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单详情' })
  : { navigationBarTitleText: '订单详情' }
