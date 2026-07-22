export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '验券及退款', navigationStyle: 'custom' })
  : { navigationBarTitleText: '验券及退款', navigationStyle: 'custom' }
