export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商品管理', navigationStyle: 'custom' })
  : { navigationBarTitleText: '商品管理', navigationStyle: 'custom' }
