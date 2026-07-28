export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '结算明细' })
  : { navigationBarTitleText: '结算明细' }
