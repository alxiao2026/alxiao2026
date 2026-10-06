export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '营销活动管理' })
  : { navigationBarTitleText: '营销活动管理' }
