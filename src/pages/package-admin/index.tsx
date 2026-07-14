import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Plus, X } from 'lucide-react-taro'

interface Package {
  id: string
  name: string
  description: string
  price: string
  original_price: string
  badge: string
  features: string
  cover_image: string
  environment_images: string[]
  stock: number
  sale_start_date: string
  sale_end_date: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface FeatureItem {
  id: string
  text: string
}

export default function PackageAdmin() {
  const router = Taro.useRouter()
  const { id } = router.params

  const [activeTab, setActiveTab] = useState('basic')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 表单数据
  const [formData, setFormData] = useState<Package>({
    id: '',
    name: '',
    description: '',
    price: '0',
    original_price: '0',
    badge: '',
    features: '',
    cover_image: '',
    environment_images: [],
    stock: 0,
    sale_start_date: '',
    sale_end_date: '',
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
    }
  }, [id])

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
    if (!formData.cover_image) {
      Taro.showToast({ title: '请上传商品头图', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      // 将 featureItems 转换为 JSON 字符串
      const featuresJson = JSON.stringify(featureItems.map(item => item.text))

      const submitData = {
        ...formData,
        features: featuresJson
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

  const handlePreview = () => {
    if (formData.id) {
      Taro.navigateTo({
        url: `/pages/package-detail/index?id=${formData.id}`
      })
    } else {
      Taro.showToast({ title: '请先保存套餐', icon: 'none' })
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
          <View className="w-8" />
        </View>

        {/* Tab 导航 */}
        <View className="flex border-b border-gray-200">
          {[
            { key: 'basic', label: '基础信息' },
            { key: 'merchant', label: '商家信息' },
            { key: 'product', label: '商品信息' },
            { key: 'sale', label: '售卖信息' }
          ].map(tab => (
            <View
              key={tab.key}
              className={`flex-1 py-3 text-center text-sm ${
                activeTab === tab.key
                  ? 'text-red-500 border-b-2 border-red-500 font-medium'
                  : 'text-gray-600'
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Text className="block">{tab.label}</Text>
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
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">休闲娱乐 · DIY 手工坊 · 拼豆</Text>
                    <Badge className="bg-gray-200 text-gray-600 text-xs">不可编辑</Badge>
                  </View>
                </View>

                <View>
                  <Text className="block text-sm text-gray-600 mb-2">商品类型</Text>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">团购套餐</Text>
                    <Badge className="bg-gray-200 text-gray-600 text-xs">不可编辑</Badge>
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
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">膨胀团 · 手作体验</Text>
                    <Badge className="bg-gray-200 text-gray-600 text-xs">不可编辑</Badge>
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
                  <Text className="block text-xs text-gray-400 mt-1">① 抖省省端 7% 服务费，非抖省省端 7% 服务费</Text>
                </View>

                {/* 商品头图 */}
                <View className="mb-4">
                  <View className="flex items-center justify-between mb-2">
                    <View className="flex items-center gap-1">
                      <Text className="block text-sm text-gray-600">商品头图</Text>
                      <Text className="block text-red-500">*</Text>
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
                    <View
                      className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center"
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
                    </View>
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
                      <View
                        className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center"
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
                      </View>
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
                    <Text className="block text-red-500">*</Text>
                  </View>
                  <View className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                    <Text className="block text-sm text-gray-800">
                      {formData.sale_start_date && formData.sale_end_date
                        ? `${formData.sale_start_date} 至 ${formData.sale_end_date}`
                        : '不限时间'}
                    </Text>
                    <Text className="block text-sm text-gray-400">›</Text>
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

      {/* 底部操作栏 */}
      <View
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4"
        style={{ zIndex: 100 }}
      >
        <View className="flex gap-3">
          <Button
            className="flex-1 bg-white border-2 border-gray-300 text-gray-700"
            onClick={handlePreview}
          >
            <Text className="block font-medium">预览</Text>
          </Button>
          <Button
            className="flex-1 bg-blue-500"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <Text className="block text-white font-medium">
              {submitting ? '提交中...' : '提交审核'}
            </Text>
          </Button>
        </View>
      </View>
    </View>
  )
}
