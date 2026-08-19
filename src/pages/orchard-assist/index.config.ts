export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '好友助力' })
  : { navigationBarTitleText: '好友助力' }
