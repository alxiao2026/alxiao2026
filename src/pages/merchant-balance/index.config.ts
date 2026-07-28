export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '商家余额' })
  : { navigationBarTitleText: '商家余额' }
