export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '订单明细' })
  : { navigationBarTitleText: '订单明细' };
