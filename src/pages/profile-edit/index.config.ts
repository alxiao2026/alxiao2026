export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '编辑资料' })
  : { navigationBarTitleText: '编辑资料' }
