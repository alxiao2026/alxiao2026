export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '消息通知' })
  : { navigationBarTitleText: '消息通知' }
