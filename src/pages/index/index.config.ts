export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom'
    })
  : {
      navigationBarTitleText: '膨胀团',
      navigationStyle: 'custom'
    }
