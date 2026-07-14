export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '膨胀团' })
  : { navigationBarTitleText: '膨胀团' }