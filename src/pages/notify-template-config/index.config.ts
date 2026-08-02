export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '消息模板配置' })
  : { navigationBarTitleText: '消息模板配置' }
