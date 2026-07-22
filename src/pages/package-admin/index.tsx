import { View, Text, Image, Picker } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Calendar } from '@/components/ui/calendar'
import { Plus, X, ChevronRight, Check, Trash2 } from 'lucide-react-taro'
import { DOUYIN_CATEGORIES, getCategoryPath } from '@/data/categories'
import { format } from 'date-fns'

interface Package {
  id: string
  name: string
  description: string
  price: string
  original_price: string
  badge: string
  features: string
  category: string
  package_type: string
  merchant_id: string
  combinations: any[]
  cover_image: string
  environment_images: string[]
  stock: number
  sale_start_date: string
  sale_end_date: string
  auto_renew: boolean
  is_active: boolean
  created_at: string
  updated_at: string
  // 交易规则 - 限购规则
  purchase_limit: number // 限购数量，0表示不限制
  purchase_limit_type: string // unlimited/limited
  purchase_limit_per_person: number // 每人最多购买
  purchase_limit_per_day: number // 每人每天限购
  purchase_limit_per_month: number // 每人每月限购
  // 交易规则 - 消费规则
  valid_days: number // 有效天数
  valid_from_purchase: boolean // 是否从购买当天开始计算
  valid_date_type: string // days/date
  valid_date_start: string // 指定日期开始
  valid_date_end: string // 指定日期结束
  unavailable_dates: string[] // 不可用日期
  unavailable_date_type: string // all/partial
  unavailable_weekdays: number[] // 每周几不可用 (0-6, 0=周日)
  unavailable_holidays: string[] // 节假日不可用
  available_time_type: string // 可用时段类型：business_hours-营业时间, specified-仅指定时间
  available_time_start: string // 自定义开始时间
  available_time_end: string // 自定义结束时间
  limit_usage_count: boolean // 是否限制使用张数
  usage_count_limit: number // 使用张数限制
  need_reservation: boolean // 是否需要预约
  reservation_hours: number // 预约提前小时数
  // 消费规则详细
  other_discount: string // 店内其他优惠
  private_room: string // 包间说明
  dine_in_type: string // 堂食外带约定：all-全部, dine_in-仅堂食, take_out-仅外带
  has_extra_fee: boolean // 是否有额外费用
  extra_fees: ExtraFee[] // 额外费用列表
  other_notes: string // 其他说明信息
}

interface ExtraFee {
  id: string
  condition: string // 条件描述，如"就餐人数超3位的"
  amount: string // 金额
  unit: string // 单位：每位/每桌
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

  // 交易规则弹窗
  const [showPurchaseLimitModal, setShowPurchaseLimitModal] = useState(false)
  const [showValidDateModal, setShowValidDateModal] = useState(false)
  const [showUnavailableDateModal, setShowUnavailableDateModal] = useState(false)
  const [showAvailableTimeModal, setShowAvailableTimeModal] = useState(false)
  const [showWeekdayPicker, setShowWeekdayPicker] = useState(false)
  const [showHolidayPicker, setShowHolidayPicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [timePickerMode, setTimePickerMode] = useState<'start' | 'end'>('start')

  // 交易规则临时状态
  const [tempPurchaseLimitType, setTempPurchaseLimitType] = useState('unlimited')
  const [tempPurchaseLimit, setTempPurchaseLimit] = useState(0)
  const [tempPurchaseLimitPerDay, setTempPurchaseLimitPerDay] = useState(0)
  const [tempPurchaseLimitPerMonth, setTempPurchaseLimitPerMonth] = useState(0)
  const [tempValidDateType, setTempValidDateType] = useState('days')
  const [tempValidDays, setTempValidDays] = useState(60)
  const [tempValidDaysInput, setTempValidDaysInput] = useState('60')
  const [tempUseValidDays, setTempUseValidDays] = useState(true) // 开关：true=使用指定天数，false=使用指定日期
  const [tempUnavailableDateType, setTempUnavailableDateType] = useState('all')
  const [tempUnavailableWeekdays, setTempUnavailableWeekdays] = useState<number[]>([])
  const [tempUnavailableHolidays, setTempUnavailableHolidays] = useState<string[]>([])
  const [tempUnavailableCalendarDates, setTempUnavailableCalendarDates] = useState<string[]>([])
  const [showCalendarPicker, setShowCalendarPicker] = useState(false)
  const [calendarSelectedDates, setCalendarSelectedDates] = useState<Date[]>([])
  const [tempAvailableTimeType, setTempAvailableTimeType] = useState('business_hours')
  const [tempAvailableTimeStart, setTempAvailableTimeStart] = useState('00:00')
  const [tempAvailableTimeEnd, setTempAvailableTimeEnd] = useState('23:59')
  const [showLimitUsageModal, setShowLimitUsageModal] = useState(false)
  const [tempLimitUsageCount, setTempLimitUsageCount] = useState(1)
  const [datePickerType, setDatePickerType] = useState<'sale' | 'valid'>('sale') // 区分售卖日期和可用日期

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
    package_type: 'combo',
    merchant_id: '',
    combinations: [],
    cover_image: '',
    environment_images: [],
    stock: 0,
    sale_start_date: '',
    sale_end_date: '',
    auto_renew: false,
    is_active: true,
    created_at: '',
    updated_at: '',
    // 交易规则 - 限购规则
    purchase_limit: 0,
    purchase_limit_type: 'unlimited',
    purchase_limit_per_person: 1,
    purchase_limit_per_day: 0,
    purchase_limit_per_month: 0,
    // 交易规则 - 消费规则
    valid_days: 60,
    valid_from_purchase: true,
    valid_date_type: 'days',
    valid_date_start: '',
    valid_date_end: '',
    unavailable_dates: [],
    unavailable_date_type: 'all',
    unavailable_weekdays: [],
    unavailable_holidays: [],
    available_time_type: 'business_hours',
    available_time_start: '',
    available_time_end: '',
    limit_usage_count: false,
    usage_count_limit: 1,
    need_reservation: false,
    reservation_hours: 2,
    // 消费规则详细
    other_discount: '不与店内优惠同享',
    private_room: '不可以在包厢消费使用',
    dine_in_type: 'all',
    has_extra_fee: false,
    extra_fees: [],
    other_notes: ''
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

  // 自动保存草稿（监听 formData 变化）
  useEffect(() => {
    // 只在新建模式下自动保存
    if (id) return
    
    const timer = setTimeout(() => {
      try {
        // 检查是否有任何数据需要保存
        const hasData = formData.name || formData.category || formData.price || 
                       featureItems.length > 0 || combinations.length > 0 ||
                       selectedMerchant || formData.cover_image
        
        if (hasData) {
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
        }
      } catch (e) {
        console.error('自动保存失败:', e)
      }
    }, 500) // 500ms 防抖

    return () => clearTimeout(timer)
  }, [formData, featureItems, combinations, currentStep, packageType, selectedMerchant, id])

  const loadMerchants = async () => {
    try {
      // 商家账号（role_code=1）只允许选择本店，超级管理员可选择全部商家
      const userId = Taro.getStorageSync('user_id') || ''
      if (userId) {
        const merchantRes = await Network.request({
          url: `/api/users/${userId}/merchant`
        })
        console.log('当前用户绑定商家响应:', merchantRes.data)
        const myMerchant = merchantRes.data?.data
        if (myMerchant && myMerchant.id) {
          // 商家账号：只显示本店并自动选中
          setMerchants([myMerchant])
          setSelectedMerchant(myMerchant)
          setFormData(prev => ({ ...prev, merchant_id: String(myMerchant.id) }))
          return
        }
      }
      // 超级管理员或未绑定商家：加载全部商家
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
    setCombinations(prev => [...prev, newCombination])
  }

  const removeCombination = (combId: string) => {
    setCombinations(prev => prev.filter(c => c.id !== combId))
  }

  const updateCombinationName = (combId: string, name: string) => {
    setCombinations(prev => prev.map(c =>
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
    setCombinations(prev => prev.map(c =>
      c.id === combinationId
        ? { ...c, items: [...c.items, newItem] }
        : c
    ))
  }

  const removeItemFromCombination = (combinationId: string, itemId: string) => {
    setCombinations(prev => prev.map(c =>
      c.id === combinationId
        ? { ...c, items: c.items.filter(item => item.id !== itemId) }
        : c
    ))
  }

  const updateItem = (combinationId: string, itemId: string, field: keyof ProductItem, value: string | number) => {
    setCombinations(prev => prev.map(c =>
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
    setCombinations(prev => prev.map(c =>
      c.id === combinationId ? { ...c, select_count: count } : c
    ))
  }

  // 规格选择处理函数
  const openSpecPicker = (comboId: string, itemId: string) => {
    const combo = combinations.find(c => c.id === comboId)
    const item = combo?.items.find(i => i.id === itemId)
    setSpecComboId(comboId)
    setSpecItemId(itemId)
    // 确保 quantity 是数字类型
    setSpecQuantity(Number(item?.quantity) || 1)
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
    setDatePickerType('sale')
    setTempStartDate(formData.sale_start_date || '')
    setTempEndDate(formData.sale_end_date || '')
    setShowDatePicker(true)
  }

  const closeDatePicker = () => {
    setShowDatePicker(false)
  }

  const confirmDate = () => {
    if (datePickerType === 'sale') {
      updateFormData('sale_start_date', tempStartDate)
      updateFormData('sale_end_date', tempEndDate)
    } else {
      // 验证可消费时间段与售卖日期的关系
      // 计算实际售卖结束日期（考虑自动延期半年）
      let actualSaleEndDate = formData.sale_end_date
      if (formData.auto_renew && formData.sale_end_date) {
        const extendedDate = new Date(formData.sale_end_date)
        extendedDate.setMonth(extendedDate.getMonth() + 6)
        actualSaleEndDate = extendedDate.toISOString().split('T')[0]
      }
      // 验证可消费开始日期需在售卖开始日期之后（含当天）
      if (formData.sale_start_date && tempStartDate && tempStartDate < formData.sale_start_date) {
        Taro.showToast({ title: '可消费开始日期需在售卖开始日期之后（含当天）', icon: 'none' })
        return
      }
      // 验证可消费结束日期需在售卖结束日期之后
      if (actualSaleEndDate && tempEndDate && tempEndDate <= actualSaleEndDate) {
        const label = formData.auto_renew ? '延期后售卖结束日期' : '售卖结束日期'
        Taro.showToast({ title: `可消费结束日期需在${label}之后`, icon: 'none' })
        return
      }
      updateFormData('valid_date_start', tempStartDate)
      updateFormData('valid_date_end', tempEndDate)
      updateFormData('valid_date_type', 'date_range')
    }
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
      case 3: // 售卖信息（包含交易规则和消费规则）
        if (formData.stock < 0) {
          Taro.showToast({ title: '请输入有效库存', icon: 'none' })
          return false
        }
        // 验证可用日期
        if (formData.valid_date_type === 'date_range' && (!formData.valid_date_start || !formData.valid_date_end)) {
          Taro.showToast({ title: '请设置可用日期范围', icon: 'none' })
          return false
        }
        // 验证可消费时间段与售卖日期的关系
        if (formData.valid_date_type === 'date_range' && formData.valid_date_start && formData.valid_date_end) {
          // 计算实际售卖结束日期（考虑自动延期半年）
          let actualSaleEndDate = formData.sale_end_date
          if (formData.auto_renew && formData.sale_end_date) {
            const extendedDate = new Date(formData.sale_end_date)
            extendedDate.setMonth(extendedDate.getMonth() + 6)
            actualSaleEndDate = extendedDate.toISOString().split('T')[0]
          }
          // 验证可消费开始日期需在售卖开始日期之后（含当天）
          if (formData.sale_start_date && formData.valid_date_start < formData.sale_start_date) {
            Taro.showToast({ title: '可消费开始日期需在售卖开始日期之后（含当天）', icon: 'none' })
            return false
          }
          // 验证可消费结束日期需在售卖结束日期之后
          if (actualSaleEndDate && formData.valid_date_end <= actualSaleEndDate) {
            const label = formData.auto_renew ? '延期后售卖结束日期' : '售卖结束日期'
            Taro.showToast({ title: `可消费结束日期需在${label}之后`, icon: 'none' })
            return false
          }
        }
        // 验证每日可用时段
        if (formData.available_time_type === 'custom' && (!formData.available_time_start || !formData.available_time_end)) {
          Taro.showToast({ title: '请设置每日可用时段', icon: 'none' })
          return false
        }
        // 验证不可用日期
        if (formData.unavailable_date_type === 'partial' && 
            (!formData.unavailable_weekdays || formData.unavailable_weekdays.length === 0) &&
            (!formData.unavailable_holidays || formData.unavailable_holidays.length === 0) &&
            (!formData.unavailable_dates || formData.unavailable_dates.length === 0)) {
          Taro.showToast({ title: '请至少设定一个不可消费日期', icon: 'none' })
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
      // 后端直接返回套餐对象，没有包裹在 data 字段中
      const pkg = res.data?.data || res.data
      if (pkg && pkg.id) {
        // 确保数组和字符串字段有默认值，避免 null 错误
        setFormData({
          id: pkg.id,
          name: pkg.name || '',
          description: pkg.description || '',
          price: pkg.price || '',
          original_price: pkg.original_price || '',
          badge: pkg.badge || '',
          features: Array.isArray(pkg.features) ? pkg.features : (typeof pkg.features === 'string' ? JSON.parse(pkg.features) : []),
          category: pkg.category || '',
          package_type: pkg.package_type || '',
          merchant_id: pkg.merchant_id || '',
          combinations: Array.isArray(pkg.combinations) ? pkg.combinations : (typeof pkg.combinations === 'string' ? JSON.parse(pkg.combinations) : []),
          cover_image: pkg.cover_image || '',
          environment_images: Array.isArray(pkg.environment_images) ? pkg.environment_images : (typeof pkg.environment_images === 'string' ? JSON.parse(pkg.environment_images) : []),
          stock: pkg.stock || '',
          sale_start_date: pkg.sale_start_date || '',
          sale_end_date: pkg.sale_end_date || '',
          auto_renew: pkg.auto_renew || false,
          is_active: pkg.is_active !== undefined ? pkg.is_active : true,
          created_at: pkg.created_at || '',
          updated_at: pkg.updated_at || '',
          // 交易规则
          purchase_limit: pkg.purchase_limit || 0,
          purchase_limit_type: pkg.purchase_limit_type || 'unlimited',
          purchase_limit_per_person: pkg.purchase_limit_per_person || 1,
          purchase_limit_per_day: pkg.purchase_limit_per_day || 1,
          purchase_limit_per_month: pkg.purchase_limit_per_month || 1,
          // 消费规则
          valid_days: pkg.valid_days || 60,
          valid_from_purchase: pkg.valid_from_purchase !== undefined ? pkg.valid_from_purchase : true,
          valid_date_type: pkg.valid_date_type || 'days',
          valid_date_start: pkg.valid_date_start || '',
          valid_date_end: pkg.valid_date_end || '',
          unavailable_date_type: pkg.unavailable_date_type || 'all',
          unavailable_weekdays: Array.isArray(pkg.unavailable_weekdays) ? pkg.unavailable_weekdays : [],
          unavailable_holidays: Array.isArray(pkg.unavailable_holidays) ? pkg.unavailable_holidays : [],
          unavailable_dates: Array.isArray(pkg.unavailable_dates) ? pkg.unavailable_dates : [],
          available_time_type: pkg.available_time_type || 'business_hours',
          available_time_start: pkg.available_time_start || '',
          available_time_end: pkg.available_time_end || '',
          limit_usage_count: pkg.limit_usage_count || false,
          usage_count_limit: pkg.usage_count_limit || 1,
          need_reservation: pkg.need_reservation || false,
          reservation_hours: pkg.reservation_hours || 2,
          // 消费规则详细
          other_discount: pkg.other_discount || '不与店内优惠同享',
          private_room: pkg.private_room || '不可以在包厢消费使用',
          dine_in_type: pkg.dine_in_type || 'all',
          has_extra_fee: pkg.has_extra_fee || false,
          extra_fees: Array.isArray(pkg.extra_fees) ? pkg.extra_fees : [],
          other_notes: pkg.other_notes || ''
        })
        // 解析 features 为 featureItems
        const featuresData = Array.isArray(pkg.features) ? pkg.features : (typeof pkg.features === 'string' ? JSON.parse(pkg.features) : [])
        if (Array.isArray(featuresData)) {
          setFeatureItems(featuresData.map((text: string, index: number) => ({ id: `feature-${index}`, text })))
        }
        // 加载商品搭配
        const combinationsData = Array.isArray(pkg.combinations) ? pkg.combinations : (typeof pkg.combinations === 'string' ? JSON.parse(pkg.combinations) : [])
        if (Array.isArray(combinationsData)) {
          // 确保 quantity 是数字类型
          const normalizedCombinations = combinationsData.map((combo: ProductCombination) => ({
            ...combo,
            items: combo.items.map((item: ProductItem) => ({
              ...item,
              quantity: Number(item.quantity) || 1
            }))
          }))
          setCombinations(normalizedCombinations)
        }
        // 加载商家信息
        if (pkg.merchant_id) {
          try {
            const merchantRes = await Network.request({
              url: `/api/merchants/${pkg.merchant_id}`
            })
            // 后端直接返回商家对象
            const merchant = merchantRes.data?.data || merchantRes.data
            if (merchant && merchant.id) {
              setSelectedMerchant(merchant)
            }
          } catch {
            console.error('加载商家信息失败')
          }
        }
        // 加载套餐类型
        if (pkg.package_type) {
          setPackageType(pkg.package_type)
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

  // 图片大小限制：5MB
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024

  const checkImageSize = (size: number): boolean => {
    if (size > MAX_IMAGE_SIZE) {
      const sizeMB = (size / 1024 / 1024).toFixed(1)
      Taro.showModal({
        title: '图片过大',
        content: `当前图片 ${sizeMB}MB，超过 5MB 限制。建议选择 5MB 以内的图片，或使用图片压缩工具减小体积后重试。`,
        showCancel: false,
        confirmText: '知道了'
      })
      return false
    }
    return true
  }

  // H5 端通过 FormData 上传文件（Taro.uploadFile 不支持 File 对象）
  const h5UploadFile = async (file: File): Promise<string | null> => {
    const fd = new FormData()
    fd.append('file', file)
    console.log('[Upload] POST /api/upload, file:', file.name, file.type, file.size)
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const json = await res.json()
    console.log('[Upload] Response:', json)
    return json?.data?.url || null
  }

  const handleUploadCover = async () => {
    // 上传周期内禁止重复触发
    if (uploadingCover) return
    const isMiniApp = [Taro.ENV_TYPE.WEAPP, Taro.ENV_TYPE.TT].includes(Taro.getEnv() as any)

    if (!isMiniApp) {
      // H5 端使用文件选择 + FormData 上传
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e: any) => {
        const file = e.target.files[0]
        if (!file) return
        if (!checkImageSize(file.size)) return
        setUploadingCover(true)
        try {
          const url = await h5UploadFile(file)
          if (url) {
            updateFormData('cover_image', url)
            Taro.showToast({ title: '上传成功', icon: 'success' })
          } else {
            Taro.showToast({ title: '上传失败', icon: 'error' })
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

    // 小程序端：使用 chooseMedia（chooseImage 已废弃，部分安卓机选图后会回收小程序导致重启跳首页）
    try {
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      const tempFile = res.tempFiles[0]
      if (!tempFile) return
      if (!checkImageSize(tempFile.size)) return

      setUploadingCover(true)
      Taro.showLoading({ title: '上传中...', mask: true })
      try {
        const uploadRes = await Network.uploadFile({
          url: '/api/upload',
          filePath: tempFile.tempFilePath,
          name: 'file'
        })
        // 小程序 uploadFile 返回的 data 是字符串，必须 JSON.parse
        const resData = JSON.parse(uploadRes.data)
        console.log('[PackageAdmin] upload cover response:', resData)
        if (resData?.code === 200 && resData?.data?.url) {
          updateFormData('cover_image', resData.data.url)
          Taro.showToast({ title: '上传成功', icon: 'success' })
        } else {
          Taro.showToast({ title: resData?.msg || '上传失败，请重试', icon: 'none' })
        }
      } finally {
        Taro.hideLoading()
      }
    } catch (error) {
      const errMsg = (error as { errMsg?: string })?.errMsg || ''
      // 用户取消选择不提示
      if (errMsg.includes('cancel')) return
      console.error('[PackageAdmin] upload cover failed:', error)
      Taro.showToast({ title: '上传失败，请检查网络后重试', icon: 'none' })
    } finally {
      setUploadingCover(false)
    }
  }

  const handleUploadEnv = async () => {
    // 上传周期内禁止重复触发
    if (uploadingEnv) return
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
        const files = Array.from(e.target.files).slice(0, remaining) as File[]
        if (files.length === 0) return
        // 校验每个文件大小
        for (const file of files) {
          if (!checkImageSize(file.size)) return
        }
        setUploadingEnv(true)
        try {
          const newUrls = [...formData.environment_images]
          for (const file of files) {
            const url = await h5UploadFile(file)
            if (url) {
              newUrls.push(url)
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

    // 小程序端：使用 chooseMedia（chooseImage 已废弃，部分安卓机选图后会回收小程序导致重启跳首页）
    try {
      const res = await Taro.chooseMedia({
        count: remaining,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })

      if (!res.tempFiles || res.tempFiles.length === 0) return
      // 校验每个文件大小
      for (const f of res.tempFiles) {
        if (!checkImageSize(f.size)) return
      }

      setUploadingEnv(true)
      Taro.showLoading({ title: '上传中...', mask: true })
      try {
        const newUrls = [...formData.environment_images]
        let failCount = 0
        for (const f of res.tempFiles) {
          try {
            const uploadRes = await Network.uploadFile({
              url: '/api/upload',
              filePath: f.tempFilePath,
              name: 'file'
            })
            // 小程序 uploadFile 返回的 data 是字符串，必须 JSON.parse
            const resData = JSON.parse(uploadRes.data)
            console.log('[PackageAdmin] upload env response:', resData)
            if (resData?.code === 200 && resData?.data?.url) {
              newUrls.push(resData.data.url)
            } else {
              failCount++
            }
          } catch (singleErr) {
            console.error('[PackageAdmin] single env image upload failed:', singleErr)
            failCount++
          }
        }
        if (newUrls.length > formData.environment_images.length) {
          updateFormData('environment_images', newUrls)
        }
        if (failCount > 0) {
          Taro.showToast({ title: `${failCount}张图片上传失败，请重试`, icon: 'none' })
        } else {
          Taro.showToast({ title: '上传成功', icon: 'success' })
        }
      } finally {
        Taro.hideLoading()
      }
    } catch (error) {
      const errMsg = (error as { errMsg?: string })?.errMsg || ''
      // 用户取消选择不提示
      if (errMsg.includes('cancel')) return
      console.error('[PackageAdmin] upload env failed:', error)
      Taro.showToast({ title: '上传失败，请检查网络后重试', icon: 'none' })
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
        name: formData.name,
        description: formData.description,
        price: formData.price,
        original_price: formData.original_price || null,
        badge: formData.badge,
        features: featuresJson,
        cover_image: formData.cover_image,
        environment_images: formData.environment_images,
        stock: formData.stock,
        sale_start_date: formData.sale_start_date || null,
        sale_end_date: formData.sale_end_date || null,
        auto_renew: formData.auto_renew || false,
        category: formData.category || null,
        package_type: packageType,
        // 商家账号仅1家可选门店时，强制使用本店ID，防止竞态或越权写入其他商家
        merchant_id: merchants.length === 1 ? merchants[0]?.id : (selectedMerchant?.id || null),
        combinations: combinations,
        // 交易规则
        purchase_limit: formData.purchase_limit,
        purchase_limit_type: formData.purchase_limit_type,
        purchase_limit_per_day: formData.purchase_limit_per_day,
        purchase_limit_per_month: formData.purchase_limit_per_month,
        valid_days: formData.valid_days,
        valid_from_purchase: formData.valid_from_purchase,
        valid_date_type: formData.valid_date_type,
        valid_date_start: formData.valid_date_start,
        valid_date_end: formData.valid_date_end,
        unavailable_dates: formData.unavailable_dates,
        unavailable_date_type: formData.unavailable_date_type,
        unavailable_weekdays: formData.unavailable_weekdays,
        unavailable_holidays: formData.unavailable_holidays,
        available_time_type: formData.available_time_type,
        available_time_start: formData.available_time_start,
        available_time_end: formData.available_time_end,
        limit_usage_count: formData.limit_usage_count,
        usage_count_limit: formData.usage_count_limit,
        need_reservation: formData.need_reservation,
        reservation_hours: formData.reservation_hours,
        // 消费规则
        other_discount: formData.other_discount,
        private_room: formData.private_room,
        dine_in_type: formData.dine_in_type,
        has_extra_fee: formData.has_extra_fee,
        extra_fees: formData.extra_fees,
        other_notes: formData.other_notes
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

      if (res.data?.id || res.data?.data?.id) {
        Taro.showToast({ title: '提交成功', icon: 'success' })
        // 提交成功后清除草稿
        Taro.removeStorageSync('package_draft')
        setTimeout(() => {
          Taro.navigateBack()
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.message || '提交失败', icon: 'error' })
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
            package_type: '',
            merchant_id: '',
            combinations: [],
            cover_image: '',
            environment_images: [],
            stock: 0,
            sale_start_date: '',
            sale_end_date: '',
            auto_renew: false,
            is_active: true,
            created_at: '',
            updated_at: '',
            // 交易规则
            purchase_limit: 0,
            purchase_limit_type: 'unlimited',
            purchase_limit_per_person: 1,
            purchase_limit_per_day: 1,
            purchase_limit_per_month: 1,
            // 消费规则
            valid_days: 60,
            valid_from_purchase: true,
            valid_date_type: 'days',
            valid_date_start: '',
            valid_date_end: '',
            unavailable_date_type: 'all',
            unavailable_weekdays: [],
            unavailable_holidays: [],
            unavailable_dates: [],
            available_time_type: 'business_hours',
            available_time_start: '',
            available_time_end: '',
            limit_usage_count: false,
            usage_count_limit: 1,
            need_reservation: false,
            reservation_hours: 2,
            // 消费规则详细
            other_discount: '不与店内优惠同享',
            private_room: '不可以在包厢消费使用',
            dine_in_type: 'all',
            has_extra_fee: false,
            extra_fees: [],
            other_notes: ''
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
          // 确保 quantity 是数字类型
          const normalizedCombinations = draft.combinations.map((combo: ProductCombination) => ({
            ...combo,
            items: combo.items.map((item: ProductItem) => ({
              ...item,
              quantity: Number(item.quantity) || 1
            }))
          }))
          setCombinations(normalizedCombinations)
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
      {/* 草稿操作 + 步骤指示器 */}
      <View className="bg-white sticky top-0 z-10 border-b border-gray-200">
        <View className="flex items-center justify-end gap-2 px-4 pt-3">
          <Button size="sm" variant="outline" onClick={clearDraft}>
            <Text className="text-xs">清除草稿</Text>
          </Button>
          <Button size="sm" variant="outline" onClick={saveDraft}>
            <Text className="text-xs">保存草稿</Text>
          </Button>
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
                    ? 'bg-[#FF4757]'
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
                  index === currentStep ? 'text-[#FF4757] font-medium' : 'text-gray-600'
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
                      <Badge className="bg-red-100 text-[#FF4757] text-xs">
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
                    onClick={() => {
                      // 商家账号（仅1家可选门店）锁定选择，不可切换到其他商家
                      if (merchants.length > 1) {
                        setShowMerchantPicker(true)
                      }
                    }}
                  >
                    <Text className="block text-sm text-gray-800">
                      {selectedMerchant ? selectedMerchant.name : '请选择商家'}
                    </Text>
                    <View className="flex items-center gap-2">
                      {selectedMerchant && merchants.length <= 1 && (
                        <Badge className="bg-green-100 text-green-600 text-xs">本店</Badge>
                      )}
                      {selectedMerchant && merchants.length > 1 && (
                        <Badge className="bg-red-100 text-[#FF4757] text-xs">已选择</Badge>
                      )}
                      {merchants.length > 1 && <ChevronRight size={16} color="#9ca3af" />}
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
                    <Text className="block text-[#FF4757]">*</Text>
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
                        className="w-full mt-2 text-[#FF4757]"
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
                          // 如果几选几，按商品总价（单价×份数）从高到低排序，取前 select_count 个商品的总价
                          const sortedItems = [...combo.items].sort((a, b) => {
                            const totalA = (parseFloat(a.price) || 0) * (Number(a.quantity) || 1)
                            const totalB = (parseFloat(b.price) || 0) * (Number(b.quantity) || 1)
                            return totalB - totalA
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
                    <Text className="block text-[#FF4757]">*</Text>
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
                    <Text className="block text-xs text-[#FF4757]">规范示例</Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mb-3">在商品详情页以 4:3 比例展示，建议 5MB 以内</Text>

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
                    <Text className="block text-xs text-[#FF4757]">查看示例</Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mb-3">良好的环境也是用户的优先选择，最多可上传 10 张，单张建议 5MB 以内。</Text>

                  <View className="flex flex-wrap gap-2">
                    {Array.isArray(formData.environment_images) && formData.environment_images.map((url, index) => (
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
                    <Text className="block text-[#FF4757]">*</Text>
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
                    <Text className="block text-[#FF4757]">*</Text>
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
                        formData.auto_renew ? 'bg-[#FF4757]' : 'bg-gray-300'
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
                          ? 'border-[#FF4757] bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => updateFormData('is_active', true)}
                    >
                      <Text className={`block text-sm ${formData.is_active ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                        上架
                      </Text>
                    </View>
                    <View
                      className={`flex-1 py-3 rounded-lg border-2 text-center ${
                        !formData.is_active
                          ? 'border-[#FF4757] bg-red-50'
                          : 'border-gray-200 bg-white'
                      }`}
                      onClick={() => updateFormData('is_active', false)}
                    >
                      <Text className={`block text-sm ${!formData.is_active ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                        下架
                      </Text>
                    </View>
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 交易规则 */}
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">交易规则</Text>

                {/* 限购规则 */}
                <View
                  className="flex items-center justify-between py-3 border-b border-gray-100"
                  onClick={() => {
                    setTempPurchaseLimitType(formData.purchase_limit_type);
                    setTempPurchaseLimit(formData.purchase_limit);
                    setTempPurchaseLimitPerDay(formData.purchase_limit_per_day);
                    setTempPurchaseLimitPerMonth(formData.purchase_limit_per_month);
                    setShowPurchaseLimitModal(true);
                  }}
                >
                  <Text className="block text-sm text-gray-800">限购规则</Text>
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-gray-500">
                      {formData.purchase_limit_type === 'unlimited'
                        ? '不限制'
                        : (() => {
                            const parts: string[] = []
                            if (formData.purchase_limit > 0) parts.push(`每人${formData.purchase_limit}份`)
                            if (formData.purchase_limit_per_day > 0) parts.push(`每日${formData.purchase_limit_per_day}份`)
                            if (formData.purchase_limit_per_month > 0) parts.push(`每月${formData.purchase_limit_per_month}份`)
                            return parts.length > 0 ? parts.join('，') : '限制'
                          })()}
                    </Text>
                    <Text className="block text-gray-400">›</Text>
                  </View>
                </View>

                {/* 消费规则 */}
                <Text className="block text-base font-semibold text-gray-800 mt-4 mb-4">消费规则</Text>

                {/* 可用日期 */}
                <View
                  className="flex items-center justify-between py-3 border-b border-gray-100"
                  onClick={() => {
                    setTempValidDateType(formData.valid_date_type || 'days')
                    setTempValidDays(formData.valid_days || 60)
                    setTempValidDaysInput(String(formData.valid_days || 60))
                    setShowValidDateModal(true)
                  }}
                >
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-gray-800">可用日期</Text>
                    <Text className="block text-[#FF4757]">*</Text>
                  </View>
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-[#FF4757]">编辑</Text>
                    <Text className="block text-gray-400">›</Text>
                  </View>
                </View>
                <View className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                  <Text className="block text-sm text-gray-600">
                    {formData.valid_date_type === 'days'
                      ? `自购买次日起${formData.valid_days}天，购买当天默认可用`
                      : formData.valid_date_start && formData.valid_date_end
                      ? `${formData.valid_date_start} - ${formData.valid_date_end}`
                      : '自购买次日起60天，购买当天默认可用'}
                  </Text>
                </View>

                {/* 不可用日期 */}
                <View
                  className="flex items-center justify-between py-3 border-b border-gray-100"
                  onClick={() => {
                    setTempUnavailableDateType(formData.unavailable_date_type)
                    setTempUnavailableWeekdays(formData.unavailable_weekdays || [])
                    setTempUnavailableHolidays(formData.unavailable_holidays || [])
                    setTempUnavailableCalendarDates(formData.unavailable_dates || [])
                    setShowUnavailableDateModal(true)
                  }}
                >
                  <Text className="block text-sm text-gray-800">不可用日期</Text>
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-[#FF4757]">编辑</Text>
                    <Text className="block text-gray-400">›</Text>
                  </View>
                </View>
                <View className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                  <Text className="block text-sm text-gray-600">
                    {formData.unavailable_date_type === 'all'
                      ? '所有日期均可用'
                      : [
                          formData.unavailable_weekdays && formData.unavailable_weekdays.length > 0
                            ? `每周${formData.unavailable_weekdays.map(d => ['日', '一', '二', '三', '四', '五', '六'][d]).join('、')}不可用`
                            : '',
                          formData.unavailable_holidays && formData.unavailable_holidays.length > 0
                            ? `${formData.unavailable_holidays.length}个节假日不可用`
                            : '',
                          formData.unavailable_dates && formData.unavailable_dates.length > 0
                            ? `${formData.unavailable_dates.length}个指定日期不可用`
                            : '',
                        ].filter(Boolean).join('；') || '所有日期均可用'}
                  </Text>
                </View>

                {/* 每日可用时段 */}
                <View
                  className="flex items-center justify-between py-3 border-b border-gray-100"
                  onClick={() => {
                    setTempAvailableTimeType(formData.available_time_type)
                    setTempAvailableTimeStart(formData.available_time_start || '00:00')
                    setTempAvailableTimeEnd(formData.available_time_end || '23:59')
                    setShowAvailableTimeModal(true)
                  }}
                >
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-gray-800">每日可用时段</Text>
                    <Text className="block text-[#FF4757]">*</Text>
                  </View>
                  <View className="flex items-center gap-1">
                    <Text className="block text-sm text-[#FF4757]">编辑</Text>
                    <Text className="block text-gray-400">›</Text>
                  </View>
                </View>
                <View className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                  <Text className="block text-sm text-gray-600">
                    {formData.available_time_type === 'business_hours'
                      ? '营业时间可用'
                      : `${formData.available_time_start || '00:00'} - ${formData.available_time_end || '23:59'}`}
                  </Text>
                </View>

                {/* 限制使用张数 */}
                <View
                  className="flex items-center justify-between py-3 border-b border-gray-100"
                  onClick={() => {
                    setTempLimitUsageCount(formData.usage_count_limit || 1);
                    setShowLimitUsageModal(true);
                  }}
                >
                  <Text className="block text-sm text-gray-800">限制使用张数</Text>
                  <Switch
                    checked={formData.limit_usage_count}
                    onCheckedChange={(checked) => updateFormData('limit_usage_count', checked)}
                  />
                </View>
                {formData.limit_usage_count && (
                  <View className="bg-gray-50 rounded-lg px-4 py-3 mb-4">
                    <Text className="block text-sm text-gray-600">每单限 {formData.usage_count_limit || 1} 张</Text>
                  </View>
                )}

                {/* 预约规则 */}
                <View className="flex items-center justify-between py-3">
                  <Text className="block text-sm text-gray-800">预约规则</Text>
                  <Switch
                    checked={formData.need_reservation}
                    onCheckedChange={(checked) => updateFormData('need_reservation', checked)}
                  />
                </View>
                {formData.need_reservation && (
                  <View className="bg-gray-50 rounded-lg px-4 py-3 mt-2">
                    <View className="flex items-center gap-2">
                      <Text className="block text-sm text-gray-600">需提前</Text>
                      <View className="w-20">
                        <Input
                          className="bg-white border border-gray-200 rounded-md px-2 py-1 text-center text-sm"
                          type="number"
                          value={String(formData.reservation_hours || '')}
                          placeholder="2"
                          onInput={(e) => {
                            const val = parseInt(e.detail.value) || 0
                            if (val >= 0) {
                              updateFormData('reservation_hours', val)
                            }
                          }}
                        />
                      </View>
                      <Text className="block text-sm text-gray-600">小时预约</Text>
                    </View>
                  </View>
                )}
              </CardContent>
            </Card>

            {/* 消费规则详细 */}
            <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <Text className="block text-base font-semibold text-gray-800 mb-4">消费规则详细</Text>

                {/* 店内其他优惠 */}
                <View className="mb-4">
                  <Text className="block text-sm font-medium text-gray-800 mb-3">店内其他优惠</Text>
                  <View className="flex gap-3">
                    <Button
                      className={`flex-1 h-10 rounded-lg text-sm ${formData.other_discount === '可以与店内其他优惠同享' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-700'}`}
                      variant="ghost"
                      onClick={() => setFormData({ ...formData, other_discount: '可以与店内其他优惠同享' })}
                    >
                      可以与优惠同享
                    </Button>
                    <Button
                      className={`flex-1 h-10 rounded-lg text-sm ${formData.other_discount !== '可以与店内其他优惠同享' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-700'}`}
                      variant="ghost"
                      onClick={() => setFormData({ ...formData, other_discount: '不与店内优惠同享' })}
                    >
                      不与优惠同享
                    </Button>
                  </View>
                </View>

                {/* 包厢说明 */}
                <View className="mb-4">
                  <Text className="block text-sm font-medium text-gray-800 mb-2">包厢说明</Text>
                  <View className="flex gap-2">
                    <Button
                      className={`flex-1 rounded-lg py-2 text-sm ${formData.private_room === '可以在包厢消费使用' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormData({ ...formData, private_room: '可以在包厢消费使用' })}
                    >
                      可以在包厢使用
                    </Button>
                    <Button
                      className={`flex-1 rounded-lg py-2 text-sm ${formData.private_room === '不可以在包厢消费使用' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormData({ ...formData, private_room: '不可以在包厢消费使用' })}
                    >
                      不可以在包厢使用
                    </Button>
                  </View>
                </View>

                {/* 堂食外带约定 */}
                <View className="mb-4">
                  <Text className="block text-sm font-medium text-gray-800 mb-2">堂食外带约定</Text>
                  <View className="flex gap-2">
                    <Button
                      className={`flex-1 rounded-lg py-2 text-sm ${formData.dine_in_type === 'dine_in' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormData({ ...formData, dine_in_type: 'dine_in' })}
                    >
                      仅限堂食
                    </Button>
                    <Button
                      className={`flex-1 rounded-lg py-2 text-sm ${formData.dine_in_type === 'take_out' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormData({ ...formData, dine_in_type: 'take_out' })}
                    >
                      仅限外带
                    </Button>
                    <Button
                      className={`flex-1 rounded-lg py-2 text-sm ${formData.dine_in_type === 'all' ? 'bg-[#FF4757] text-white' : 'bg-gray-100 text-gray-600'}`}
                      onClick={() => setFormData({ ...formData, dine_in_type: 'all' })}
                    >
                      堂食外带都可以
                    </Button>
                  </View>
                </View>

                {/* 额外费用 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm font-medium text-gray-800">额外费用</Text>
                    </View>
                    <View className="flex items-center gap-4">
                      <View className="flex items-center gap-2">
                        <View
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            !formData.has_extra_fee ? 'border-[#FF4757]' : 'border-gray-300'
                          }`}
                          onClick={() => updateFormData('has_extra_fee', false)}
                        >
                          {!formData.has_extra_fee && <View className="w-3 h-3 bg-[#FF4757] rounded-full" />}
                        </View>
                        <Text className="block text-sm text-gray-700">无</Text>
                      </View>
                      <View className="flex items-center gap-2">
                        <View
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.has_extra_fee ? 'border-[#FF4757]' : 'border-gray-300'
                          }`}
                          onClick={() => updateFormData('has_extra_fee', true)}
                        >
                          {formData.has_extra_fee && <View className="w-3 h-3 bg-[#FF4757] rounded-full" />}
                        </View>
                        <Text className="block text-sm text-gray-700">有</Text>
                      </View>
                    </View>
                  </View>

                  {/* 额外费用列表 */}
                  {formData.has_extra_fee && formData.extra_fees.length > 0 && (
                    <View className="mt-3 space-y-2">
                      {formData.extra_fees.map((fee) => (
                        <View key={fee.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-3">
                          <Text className="block text-sm text-gray-700 flex-1">{fee.condition}</Text>
                          <Text className="block text-sm text-gray-700">{fee.amount}</Text>
                          <Text className="block text-sm text-gray-500">{fee.unit}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View className="mt-3">
                    <Text className="block text-sm text-[#FF4757]">+ 添加收费项 ({formData.extra_fees.length})</Text>
                  </View>
                </View>

                {/* 其他说明信息 */}
                <View>
                  <View className="flex items-center justify-between mb-2">
                    <Text className="block text-sm font-medium text-gray-800">其他说明信息</Text>
                  </View>
                  <Text className="block text-xs text-gray-500 mb-2">
                    若需填写多项可直接换行，无需在内容前标注序号。不得存在&quot;美团&quot;、&quot;点评&quot;、&quot;最终解释权&quot;等字样
                  </Text>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Textarea
                      className="w-full bg-transparent"
                      style={{ minHeight: '100px' }}
                      placeholder="非必填，如有特殊情况请补充"
                      maxlength={2000}
                      value={formData.other_notes}
                      onInput={(e) => updateFormData('other_notes', e.detail.value)}
                    />
                    <Text className="block text-xs text-gray-400 text-right mt-1">
                      {formData.other_notes.length}/2000
                    </Text>
                  </View>
                </View>
              </CardContent>
            </Card>
          </View>
        )}

        {/* 品类选择弹窗 */}
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
                      selectedLevel1 === level1.id ? 'bg-red-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedLevel1(level1.id);
                      setSelectedLevel2('');
                    }}
                  >
                    <View className="flex items-center justify-between">
                      <Text className="block text-sm font-medium text-gray-800">{level1.name}</Text>
                      {selectedLevel1 === level1.id && !selectedLevel2 && (
                        <Check size={16} color="#FF4757" />
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
                            selectedLevel2 === level2.id ? 'bg-red-50' : ''
                          }`}
                          onClick={() => {
                            setSelectedLevel2(level2.id);
                            setShowCategoryPicker(false);
                            // 更新表单数据
                            const newCategory = `${level1.name} · ${level2.name}`;
                            setFormData((prev) => ({
                              ...prev,
                              category: newCategory
                            }));
                          }}
                        >
                          <View className="flex items-center justify-between">
                            <Text className="block text-sm text-gray-600">{level2.name}</Text>
                            {selectedLevel2 === level2.id && (
                              <Check size={16} color="#FF4757" />
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
                  packageType === 'combo' ? 'bg-red-50' : ''
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
                  {packageType === 'combo' && <Check size={20} color="#FF4757" />}
                </View>
              </View>

              <View
                className={`px-4 py-4 ${
                  packageType === 'voucher' ? 'bg-red-50' : ''
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
                  {packageType === 'voucher' && <Check size={20} color="#FF4757" />}
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
                      selectedMerchant?.id === merchant.id ? 'bg-red-50' : ''
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
                        <Check size={20} color="#FF4757" />
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
                        ? 'bg-red-50 border-[#FF4757]'
                        : 'bg-white border-gray-200'
                    }`}
                    onClick={() => setSpecUnit(unit)}
                  >
                    <Text className={`block text-sm ${specUnit === unit ? 'text-[#FF4757]' : 'text-gray-700'}`}>
                      {unit}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* 确认按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={confirmSpec}
              >
                <Text className="block text-white font-medium text-base">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 限购规则弹窗 */}
      {showPurchaseLimitModal && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 200 }}
          onClick={() => setShowPurchaseLimitModal(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">设置限购规则</Text>
              <View onClick={() => setShowPurchaseLimitModal(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 限购类型选择 */}
            <View className="p-4">
              <View className="flex gap-3 mb-6">
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempPurchaseLimitType === 'unlimited'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempPurchaseLimitType('unlimited')}
                >
                  <Text className={`block text-sm ${tempPurchaseLimitType === 'unlimited' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    不限制购买
                  </Text>
                </View>
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempPurchaseLimitType === 'limited'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempPurchaseLimitType('limited')}
                >
                  <Text className={`block text-sm ${tempPurchaseLimitType === 'limited' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    限制购买
                  </Text>
                </View>
              </View>

              {/* 限制购买选项 */}
              {tempPurchaseLimitType === 'limited' && (
                <View className="space-y-4">
                  {/* 每人最多购买 */}
                  <View className="flex items-center justify-between">
                    <Text className="block text-sm text-gray-800">每人最多购买</Text>
                    <View
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${
                        tempPurchaseLimit > 0 ? 'bg-[#FF4757]' : 'bg-gray-300'
                      }`}
                      onClick={() => setTempPurchaseLimit(tempPurchaseLimit > 0 ? 0 : 1)}
                    >
                      <View
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          tempPurchaseLimit > 0 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </View>
                  </View>
                  {tempPurchaseLimit > 0 && (
                    <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <Text className="block text-sm text-gray-600">限制数量（份）</Text>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimit(Math.max(1, tempPurchaseLimit - 1))}
                        >
                          <Text className="block text-lg text-gray-600">-</Text>
                        </View>
                        <Text className="block text-lg font-medium text-gray-900" style={{ width: '32px', textAlign: 'center' }}>{tempPurchaseLimit}</Text>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimit(tempPurchaseLimit + 1)}
                        >
                          <Text className="block text-lg text-gray-600">+</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 每人每天最多购买 */}
                  <View className="flex items-center justify-between">
                    <Text className="block text-sm text-gray-800">每人每天最多购买</Text>
                    <View
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${
                        tempPurchaseLimitPerDay > 0 ? 'bg-[#FF4757]' : 'bg-gray-300'
                      }`}
                      onClick={() => setTempPurchaseLimitPerDay(tempPurchaseLimitPerDay > 0 ? 0 : 1)}
                    >
                      <View
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          tempPurchaseLimitPerDay > 0 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </View>
                  </View>
                  {tempPurchaseLimitPerDay > 0 && (
                    <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <Text className="block text-sm text-gray-600">限制数量（份）</Text>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimitPerDay(Math.max(1, tempPurchaseLimitPerDay - 1))}
                        >
                          <Text className="block text-lg text-gray-600">-</Text>
                        </View>
                        <Text className="block text-lg font-medium text-gray-900" style={{ width: '32px', textAlign: 'center' }}>{tempPurchaseLimitPerDay}</Text>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimitPerDay(tempPurchaseLimitPerDay + 1)}
                        >
                          <Text className="block text-lg text-gray-600">+</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* 每人每月最多购买 */}
                  <View className="flex items-center justify-between">
                    <Text className="block text-sm text-gray-800">每人每月最多购买</Text>
                    <View
                      className={`w-12 h-6 rounded-full p-1 transition-colors ${
                        tempPurchaseLimitPerMonth > 0 ? 'bg-[#FF4757]' : 'bg-gray-300'
                      }`}
                      onClick={() => setTempPurchaseLimitPerMonth(tempPurchaseLimitPerMonth > 0 ? 0 : 1)}
                    >
                      <View
                        className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          tempPurchaseLimitPerMonth > 0 ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </View>
                  </View>
                  {tempPurchaseLimitPerMonth > 0 && (
                    <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <Text className="block text-sm text-gray-600">限制数量（份）</Text>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimitPerMonth(Math.max(1, tempPurchaseLimitPerMonth - 1))}
                        >
                          <Text className="block text-lg text-gray-600">-</Text>
                        </View>
                        <Text className="block text-lg font-medium text-gray-900" style={{ width: '32px', textAlign: 'center' }}>{tempPurchaseLimitPerMonth}</Text>
                        <View
                          style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}
                          onClick={() => setTempPurchaseLimitPerMonth(tempPurchaseLimitPerMonth + 1)}
                        >
                          <Text className="block text-lg text-gray-600">+</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 确认按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => {
                  updateFormData('purchase_limit_type', tempPurchaseLimitType)
                  if (tempPurchaseLimitType === 'unlimited') {
                    // 选择不限购时，重置所有限制条件
                    updateFormData('purchase_limit', 0)
                    updateFormData('purchase_limit_per_day', 0)
                    updateFormData('purchase_limit_per_month', 0)
                    setTempPurchaseLimit(0)
                    setTempPurchaseLimitPerDay(0)
                    setTempPurchaseLimitPerMonth(0)
                  } else {
                    updateFormData('purchase_limit', tempPurchaseLimit)
                    updateFormData('purchase_limit_per_day', tempPurchaseLimitPerDay)
                    updateFormData('purchase_limit_per_month', tempPurchaseLimitPerMonth)
                  }
                  setShowPurchaseLimitModal(false)
                }}
              >
                <Text className="block text-white font-medium">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 可用日期弹窗 */}
      {showValidDateModal && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 200 }}
          onClick={() => setShowValidDateModal(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">设置可用日期</Text>
              <View onClick={() => setShowValidDateModal(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 可用日期类型选择 */}
            <View className="p-4">
              <View className="flex gap-3 mb-6">
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempValidDateType === 'days'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempValidDateType('days')}
                >
                  <Text className={`block text-sm ${tempValidDateType === 'days' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    指定天数可用
                  </Text>
                </View>
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempValidDateType === 'date_range'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempValidDateType('date_range')}
                >
                  <Text className={`block text-sm ${tempValidDateType === 'date_range' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    指定日期可用
                  </Text>
                </View>
              </View>

              {/* 指定天数 */}
              {tempValidDateType === 'days' && (
                <View className="space-y-4">
                  {/* 开关：使用指定天数 */}
                  <View className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <View className="flex-1">
                      <Text className="block text-base font-medium text-gray-900">使用指定天数</Text>
                      <Text className="block text-xs text-gray-500 mt-1">关闭后将使用指定日期</Text>
                    </View>
                    <Switch
                      checked={tempUseValidDays}
                      onCheckedChange={(checked) => {
                        setTempUseValidDays(checked)
                      }}
                    />
                  </View>

                  {tempUseValidDays && (
                    <>
                      <View className="flex items-center justify-between">
                        <Text className="block text-base font-medium text-gray-900">自购买次日起</Text>
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                          <Text className="block text-2xl font-medium text-gray-900">{tempValidDays}</Text>
                          <Text className="block text-sm text-gray-600">天</Text>
                        </View>
                      </View>
                      <Text className="block text-sm text-gray-500">购买当日默认可用</Text>
                      
                      {/* 天数输入框 */}
                      <View className="flex items-center justify-center gap-2 mt-4">
                        <View className="bg-gray-50 rounded-lg px-4 py-3 flex-1">
                          <Input
                            className="w-full text-center text-2xl font-medium text-gray-900"
                            type="number"
                            value={tempValidDaysInput}
                            onInput={(e) => {
                              const val = e.detail.value
                              setTempValidDaysInput(val)
                              const num = parseInt(val)
                              if (!Number.isNaN(num) && num > 0) {
                                setTempValidDays(num)
                              }
                            }}
                            placeholder="请输入天数"
                          />
                        </View>
                        <Text className="block text-base text-gray-600">天</Text>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* 指定日期范围 */}
              {tempValidDateType === 'date_range' && (
                <View className="space-y-4">
                  <View className="flex items-center justify-between">
                    <Text className="block text-base font-medium text-gray-900">顾客可消费时间范围</Text>
                    <View
                      className="flex items-center gap-1"
                      onClick={() => {
                        setDatePickerType('valid')
                        setShowDatePicker(true)
                        setTempStartDate(formData.valid_date_start)
                        setTempEndDate(formData.valid_date_end)
                      }}
                    >
                      <Text className="block text-sm text-[#FF4757]">编辑</Text>
                      <Text className="block text-sm text-gray-400">›</Text>
                    </View>
                  </View>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">
                      {formData.valid_date_start && formData.valid_date_end
                        ? `${formData.valid_date_start} ~ ${formData.valid_date_end}`
                        : '请选择日期范围'}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 确认按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => {
                  // 根据选择的类型决定保存哪种数据
                  if (tempValidDateType === 'date_range' && tempStartDate && tempEndDate) {
                    // 验证可消费时间段与售卖日期的关系
                    // 计算实际售卖结束日期（考虑自动延期半年）
                    let actualSaleEndDate = formData.sale_end_date
                    if (formData.auto_renew && formData.sale_end_date) {
                      const extendedDate = new Date(formData.sale_end_date)
                      extendedDate.setMonth(extendedDate.getMonth() + 6)
                      actualSaleEndDate = extendedDate.toISOString().split('T')[0]
                    }
                    // 验证可消费开始日期需在售卖开始日期之后（含当天）
                    if (formData.sale_start_date && tempStartDate < formData.sale_start_date) {
                      Taro.showToast({ title: '可消费开始日期需在售卖开始日期之后（含当天）', icon: 'none' })
                      return
                    }
                    // 验证可消费结束日期需在售卖结束日期之后
                    if (actualSaleEndDate && tempEndDate <= actualSaleEndDate) {
                      const label = formData.auto_renew ? '延期后售卖结束日期' : '售卖结束日期'
                      Taro.showToast({ title: `可消费结束日期需在${label}之后`, icon: 'none' })
                      return
                    }
                    // 选择了指定日期可用且有日期：保存为 date_range
                    updateFormData('valid_date_type', 'date_range')
                    updateFormData('valid_date_start', tempStartDate)
                    updateFormData('valid_date_end', tempEndDate)
                  } else {
                    // 选择了指定天数可用或没有设置日期：保存为 days
                    updateFormData('valid_date_type', 'days')
                    updateFormData('valid_days', tempValidDays)
                  }
                  setShowValidDateModal(false)
                }}
              >
                <Text className="block text-white font-medium">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 不可用日期弹窗 */}
      {showUnavailableDateModal && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 200 }}
          onClick={() => setShowUnavailableDateModal(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">不可用日期</Text>
              <View onClick={() => setShowUnavailableDateModal(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 不可用日期类型选择 */}
            <View className="p-4">
              <View className="flex gap-3 mb-6">
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempUnavailableDateType === 'all'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempUnavailableDateType('all')}
                >
                  <Text className={`block text-sm ${tempUnavailableDateType === 'all' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    所有日期均可用
                  </Text>
                </View>
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempUnavailableDateType === 'partial'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempUnavailableDateType('partial')}
                >
                  <Text className={`block text-sm ${tempUnavailableDateType === 'partial' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    部分日期不可用
                  </Text>
                </View>
              </View>

              {/* 部分日期不可用选项 */}
              {tempUnavailableDateType === 'partial' && (
                <View className="space-y-4">
                  {/* 每周几不可用 */}
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => setShowWeekdayPicker(true)}
                  >
                    <Text className="block text-sm text-gray-800">每周几不可用</Text>
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-400">
                        {tempUnavailableWeekdays.length > 0 ? `已选${tempUnavailableWeekdays.length}天` : '去选择'}
                      </Text>
                      <Text className="block text-sm text-gray-400">›</Text>
                    </View>
                  </View>

                  {/* 节假日不可用 */}
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => setShowHolidayPicker(true)}
                  >
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-800">节假日不可用</Text>
                      <Text className="block text-xs text-gray-400">?</Text>
                    </View>
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-400">
                        {tempUnavailableHolidays.length > 0 ? `已选${tempUnavailableHolidays.length}个` : '去选择'}
                      </Text>
                      <Text className="block text-sm text-gray-400">›</Text>
                    </View>
                  </View>

                  {/* 指定日期不可用 */}
                  <View
                    className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    onClick={() => {
                      // 将已选日期转换为 Date 对象
                      const dates = tempUnavailableCalendarDates.map(d => new Date(d))
                      setCalendarSelectedDates(dates)
                      setShowCalendarPicker(true)
                    }}
                  >
                    <Text className="block text-sm text-gray-800">指定日期不可用</Text>
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-400">
                        {tempUnavailableCalendarDates.length > 0 ? `已选${tempUnavailableCalendarDates.length}天` : '请选择'}
                      </Text>
                      <Text className="block text-sm text-gray-400">›</Text>
                    </View>
                  </View>

                  {tempUnavailableWeekdays.length === 0 &&
                   tempUnavailableHolidays.length === 0 &&
                   tempUnavailableCalendarDates.length === 0 && (
                    <Text className="block text-sm text-[#FF4757] mt-2">
                      请至少设定一个不可消费日期
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* 保存按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => {
                  updateFormData('unavailable_date_type', tempUnavailableDateType)
                  updateFormData('unavailable_weekdays', tempUnavailableWeekdays)
                  updateFormData('unavailable_holidays', tempUnavailableHolidays)
                  updateFormData('unavailable_dates', tempUnavailableCalendarDates)
                  setShowUnavailableDateModal(false)
                }}
              >
                <Text className="block text-white font-medium">保存</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 每日可用时段弹窗 */}
      {showAvailableTimeModal && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 200 }}
          onClick={() => setShowAvailableTimeModal(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">每日可用时段</Text>
              <View onClick={() => setShowAvailableTimeModal(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 可用时段类型选择 */}
            <View className="p-4">
              <View className="flex gap-3 mb-6">
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempAvailableTimeType === 'business_hours'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempAvailableTimeType('business_hours')}
                >
                  <Text className={`block text-sm ${tempAvailableTimeType === 'business_hours' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    营业时间可用
                  </Text>
                </View>
                <View
                  className={`flex-1 py-3 rounded-lg border-2 text-center ${
                    tempAvailableTimeType === 'custom'
                      ? 'border-[#FF4757] bg-red-50'
                      : 'border-gray-200 bg-white'
                  }`}
                  onClick={() => setTempAvailableTimeType('custom')}
                >
                  <Text className={`block text-sm ${tempAvailableTimeType === 'custom' ? 'text-[#FF4757] font-medium' : 'text-gray-600'}`}>
                    仅指定时间可用
                  </Text>
                </View>
              </View>

              {/* 自定义时间段 */}
              {tempAvailableTimeType === 'custom' && (
                <View className="space-y-4">
                  <View className="flex items-center justify-between">
                    <View className="flex items-center gap-1">
                      <Text className="block text-base font-medium text-gray-900">每日可用时段</Text>
                      <Text className="block text-[#FF4757]">*</Text>
                    </View>
                    <View
                      className="flex items-center gap-1"
                      onClick={() => setShowTimePicker(true)}
                    >
                      <Text className="block text-sm text-gray-400">去设置</Text>
                      <Text className="block text-sm text-gray-400">›</Text>
                    </View>
                  </View>
                  <View className="bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">
                      {tempAvailableTimeStart} - {tempAvailableTimeEnd}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 保存按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => {
                  updateFormData('available_time_type', tempAvailableTimeType)
                  updateFormData('available_time_start', tempAvailableTimeStart)
                  updateFormData('available_time_end', tempAvailableTimeEnd)
                  setShowAvailableTimeModal(false)
                }}
              >
                <Text className="block text-white font-medium">保存</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 每周几不可用选择弹窗 */}
      {showWeekdayPicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 300 }}
          onClick={() => setShowWeekdayPicker(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">请选择每周几不可用</Text>
              <View onClick={() => setShowWeekdayPicker(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 星期选择 */}
            <View className="p-4">
              {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day, index) => (
                <View
                  key={index}
                  className="flex items-center justify-between py-4 border-b border-gray-100"
                  onClick={() => {
                    if (tempUnavailableWeekdays.includes(index)) {
                      setTempUnavailableWeekdays(tempUnavailableWeekdays.filter(d => d !== index))
                    } else {
                      setTempUnavailableWeekdays([...tempUnavailableWeekdays, index])
                    }
                  }}
                >
                  <Text className="block text-base text-gray-800">{day}</Text>
                  <View
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      tempUnavailableWeekdays.includes(index)
                        ? 'border-[#FF4757] bg-[#FF4757]'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {tempUnavailableWeekdays.includes(index) && (
                      <View className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* 确定按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => setShowWeekdayPicker(false)}
              >
                <Text className="block text-white font-medium">确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 节假日不可用选择弹窗 */}
      {showHolidayPicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 300 }}
          onClick={() => setShowHolidayPicker(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">请选择不可用节假日</Text>
              <View onClick={() => setShowHolidayPicker(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 节假日列表 */}
            <View className="p-4">
              {[
                { id: 'qixi', name: '七夕节', date: '2026.08.19' },
                { id: 'zhongqiu', name: '中秋节', date: '2026.09.25 ~ 2026.09.27' },
                { id: 'guoqing', name: '国庆节', date: '2026.10.01 ~ 2026.10.07' },
                { id: 'shengdan', name: '圣诞节', date: '2026.12.25' },
                { id: 'yuandan', name: '元旦', date: '2027.01.01' },
                { id: 'chunjie', name: '春节', date: '2027.01.28 ~ 2027.02.03' },
              ].map((holiday) => (
                <View
                  key={holiday.id}
                  className="flex items-center justify-between py-4 border-b border-gray-100"
                  onClick={() => {
                    if (tempUnavailableHolidays.includes(holiday.id)) {
                      setTempUnavailableHolidays(tempUnavailableHolidays.filter(h => h !== holiday.id))
                    } else {
                      setTempUnavailableHolidays([...tempUnavailableHolidays, holiday.id])
                    }
                  }}
                >
                  <View>
                    <Text className="block text-base text-gray-800">{holiday.name}</Text>
                    <Text className="block text-sm text-gray-500">{holiday.date}</Text>
                  </View>
                  <View
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      tempUnavailableHolidays.includes(holiday.id)
                        ? 'border-[#FF4757] bg-[#FF4757]'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {tempUnavailableHolidays.includes(holiday.id) && (
                      <View className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* 确定按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => setShowHolidayPicker(false)}
              >
                <Text className="block text-white font-medium">确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 时间选择器弹窗 */}
      {showTimePicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-end"
          style={{ zIndex: 300 }}
          onClick={() => setShowTimePicker(false)}
        >
          <View
            className="bg-white rounded-t-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">请选择每日可用时段</Text>
              <View onClick={() => setShowTimePicker(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 时间显示和切换 */}
            <View className="p-4">
              <View className="flex items-center justify-center gap-4 mb-4">
                <View
                  className={`text-center px-4 py-2 rounded-lg ${
                    timePickerMode === 'start' ? 'bg-red-50 border border-red-200' : ''
                  }`}
                  onClick={() => setTimePickerMode('start')}
                >
                  <Text className="block text-sm text-[#FF4757] mb-1">开始</Text>
                  <Text className="block text-2xl font-medium text-[#FF4757]">{tempAvailableTimeStart}</Text>
                </View>
                <Text className="block text-lg text-gray-400">至</Text>
                <View
                  className={`text-center px-4 py-2 rounded-lg ${
                    timePickerMode === 'end' ? 'bg-red-50 border border-red-200' : ''
                  }`}
                  onClick={() => setTimePickerMode('end')}
                >
                  <Text className="block text-sm text-gray-500 mb-1">结束</Text>
                  <Text className="block text-2xl font-medium text-gray-800">{tempAvailableTimeEnd}</Text>
                </View>
              </View>

              {/* 滚轮式时间选择器 */}
              <View className="flex gap-4 h-48 border border-gray-200 rounded-lg overflow-hidden">
                {/* 小时滚轮 */}
                <View className="flex-1 overflow-y-auto">
                  {Array.from({ length: 24 }, (_, i) => (
                    <View
                      key={`hour-${i}`}
                      className={`py-3 text-center ${
                        (timePickerMode === 'start'
                          ? parseInt(tempAvailableTimeStart.split(':')[0])
                          : parseInt(tempAvailableTimeEnd.split(':')[0])) === i
                          ? 'text-[#FF4757] font-medium bg-red-50'
                          : 'text-gray-600'
                      }`}
                      onClick={() => {
                        const current = timePickerMode === 'start' ? tempAvailableTimeStart : tempAvailableTimeEnd
                        const parts = current.split(':')
                        const minutes = parts[1]
                        const newTime = `${String(i).padStart(2, '0')}:${minutes}`
                        if (timePickerMode === 'start') {
                          setTempAvailableTimeStart(newTime)
                        } else {
                          setTempAvailableTimeEnd(newTime)
                        }
                      }}
                    >
                      <Text className="block">{i}时</Text>
                    </View>
                  ))}
                </View>
                {/* 分钟滚轮 */}
                <View className="flex-1 overflow-y-auto">
                  {Array.from({ length: 12 }, (_, i) => {
                    const minutes = i * 5
                    return (
                      <View
                        key={`minute-${i}`}
                        className={`py-3 text-center ${
                          (timePickerMode === 'start'
                            ? parseInt(tempAvailableTimeStart.split(':')[1])
                            : parseInt(tempAvailableTimeEnd.split(':')[1])) === minutes
                            ? 'text-[#FF4757] font-medium bg-red-50'
                            : 'text-gray-600'
                        }`}
                        onClick={() => {
                          const current = timePickerMode === 'start' ? tempAvailableTimeStart : tempAvailableTimeEnd
                          const parts = current.split(':')
                          const hours = parts[0]
                          const newTime = `${hours}:${String(minutes).padStart(2, '0')}`
                          if (timePickerMode === 'start') {
                            setTempAvailableTimeStart(newTime)
                          } else {
                            setTempAvailableTimeEnd(newTime)
                          }
                        }}
                      >
                        <Text className="block">{minutes}分</Text>
                      </View>
                    )
                  })}
                </View>
              </View>
            </View>

            {/* 确定按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => setShowTimePicker(false)}
              >
                <Text className="block text-white font-medium">确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 限制使用张数弹窗 */}
      {showLimitUsageModal && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 200 }}
          onClick={() => setShowLimitUsageModal(false)}
        >
          <View
            className="bg-white rounded-2xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">设置限制使用张数</Text>
              <View onClick={() => setShowLimitUsageModal(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 开关 */}
            <View className="p-4">
              <View className="flex items-center justify-between mb-4">
                <Text className="block text-base text-gray-800">启用限制</Text>
                <View
                  className={`w-12 h-6 rounded-full p-1 transition-colors ${
                    formData.limit_usage_count ? 'bg-[#FF4757]' : 'bg-gray-300'
                  }`}
                  onClick={() => updateFormData('limit_usage_count', !formData.limit_usage_count)}
                >
                  <View
                    className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      formData.limit_usage_count ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </View>
              </View>

              {/* 限制数量 */}
              {formData.limit_usage_count && (
                <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <Text className="block text-sm text-gray-600">每单限制使用张数</Text>
                  <View className="flex items-center gap-3">
                    <View
                      className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center"
                      onClick={() => setTempLimitUsageCount(Math.max(1, tempLimitUsageCount - 1))}
                    >
                      <Text className="block text-lg text-gray-600">-</Text>
                    </View>
                    <Text className="block text-base text-gray-800">{tempLimitUsageCount}</Text>
                    <View
                      className="w-8 h-8 bg-gray-200 rounded-lg flex items-center justify-center"
                      onClick={() => setTempLimitUsageCount(tempLimitUsageCount + 1)}
                    >
                      <Text className="block text-lg text-gray-600">+</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* 确定按钮 */}
            <View className="p-4 border-t border-gray-200">
              <Button
                className="w-full bg-[#FF4757]"
                onClick={() => {
                  if (formData.limit_usage_count) {
                    updateFormData('usage_count_limit', tempLimitUsageCount)
                  } else {
                    updateFormData('usage_count_limit', 0)
                  }
                  setShowLimitUsageModal(false)
                }}
              >
                <Text className="block text-white font-medium">确定</Text>
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
                className="flex-1 bg-[#FF4757]"
                onClick={confirmDate}
              >
                <Text className="block text-white font-medium">确认</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 日历选择弹窗 - 指定不可用日期 */}
      {showCalendarPicker && (
        <View
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4"
          style={{ zIndex: 200 }}
          onClick={() => setShowCalendarPicker(false)}
        >
          <View
            className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗标题 */}
            <View className="flex items-center justify-between p-4 border-b border-gray-200">
              <Text className="block text-lg font-medium text-gray-900">选择不可用日期</Text>
              <View onClick={() => setShowCalendarPicker(false)}>
                <X size={24} color="#666" />
              </View>
            </View>

            {/* 日历组件 */}
            <View className="p-4">
              <Calendar
                mode="single"
                selected={undefined}
                onSelect={(date) => {
                  if (date) {
                    // 检查是否已选中
                    const dateStr = format(date, 'yyyy-MM-dd')
                    const existingIndex = calendarSelectedDates.findIndex(
                      d => format(d, 'yyyy-MM-dd') === dateStr
                    )
                    if (existingIndex >= 0) {
                      // 取消选中
                      setCalendarSelectedDates(prev => prev.filter((_, i) => i !== existingIndex))
                    } else {
                      // 添加选中
                      setCalendarSelectedDates(prev => [...prev, date])
                    }
                  }
                }}
                className="rounded-md border"
              />
            </View>

            {/* 已选日期显示 */}
            {calendarSelectedDates.length > 0 && (
              <View className="px-4 pb-4">
                <Text className="block text-sm text-gray-600 mb-2">
                  已选 {calendarSelectedDates.length} 天：
                </Text>
                <View className="flex flex-wrap gap-2">
                  {calendarSelectedDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((date, index) => (
                      <View
                        key={index}
                        className="bg-red-50 text-red-600 px-2 py-1 rounded text-xs"
                      >
                        <Text className="block">
                          {format(date, 'yyyy-MM-dd')}
                        </Text>
                      </View>
                    ))}
                </View>
              </View>
            )}

            {/* 操作按钮 */}
            <View className="p-4 border-t border-gray-200 flex gap-3">
              <Button
                className="flex-1 bg-white border-2 border-gray-300 text-gray-700"
                onClick={() => setCalendarSelectedDates([])}
              >
                <Text className="block font-medium">清除</Text>
              </Button>
              <Button
                className="flex-1 bg-[#FF4757]"
                onClick={() => {
                  // 将选中的日期转换为字符串格式
                  const dateStrings = calendarSelectedDates.map(d => format(d, 'yyyy-MM-dd'))
                  setTempUnavailableCalendarDates(dateStrings)
                  setShowCalendarPicker(false)
                }}
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
              className="flex-1 bg-[#FF4757]"
              onClick={handleNextStep}
            >
              <Text className="block text-white font-medium">下一步</Text>
            </Button>
          ) : (
            <Button
              className="flex-1 bg-[#FF4757]"
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
