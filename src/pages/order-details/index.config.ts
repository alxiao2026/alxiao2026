export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationStyle: 'custom' })
  : { navigationStyle: 'custom' }
