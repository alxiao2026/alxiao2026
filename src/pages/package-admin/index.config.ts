export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '套餐管理'
    })
  : {
      navigationBarTitleText: '套餐管理'
    }
