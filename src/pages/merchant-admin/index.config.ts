export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '商家收录',
    })
  : { navigationBarTitleText: '商家收录' };
