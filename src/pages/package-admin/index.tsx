import { View, Text, Image, Picker } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, X, ChevronRight, Check, Trash2 } from 'lucide-react-taro'
import { DOUYIN_CATEGORIES, getCategoryPath } from '@/data/categories'

interface Package {
  id: string
  name: string
  description: string
  price: string
  original_price: string
  badge: string
  features: string
  category: string
  cover_image: string
  environment_images: string[]
  stock: number
  sale_start_date: string
  sale_end_date: string
  auto_renew: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FeatureItem {
  id: string
  text: string
}

interface ProductItem {
  id: string
  name: string
  quantity: number
  price: string
  unit?: string
}

interface ProductCombination {
  id: string
  name: string
  items: ProductItem[]
  select_count: number
}

export default function PackageAdmin() {
  const router = Taro.useRouter()
  const { id } = router.params

  const [activeTab, setActiveTab] = useState('basic')
  const [currentStep, setCurrentStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [merchantSearch, setMerchantSearch] = useState('')

  // 步骤定义
  const steps = [
    { key: 'basic', label: '基础信息' },
    { key: 'merchant', label: '商家信息' },
    { key: 'product', label: '商品信息' },
    { key: 'sale', label: '售卖信息' }
  ]

  // 品类选择
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const [selectedLevel1, setSelectedLevel1] = useState('')
  const [selectedLevel2, setSelectedLevel2] = useState('')

  // 类型选择
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [packageType, setPackageType] = useState<'combo' | 'voucher'>('combo')

  // 商家选择
  const [showMerchantPicker, setShowMerchantPicker] = useState(false)
  const [merchants, setMerchants] = useState<any[]>([])
  const [selectedMerchant, setSelectedMerchant] = useState<any>(null)

  // 商品搭配
  const [combinations, setCombinations] = useState<ProductCombination[]>([])

  // 规格选择
  const [showSpecPicker, setShowSpecPicker] = useState(false)
  const [specComboId, setSpecComboId] = useState('')
  const [specItemId, setSpecItemId] = useState('')
  const [specQuantity, setSpecQuantity] = useState(1)
  const [specUnit, setSpecUnit] = useState('')

  // 日期选择
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [tempStartDate, setTempStartDate] = useState('')
  const [tempEndDate, setTempEndDate] = useState('')

  // 规格单位列表
  const SPEC_UNITS = [
    '半份', '半斤', '包', '杯', '串', '次', '袋', '碟',
    '对', '份', '个', '根', '盒', '壶', '件', '斤',
    '棵', '块', '罐', '例', '两', '笼', '盘', '盆',
    '瓶', '升', '屉', '条', '听', '桶', '头', '碗',
    '位', '箱', '扎', '张', '只', '支'
  ]

  // 表单数据
  const [formData, setFormData] = useState<Package>({
    id: '',
    name: '',
    description: '',
    price: '0',
    original_price: '0',
    badge: '',
    features: '',
    category: '',
    cover_image: '',
    environment_images: [],
    stock: 0,
    sale_start_date: '',
    sale_end_date: '',
    auto_renew: false,
    is_active: true,
    created_at: '',
    updated_at: ''
  })

  const [featureItems, setFeatureItems] = useState<FeatureItem[]>([])
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingEnv, setUploadingEnv] = useState(false)

  useEffect(() => {
    if (id) {
      fetchPackage(id)
    } else {
      // 新建时检查是否有草稿
      loadDraft()
    }
    loadMerchants()
  }, [id])

  const loadMerchants = async () => {
    try {
      const res = await Network.request({ url: '/api/merchants' })
      console.log('商家列表响应:', res.data)
      if (res.data?.code === 200) {
        setMerchants(res.data.data || [])
      }
    } catch (error) {
      console.error('加载商家失败:', error)
    }
  }

  // 商品搭配处理函数
  const addCombination = () => {
    const newCombination: ProductCombination = {
      id: Date.now().toString(),
      name: '',
      items: [],
      select_count: 0
    }
    setCombinations([...combinations, newCombination])
  }

  const removeCombination = (combId: string) => {
    setCombinations(combinations.filter(c => c.id !== combId))
  }

  const updateCombinationName = (combId: string, name: string) => {
    setCombinations(combinations.map(c =>
      c.id === combId ? { ...c, name } : c
    ))
  }

  const addItemToCombination = (combinationId: string) => {
    const newItem: ProductItem = {
      id: Date.now().toString(),
      name: '',
      quantity: 1,
      price: ''
    }
    setCombinations(combinations.map(c =>
      c.id === combinationId
        ? { ...c, items: [...c.items, newItem] }
        : c
    ))
  }

  const removeItemFromCombination = (combinationId: string, itemId: string) => {
    setCombinations(combinations.map(c =>
      c.id === combinationId
        ? { ...c, items: c.items.filter(item => item.id !== itemId) }
        : c
    ))
  }

  const updateItem = (combinationId: string, itemId: string, field: keyof ProductItem, value: string | number) => {
    setCombinations(combinations.map(c =>
      c.id === combinationId
        ? {
            ...c,
            items: c.items.map(item =>
              item.id === itemId ? { ...item, [field]: value } : item
            )
          }
        : c
    ))
  }

  const updateSelectCount = (combinationId: string, count: number) => {
    setCombinations(combinations.map(c =>
      c.id === combinationId ? { ...c, select_count: count } : c
    ))
  }

  // 规格选择处理函数
  const openSpecPicker = (comboId: string, itemId: string) => {
    const combo = combinations.find(c => c.id === comboId)
    const item = combo?.items.find(i => i.id === itemId)
    setSpecComboId(comboId)
    setSpecItemId(itemId)
    setSpecQuantity(item?.quantity || 1)
    setSpecUnit(item?.unit || '')
    setShowSpecPicker(true)
  }

  const closeSpecPicker = () => {
    setShowSpecPicker(false)
  }

  const confirmSpec = () => {
    console.log('confirmSpec - specQuantity:', specQuantity, 'specUnit:', specUnit)
    updateItem(specComboId, specItemId, 'quantity', specQuantity)
    updateItem(specComboId, specItemId, 'unit', specUnit)
    setShowSpecPicker(false)
  }

  const increaseQuantity = () => {
    console.log('increaseQuantity - before:', specQuantity)
    setSpecQuantity(prev => {
      const newValue = prev + 1
      console.log('increaseQuantity - after:', newValue)
      return newValue
    })
  }

  const decreaseQuantity = () => {
    console.log('decreaseQuantity - before:', specQuantity)
    setSpecQuantity(prev => {
      if (prev > 1) {
        const newValue = prev - 1
        console.log('decreaseQuantity - after:', newValue)
        return newValue
      }
      return prev
    })
  }

  // 日期选择处理
  const openDatePicker = () => {
    setTempStartDate(formData.sale_start_date || '')
    setTempEndDate(formData.sale_end_date || '')
    setShowDatePicker(true)
  }

  const closeDatePicker = () => {
    setShowDatePicker(false)
  }

  const confirmDate = () => {
    updateFormData('sale_start_date', tempStartDate)
    updateFormData('sale_end_date', tempEndDate)
    setShowDatePicker(false)
  }

  const clearDate = () => {
    setTempStartDate('')
    setTempEndDate('')
  }

  // 步骤验证
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // 基础信息
        if (!formData.category) {
          Taro.showToast({ title: '请选择商品品类', icon: 'none' })
          return false
        }
        if (!packageType) {
          Taro.showToast({ title: '请选择商品类型', icon: 'none' })
          return false
        }
        return true
      case 1: // 商家信息
        if (!selectedMerchant) {
          Taro.showToast({ title: '请选择商家', icon: 'none' })
          return false
        }
        return true
      case 2: // 商品信息
        if (!formData.name) {
          Taro.showToast({ title: '请输入商品名称', icon: 'none' })
          return false
        }
        if (!formData.price || parseFloat(formData.price) <= 0) {
          Taro.showToast({ title: '请输入有效售价', icon: 'none' })
          return false
        }
        return true
      case 3: // 售卖信息
        if (formData.stock < 0) {
          Taro.showToast({ title: '请输入有效库存', icon: 'none' })
          return false
        }
        return true
      default:
        return true
    }
  }

  // 下一步
  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      const nextStep = currentStep + 1
      if (nextStep < steps.length) {
        setCurrentStep(nextStep)
        setActiveTab(steps[nextStep].key)
      }
    }
  }

  // 上一步
  const handlePrevStep = () => {
    const prevStep = currentStep - 1
    if (prevStep >= 0) {
      setCurrentStep(prevStep)
      setActiveTab(steps[prevStep].key)
    }
  }

  const fetchPackage = async (packageId: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/packages/${packageId}`
      })
      console.log('Package admin response:', res.data)
      if (res.data?.data) {
        const pkg = res.data.data
        setFormData(pkg)
        // 解析 features
        if (pkg.features) {
          try {
            const parsed = JSON.parse(pkg.features)
            if (Array.isArray(parsed)) {
              setFeatureItems(parsed.map((text: string, index: number) => ({ id: `feature-${index}`, text })))
            }
          } catch {
            setFeatureItems(pkg.features.split('\n').filter(Boolean).map((text: string, index: number) => ({ id: `feature-${index}`, text })))
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch package:', error)
      Taro.showToast({ title: '加载失败', icon: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: keyof Package, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleUploadCover = async () => {
    const isMiniApp = [Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT].includes(Taro.getEnv() as any)

    if (!isMiniApp) {
      // H5 端使用文件选择
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e: any) => {
        const file = e.target.files[0]
        if (!file) return
        setUploadingCover(true)
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/upload',
            filePath: file as any,
            name: 'file'
          })
          console.log('Upload cover response:', uploadRes.data)
          const resData = uploadRes.data as any
          if (resData?.data?.url) {
            updateFormData('cover_image', resData.data.url)
            Taro.showToast({ title: '上传成功', icon: 'success' })
          }
        } catch (error) {
          console.error('Upload failed:', error)
          Taro.showToast({ title: '上传失败', icon: 'error' })
        } finally {
          setUploadingCover(false)
        }
      }
      input.click()
      return
    }

    // 小程序端
    try {
      const res = await Taro.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (res.tempFilePaths.length > 0) {
        setUploadingCover(true)
        const uploadRes = await Network.uploadFile({
          url: '/api/upload',
          filePath: res.tempFilePaths[0],
          name: 'file'
        })
        console.log('Upload cover response:', uploadRes.data)
        const resData = uploadRes.data as any
        if (resData?.data?.url) {
          updateFormData('cover_image', resData.data.url)
          Taro.showToast({ title: '上传成功', icon: 'success' })
        }
      }
    } catch (error) {
      console.error('Upload failed:', error)
      Taro.showToast({ title: '上传失败', icon: 'error' })
    } finally {
      setUploadingCover(false)
    }
  }

  const handleUploadEnv = async () => {
    const isMiniApp = [Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT].includes(Taro.getEnv() as any)
    const remaining = 10 - formData.environment_images.length

    if (remaining <= 0) {
      Taro.showToast({ title: '最多上传 10 张环境图', icon: 'none' })
      return
    }

    if (!isMiniApp) {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.multiple = true
      input.onchange = async (e: any) => {
        const files = Array.from(e.target.files).slice(0, remaining)
        if (files.length === 0) return
        setUploadingEnv(true)
        try {
          const newUrls = [...formData.environment_images]
          for (const file of files) {
            const uploadRes = await Network.uploadFile({
              url: '/api/upload',
              filePath: file as any,
              name: 'file'
            })
            console.log('Upload env response:', uploadRes.data)
            const resData = uploadRes.data as any
            if (resData?.data?.url) {
              newUrls.push(resData.data.url)
            }
          }
          updateFormData('environment_images', newUrls)
          Taro.showToast({ title: '上传成功', icon: 'success' })
        } catch (error) {
          console.error('Upload failed:', error)
          Taro.showToast({ title: '上传失败', icon: 'error' })
        } finally {
          setUploadingEnv(false)
        }
      }
      input.click()
      return
    }

    try {
      const res = await Taro.chooseImage({
        count: remaining,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (res.tempFilePaths.length > 0) {
        setUploadingEnv(true)
        const newUrls = [...formData.environment_images]
        for (const filePath of res.tempFilePaths) {
          const uploadRes = await Network.uploadFile({
            url: '/api/upload',
            filePath: filePath,
            name: 'file'
          })
          console.log('Upload env response:', uploadRes.data)
          const resData = uploadRes.data as any
          if (resData?.data?.url) {
            newUrls.push(resData.data.url)
          }
        }
        updateFormData('environment_images', newUrls)
        Taro.showToast({ title: '上传成功', icon: 'success' })
      }
    } catch (error) {
      console.error('Upload failed:', error)
      Taro.showToast({ title: '上传失败', icon: 'error' })
    } finally {
      setUploadingEnv(false)
    }
  }

  const removeEnvImage = (index: number) => {
    updateFormData(
      'environment_images',
      formData.environment_images.filter((_, i) => i !== index)
    )
  }

  const handleSubmit = async () => {
    // 表单验证
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      Taro.showToast({ title: '请输入有效售价', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      // 将 featureItems 转换为 JSON 字符串
      const featuresJson = JSON.stringify(featureItems.map(item => item.text))

      const submitData = {
        ...formData,
        features: featuresJson,
        combinations: JSON.stringify(combinations)
      }

      let res
      if (formData.id) {
        // 更新
        res = await Network.request({
          url: `/api/packages/${formData.id}`,
          method: 'PUT',
          data: submitData
        })
      } else {
        // 创建
        res = await Network.request({
          url: '/api/packages',
          method: 'POST',
          data: submitData
        })
      }

      console.log('Submit response:', res.data)

      if (res.data?.code === 200 || res.data?.data) {
        Taro.showToast({ title: '提交成功', icon: 'success' })
        // 提交成功后清除草稿
        Taro.removeStorageSync('package_draft')
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: '提交失败', icon: 'error' })
      }
    } catch (error) {
      console.error('Submit failed:', error)
      Taro.showToast({ title: '提交失败', icon: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // 保存草稿
  const saveDraft = () => {
    try {
      const draft = {
        formData,
        featureItems,
        combinations,
        currentStep,
        packageType,
        selectedMerchant,
        savedAt: Date.now()
      }
      Taro.setStorageSync('package_draft', JSON.stringify(draft))
      Taro.showToast({ title: '草稿已保存', icon: 'success' })
    } catch (error) {
      console.error('保存草稿失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'error' })
    }
  }

  // 清除草稿
  const clearDraft = () => {
    Taro.showModal({
      title: '确认清除',
      content: '确定要清除草稿吗？清除后无法恢复。',
      success: (res) => {
        if (res.confirm) {
          Taro.removeStorageSync('package_draft')
          Taro.showToast({ title: '草稿已清除', icon: 'success' })
          // 重置所有状态
          setFormData({
            id: '',
            name: '',
            description: '',
            price: '0',
            original_price: '0',
            badge: '',
            features: '',
            category: '',
            cover_image: '',
            environment_images: [],
            stock: 0,
            sale_start_date: '',
            sale_end_date: '',
            auto_renew: false,
            is_active: true,
            created_at: '',
            updated_at: ''
          })
          setFeatureItems([])
          setCombinations([])
          setCurrentStep(0)
          setPackageType('combo')
          setSelectedMerchant(null)
        }
      }
    })
  }

  // 加载草稿
  const loadDraft = () => {
    try {
      const draftStr = Taro.getStorageSync('package_draft')
      if (draftStr) {
        const draft = JSON.parse(draftStr)
        if (draft.formData) {
          setFormData(draft.formData)
        }
        if (draft.featureItems) {
          setFeatureItems(draft.featureItems)
        }
        if (draft.combinations) {
          setCombinations(draft.combinations)
        }
        if (draft.currentStep !== undefined) {
          setCurrentStep(draft.currentStep)
        }
        if (draft.packageType) {
          setPackageType(draft.packageType)
        }
        if (draft.selectedMerchant) {
          setSelectedMerchant(draft.selectedMerchant)
        }
        Taro.showToast({ title: '已恢复草稿', icon: 'success' })
      }
    } catch (error) {
      console.error('加载草稿失败:', error)
    }
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-screen bg-gray-50">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-white pb-20">
      {/* 顶部导航 */}
      <View className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <View className="flex items-center justify-between px-4 py-3">
          <View className="flex items-center gap-2" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#333" />
          </View>
          <Text className="block text-base font-semibold text-gray-800">商品创建</Text>
          <View className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={clearDraft}>
              <Text className="text-xs">清除草稿</Text>
            </Button>
            <Button size="sm" variant="outline" onClick={saveDraft}>
              <Text className="text-xs">保存草稿</Text>
            </Button>
          </View>
        </View>

        {/* 步骤指示器 */}
        <View className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          {steps.map((step, index) => (
            <View key={step.key} className="flex items-center flex-1">
              <View
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  index < currentStep
                    ? 'bg-green-500'
                    : index === currentStep
                    ? 'bg-red-500'
                    : 'bg-gray-300'
                }`}
              >
                {index < currentStep ? (
                  <Check size={16} color="#fff" />
                ) : (
                  <Text className="block text-white text-sm font-medium">{index + 1}</Text>
                )}
              </View>
              <Text
                className={`block ml-2 text-sm ${
                  index === currentStep ? 'text-red-500 font-medium' : 'text-gray-600'
                }`}
              >
                {step.label}
              </Text>
              {index < steps.length - 1 && (
                <View className="flex-1 h-1 bg-gray-300 mx-2" />
              )}
            </View>
          ))}
        </View>
      </View>

      {/* 内容区域 */}
      <View className="p-4">
        {/* 基础信息 */}
        {activeTab === 'basic' && (
          <View className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">基础信息</Text>

                <View className="mb-4">
                  <Text className="block text-sm text-gray-600 mb-2">商品品类</Text>
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => setShowCategoryPicker(true)}
                  >
                    <Text className="block text-sm text-gray-800">
                      {selectedLevel1 && selectedLevel2
                        ? getCategoryPath(selectedLevel2)
                        : '请选择商品品类'}
                    </Text>
                    <View className="flex items-center gap-2">
                      {selectedLevel1 && selectedLevel2 && (
                        <Badge className="bg-green-100 text-green-600 text-xs">已选择</Badge>
                      )}
                      <ChevronRight size={16} color="#999" />
                    </View>
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-2">商品类型</Text>
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => setShowTypePicker(true)}
                  >
                    <Text className="block text-sm text-gray-800">
                      {packageType === 'combo' ? '团购套餐' : '代金券'}
                    </Text>
                    <View className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-600 text-xs">
                        {packageType === 'combo' ? '套餐' : '代金券'}
                      </Badge>
                      <ChevronRight size={16} color="#999" />
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 商家信息 */}
        {activeTab === 'merchant' && (
          <View className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">商家信息</Text>

                <View className="mb-4">
                  <Text className="block text-sm text-gray-600 mb-2">商家名称</Text>
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => setShowMerchantPicker(true)}
                  >
                    <Text className="block text-sm text-gray-800">
                      {selectedMerchant ? selectedMerchant.name : '请选择商家'}
                    </Text>
                    <View className="flex items-center gap-2">
                      {selectedMerchant && (
                        <Badge className="bg-blue-100 text-blue-600 text-xs">已选择</Badge>
                      )}
                      <ChevronRight size={16} color="#9ca3af" />
                    </View>
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="block text-sm text-gray-600 mb-2">收款方式</Text>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">总部统一收款</Text>
                    <Badge className="bg-gray-200 text-gray-600 text-xs">不可编辑</Badge>
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-2">适用门店</Text>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">已选择 1 家门店</Text>
                    <Text className="block text-sm text-gray-400">›</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 商品信息 */}
        {activeTab === 'product' && (
          <View className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">商品信息</Text>

                {/* 商品名称 */}
                <View className="mb-4">
                  <View className="flex items-center gap-1 mb-2">
                    <Text className="block text-sm text-gray-600">商品名称</Text>
                    <Text className="block text-red-500">*</Text>
                  </View>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Input
                      className="w-full"
                      style={{ backgroundColor: 'transparent' }}
                      placeholder="请输入商品名称"
                      value={formData.name}
                      onInput={(e) => updateFormData('name', e.detail.value)}
                    />
                  </View>
                  <Text className="block text-xs text-gray-400 mt-1">商品名称需与商品内容保持一致，不得含有错别字及特殊符号</Text>
                </View>

                {/* 商品搭配 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between mb-3">
                    <Text className="block text-sm font-medium text-gray-700">商品搭配</Text>
                    <Text className="block text-xs text-gray-400">搭配更热卖 填写更便捷</Text>
                  </View>

                  {combinations.map((combo) => (
                    <View key={combo.id} className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
                      {/* 商品组名称 */}
                      <View className="mb-3">
                        <Input
                          className="w-full border border-gray-200 rounded-lg px-3 py-2"
                          placeholder="填写商品组名称"
                          value={combo.name}
                          onInput={(e) => updateCombinationName(combo.id, e.detail.value)}
                        />
                      </View>

                      {/* 商品项列表 */}
                      {combo.items.map((item) => (
                        <View key={item.id} className="flex items-center gap-2 mb-2">
                          <View className="w-48">
                            <Input
                              className="w-full border border-gray-200 rounded-lg px-3 py-2"
                              value={item.name}
                              onInput={(e) => updateItem(combo.id, item.id, 'name', e.detail.value)}
                            />
                          </View>
                          <View
                            className="w-20 border border-gray-200 rounded-lg px-2 py-2 flex items-center justify-center"
                            onClick={() => openSpecPicker(combo.id, item.id)}
                          >
                            <Text className="block text-sm text-gray-700">
                              {item.quantity}{item.unit || '份'}
                            </Text>
                          </View>
                          <View className="w-24">
                            <Input
                              className="w-full border border-gray-200 rounded-lg px-2 py-2"
                              placeholder="单价"
                              type="digit"
                              value={item.price}
                              onInput={(e) => updateItem(combo.id, item.id, 'price', e.detail.value)}
                            />
                          </View>
                          <View className="ml-2">
                            <Button
                              variant="ghost"
                              onClick={() => removeItemFromCombination(combo.id, item.id)}
                            >
                              <Trash2 size={16} color="#ef4444" />
                            </Button>
                          </View>
                        </View>
                      ))}

                      {/* 几选几选择器 */}
                      <View className="bg-gray-50 rounded-lg p-4 mb-2">
                        <View className="flex items-center justify-between mb-3">
                          <Text className="block text-base font-medium text-gray-900">
                            共 {combo.items.length} 个商品：{combo.items.length}选{combo.select_count}
                          </Text>
                          <ChevronRight size={20} color="#666" />
                        </View>
                        {/* 选择数量按钮 */}
                        <View className="flex gap-2 flex-wrap">
                          {Array.from({ length: combo.items.length }, (_, i) => combo.items.length - i).map(num => (
                            <View
                              key={num}
                              className={`px-4 py-2 rounded-lg border ${num === combo.select_count ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`}
                              onClick={() => updateSelectCount(combo.id, num)}
                            >
                              <Text className={`block text-sm ${num === combo.select_count ? 'text-white' : 'text-gray-700'}`}>
                                {combo.items.length}选{num}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>

                      {/* 添加商品项 */}
                      <Button
                        className="w-full mt-2"
                        variant="outline"
                        onClick={() => addItemToCombination(combo.id)}
                      >
                        <Plus size={16} color="#666" />
                        <Text className="block ml-1">添加</Text>
                      </Button>

                      {/* 删除商品组 */}
                      <Button
                        className="w-full mt-2 text-red-500"
                        variant="ghost"
                        onClick={() => removeCombination(combo.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                        <Text className="block ml-1">删除商品组</Text>
                      </Button>
                    </View>
                  ))}

                  {/* 添加商品组 */}
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={addCombination}
                  >
                    <Plus size={16} color="#666" />
                    <Text className="block ml-1">添加商品组</Text>
                  </Button>

                  {/* 总合计栏 */}
                  {combinations.length > 0 && (
                    <View className="bg-gray-50 rounded-lg p-4 mt-3 flex items-center justify-between">
                      <Text className="block text-base text-gray-900">合计</Text>
                      <Text className="block text-base text-gray-900">
                        ¥{combinations.reduce((total, combo) => {
                          // 如果全选，直接累加所有商品价格
                          if (combo.select_count === combo.items.length) {
                            return total + combo.items.reduce((sum, item) => {
                              const price = parseFloat(item.price) || 0
                              return sum + price * item.quantity
                            }, 0)
                          }
                          // 如果几选几，按价格从高到低排序，取前 select_count 个商品的总价
                          const sortedItems = [...combo.items].sort((a, b) => {
                            const priceA = parseFloat(a.price) || 0
                            const priceB = parseFloat(b.price) || 0
                            return priceB - priceA
                          })
                          const maxPrice = sortedItems.slice(0, combo.select_count).reduce((sum, item) => {
                            const price = parseFloat(item.price) || 0
                            return sum + price * item.quantity
                          }, 0)
                          return total + maxPrice
                        }, 0).toFixed(2)}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 售价 */}
                <View className="mb-4">
                  <View className="flex items-center gap-1 mb-2">
                    <Text className="block text-sm text-gray-600">售价</Text>
                    <Text className="block text-red-500">*</Text>
                  </View>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <View className="flex items-center">
                      <Text className="block text-sm text-gray-800 mr-2">售价</Text>
                      <View className="flex-1">
                        <Input
                          className="w-full"
                          style={{ backgroundColor: 'transparent', textAlign: 'right' }}
                          type="digit"
                          placeholder="0"
                          value={formData.price}
                          onInput={(e) => updateFormData('price', e.detail.value)}
                        />
                      </View>
                      <Text className="block text-sm text-gray-800 ml-2">元</Text>
                    </View>
                  </View>
                </View>

                {/* 商品头图 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-600">商品头图</Text>
                    </View>
                    <Text className="block text-xs text-blue-500">规范示例</Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mb-3">在商品详情页以 4:3 比例展示</Text>

                  {formData.cover_image ? (
                    <View className="relative w-24 h-24 rounded-lg overflow-hidden">
                      <Image src={formData.cover_image} className="w-full h-full" mode="aspectFill" />
                      <View
                        className="absolute top-0 right-0 bg-black bg-opacity-50 rounded-bl-lg p-1"
                        onClick={() => updateFormData('cover_image', '')}
                      >
                        <X size={14} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <Button
                      className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50"
                      variant="ghost"
                      onClick={handleUploadCover}
                    >
                      {uploadingCover ? (
                        <Text className="block text-xs text-gray-400">上传中...</Text>
                      ) : (
                        <>
                          <Plus size={20} color="#999" />
                          <Text className="block text-xs text-gray-400 mt-1">添加头图 0/5</Text>
                        </>
                      )}
                    </Button>
                  )}
                </View>

                {/* 环境图 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between mb-2">
                    <Text className="block text-sm text-gray-600">环境图</Text>
                    <Text className="block text-xs text-blue-500">查看示例</Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mb-3">良好的环境也是用户的优先选择，最多可上传 10 张。</Text>

                  <View className="flex flex-wrap gap-2">
                    {formData.environment_images.map((url, index) => (
                      <View key={index} className="relative w-20 h-20 rounded-lg overflow-hidden">
                        <Image src={url} className="w-full h-full" mode="aspectFill" />
                        <View
                          className="absolute top-0 right-0 bg-black bg-opacity-50 rounded-bl-lg p-1"
                          onClick={() => removeEnvImage(index)}
                        >
                          <X size={12} color="#fff" />
                        </View>
                      </View>
                    ))}
                    {formData.environment_images.length < 10 && (
                      <Button
                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50"
                        variant="ghost"
                        onClick={handleUploadEnv}
                      >
                        {uploadingEnv ? (
                          <Text className="block text-xs text-gray-400">上传中...</Text>
                        ) : (
                          <>
                            <Plus size={16} color="#999" />
                            <Text className="block text-xs text-gray-400 mt-1">添加环境图 {formData.environment_images.length}/10</Text>
                          </>
                        )}
                      </Button>
                    )}
                  </View>
                </View>

                {/* 项目补充说明 */}
                <View className="mb-4">
                  <Text className="block text-sm text-gray-600 mb-2">项目补充说明</Text>
                  <View className="bg-gray-50 rounded-lg p-3">
                    <Textarea
                      className="w-full bg-transparent"
                      placeholder="如有备注信息请说明，不少于 10 字"
                      value={formData.description}
                      maxlength={200}
                      onInput={(e) => updateFormData('description', e.detail.value)}
                    />
                  </View>
                  <Text className="block text-xs text-gray-400 mt-1 text-right">{formData.description.length}/200</Text>
                </View>

                {/* 商品资质 */}
                <View>
                  <Text className="block text-sm text-gray-600 mb-2">商品资质</Text>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-400">暂无资质需要填写</Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 售卖信息 */}
        {activeTab === 'sale' && (
          <View className="space-y-4">
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">售卖信息</Text>

                {/* 投放渠道 */}
                <View className="mb-4">
                  <View className="flex items-center gap-1 mb-2">
                    <Text className="block text-sm text-gray-600">投放渠道</Text>
                    <Text className="block text-red-500">*</Text>
                  </View>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">不限制</Text>
                    <Text className="block text-sm text-gray-400">›</Text>
                  </View>
                </View>

                {/* 库存数量 */}
                <View className="mb-4">
                  <View className="flex items-center gap-1 mb-2">
                    <Text className="block text-sm text-gray-600">库存数量</Text>
                    <Text className="block text-red-500">*</Text>
                  </View>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <View className="flex-1">
                      <Input
                        className="w-full"
                        style={{ backgroundColor: 'transparent', textAlign: 'right' }}
                        type="number"
                        placeholder="0"
                        value={formData.stock.toString()}
                        onInput={(e) => updateFormData('stock', parseInt(e.detail.value) || 0)}
                      />
                    </View>
                    <Text className="block text-sm text-gray-400 ml-2">›</Text>
                  </View>
                </View>

                {/* 商品售卖日期 */}
                <View className="mb-4">
                  <View className="flex items-center gap-1 mb-2">
                    <Text className="block text-sm text-gray-600">商品售卖日期</Text>
                  </View>
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={openDatePicker}
                  >
                    <Text className="block text-sm text-gray-800">
                      {formData.sale_start_date && formData.sale_end_date
                        ? `${formData.sale_start_date} 至 ${formData.sale_end_date}`
                        : '不限时间'}
                    </Text>
                    <Text className="block text-sm text-gray-400">›</Text>
                  </View>
                </View>

                {/* 自动延期 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <View className="flex-1">
                      <Text className="block text-sm text-gray-800">自动延期</Text>
                      <Text className="block text-xs text-gray-400 mt-1">到期后每半年自动延期一次</Text>
                    </View>
                    <View
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${
                        formData.auto_renew ? 'bg-blue-500' : 'bg-gray-300'
                      }`}
                      onClick={() => updateFormData('auto_renew', !formData.auto_renew)}
                    >
                      <View
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          formData.auto_renew ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </View>
                  </View>
                </View>

                {/* 上下架状态 */}
                <View>
                  <Text className="block text-sm text-gray-600 mb-2">上下架状态</Text>
                  <View className="flex items-center gap-3">
                    <View
                      className={`flex-1 py-3 rounded-lg border-2 text-center ${
                        formData.is_active
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => updateFormData('is_active', true)}
                    >
                      <Text className={`block text-sm ${formData.is_active ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                        上架
                      </Text>
                    </View>
                    <View
                      className={`flex-1 py-3 rounded-lg border-2 text-center ${
                        !formData.is_active
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => updateFormData('is_active', false)}
                    >
                      <Text className={`block text-sm ${!formData.is_active ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                        下架
                      </Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}
      </View>

      {/* 品类选择弹窗 */}
      {showCategoryPicker && (
        <View
          className="fixed inset-0 bg-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          onClick={() => setShowCategoryPicker(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-base font-semibold text-gray-800">选择商品品类</Text>
              <View onClick={() => setShowCategoryPicker(false)}>
                <X size={20} color="#666" />
              </View>
            </View>

            {/* 品类列表 */}
            <View className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {DOUYIN_CATEGORIES.map((level1) => (
                <View key={level1.id}>
                  {/* 一级分类 */}
                  <View
                    className={`px-4 py-3 border-b border-gray-100 ${
                      selectedLevel1 === level1.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedLevel1(level1.id);
                      setSelectedLevel2('');
                    }}
                  >
                    <View className="flex items-center justify-between">
                      <Text className="block text-sm font-medium text-gray-800">{level1.name}</Text>
                      {selectedLevel1 === level1.id && !selectedLevel2 && (
                        <Check size={16} color="#3b82f6" />
                      )}
                    </View>
                  </View>

                  {/* 二级分类 */}
                  {selectedLevel1 === level1.id && level1.children && (
                    <View className="bg-gray-50">
                      {level1.children.map((level2) => (
                        <View
                          key={level2.id}
                          className={`px-8 py-3 border-b border-gray-100 ${
                            selectedLevel2 === level2.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => {
                            setSelectedLevel2(level2.id);
                            setShowCategoryPicker(false);
                            // 更新表单数据
                            setFormData((prev) => ({
                              ...prev,
                              category: `${level1.name} · ${level2.name}`
                            }));
                          }}
                        >
                          <View className="flex items-center justify-between">
                            <Text className="block text-sm text-gray-600">{level2.name}</Text>
                            {selectedLevel2 === level2.id && (
                              <Check size={16} color="#3b82f6" />
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* 类型选择弹窗 */}
      {showTypePicker && (
        <View
          className="fixed inset-0 bg-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          onClick={() => setShowTypePicker(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
            style={{ maxHeight: '60vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-base font-semibold text-gray-800">选择商品类型</Text>
              <View onClick={() => setShowTypePicker(false)}>
                <X size={20} color="#666" />
              </View>
            </View>

            {/* 类型列表 */}
            <View>
              <View
                className={`px-4 py-4 border-b border-gray-100 ${
                  packageType === 'combo' ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  setPackageType('combo');
                  setShowTypePicker(false);
                }}
              >
                <View className="flex items-center justify-between">
                  <View>
                    <Text className="block text-sm font-medium text-gray-800">团购套餐</Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      包含多项商品或服务的组合套餐
                    </Text>
                  </View>
                  {packageType === 'combo' && <Check size={20} color="#3b82f6" />}
                </View>
              </View>

              <View
                className={`px-4 py-4 ${
                  packageType === 'voucher' ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  setPackageType('voucher');
                  setShowTypePicker(false);
                }}
              >
                <View className="flex items-center justify-between">
                  <View>
                    <Text className="block text-sm font-medium text-gray-800">代金券</Text>
                    <Text className="block text-xs text-gray-500 mt-1">
                      可抵扣现金的优惠券，满额可用
                    </Text>
                  </View>
                  {packageType === 'voucher' && <Check size={20} color="#3b82f6" />}
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* 商家选择弹窗 */}
      {showMerchantPicker && (
        <View
          className="fixed inset-0 bg-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200 }}
          onClick={() => setShowMerchantPicker(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
            style={{ maxHeight: '70vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <View className="p-4 border-b border-gray-200">
              <View className="flex items-center justify-between mb-3">
                <Text className="block text-base font-semibold text-gray-800">选择商家</Text>
                <View onClick={() => { setShowMerchantPicker(false); setMerchantSearch(''); }}>
                  <X size={20} color="#666" />
                </View>
              </View>
              {/* 搜索框 */}
              <View className="bg-gray-100 rounded-xl px-4 py-3">
                <Input
                  className="w-full"
                  placeholder="输入门店名称关键词搜索"
                  value={merchantSearch}
                  onInput={(e) => setMerchantSearch(e.detail.value)}
                  style={{ backgroundColor: 'transparent' }}
                />
              </View>
            </View>

            {/* 商家列表 */}
            <View className="overflow-y-auto" style={{ maxHeight: '50vh' }}>
              {(() => {
                const filteredMerchants = merchants.filter((m) =>
                  m.name.toLowerCase().includes(merchantSearch.toLowerCase())
                );
                if (filteredMerchants.length === 0) {
                  return (
                    <View className="flex items-center justify-center py-12">
                      <Text className="block text-gray-500">
                        {merchantSearch ? '未找到匹配的商家' : '暂无商家，请先添加'}
                      </Text>
                    </View>
                  );
                }
                return filteredMerchants.map((merchant) => (
                  <View
                    key={merchant.id}
                    className={`px-4 py-4 border-b border-gray-100 ${
                      selectedMerchant?.id === merchant.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedMerchant(merchant);
                      setShowMerchantPicker(false);
                    }}
                  >
                    <View className="flex items-center justify-between">
                      <View className="flex-1">
                        <Text className="block text-sm font-medium text-gray-800">
                          {merchant.name}
                        </Text>
                        {merchant.category && (
                          <Text className="block text-xs text-gray-500 mt-1">
                            {merchant.category}
                          </Text>
                        )}
                        {merchant.address && (
                          <Text className="block text-xs text-gray-500 mt-1">
                            {merchant.address}
                          </Text>
                        )}
                      </View>
                      {selectedMerchant?.id === merchant.id && (
                        <Check size={20} color="#3b82f6" />
                      )}
                    </View>
                  </View>
                ));
              })()}
            </View>

            {/* 底部按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full"
                onClick={() => Taro.navigateTo({ url: '/pages/merchant-admin/index' })}
              >
                <Text className="block text-sm">管理商家</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 规格选择弹窗 */}
      {showSpecPicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 200 }}
          onClick={closeSpecPicker}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">商品规格</Text>
              <View onClick={closeSpecPicker}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 数量选择 */}
            <View className="p-4 border-b border-gray-200">
              <View className="flex items-center justify-between">
                <Text className="block text-base font-medium text-gray-900">数量</Text>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                  <View
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={decreaseQuantity}
                  >
                    <Text className="block text-lg text-gray-600">-</Text>
                  </View>
                  <Text className="block text-lg font-medium text-gray-900" style={{ width: '32px', textAlign: 'center' }}>{specQuantity}</Text>
                  <View
                    style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                    onClick={increaseQuantity}
                  >
                    <Text className="block text-lg text-gray-600">+</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 规格选择 */}
            <View className="p-4">
              <Text className="block text-base font-medium text-gray-900 mb-3">规格</Text>
              <View className="grid grid-cols-4 gap-2">
                {SPEC_UNITS.map(unit => (
                  <View
                    key={unit}
                    className={`py-2 px-3 rounded-lg border text-center ${
                      specUnit === unit
                        ? 'bg-blue-50 border-blue-500'
                        : 'bg-white border-gray-200'
                    }`}
                    onClick={() => setSpecUnit(unit)}
                  >
                    <Text className={`block text-sm ${specUnit === unit ? 'text-blue-500' : 'text-gray-700'}`}>
                      {unit}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 确认按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-blue-500"
                onClick={confirmSpec}
              >
                <Text className="block text-white font-medium text-base">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 日期选择弹窗 */}
      {showDatePicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 200 }}
          onClick={closeDatePicker}
        >
          <View
            className="bg-white rounded-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">选择售卖日期</Text>
              <View onClick={closeDatePicker}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 日期选择 */}
            <View className="p-4">
              <View className="mb-4">
                <Text className="block text-sm text-gray-600 mb-2">开始日期</Text>
                <Picker
                  mode="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.detail.value)}
                >
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">
                      {tempStartDate || '请选择开始日期'}
                    </Text>
                  </View>
                </Picker>
              </View>
              <View className="mb-4">
                <Text className="block text-sm text-gray-600 mb-2">结束日期</Text>
                <Picker
                  mode="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.detail.value)}
                >
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">
                      {tempEndDate || '请选择结束日期'}
                    </Text>
                  </View>
                </Picker>
              </View>
            </View>

            {/* 操作按钮 */}
            <View className="p-4 border-t border-gray-200 flex gap-3">
              <Button
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700"
                onClick={clearDate}
              >
                <Text className="block font-medium">清除</Text>
              </Button>
              <Button
                className="flex-1 bg-blue-500"
                onClick={confirmDate}
              >
                <Text className="block text-white font-medium">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 底部操作栏 */}
      <View
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4"
        style={{ zIndex: 100 }}
      >
        <View className="flex gap-3">
          {currentStep > 0 && (
            <Button
              className="flex-1 bg-white border-2 border-gray-300 text-gray-700"
              onClick={handlePrevStep}
            >
              <Text className="block font-medium">上一步</Text>
            </Button>
          )}
          {currentStep < steps.length - 1 ? (
            <Button
              className="flex-1 bg-blue-500"
              onClick={handleNextStep}
            >
              <Text className="block text-white font-medium">下一步</Text>
            </Button>
          ) : (
            <Button
              className="flex-1 bg-blue-500"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <Text className="block text-white font-medium">
                {submitting ? '提交中...' : '提交审核'}
              </Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
