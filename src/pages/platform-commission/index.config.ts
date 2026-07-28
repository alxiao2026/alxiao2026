export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '平台佣金明细' })
  : { navigationBarTitleText: '平台佣金明细' }
