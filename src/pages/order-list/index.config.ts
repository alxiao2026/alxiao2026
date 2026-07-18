export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '我的订单' })
  : { navigationBarTitleText: '我的订单' }
