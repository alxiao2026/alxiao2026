export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商品管理' })
  : { navigationBarTitleText: '商品管理' }
