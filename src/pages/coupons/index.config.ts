export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '我的优惠券' })
  : { navigationBarTitleText: '我的优惠券' }