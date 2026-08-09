import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Network } from '@/network'
import { uploadMiniAppImage } from '@/lib/upload-image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { BadgeCheck, CreditCard, Upload, X, FileBadge, Landmark, ShieldCheck } from 'lucide-react-taro'

type UploadField = 'business' | 'food' | 'other'

export default function MerchantQualification() {
  const router = useRouter()
  const merchantId = Number(router.params.merchant_id || 0)

  const [merchantName, setMerchantName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<UploadField | ''>('')
  const [businessLicense, setBusinessLicense] = useState('')
  const [foodLicense, setFoodLicense] = useState('')
  const [otherLicenses, setOtherLicenses] = useState<string[]>([])
  const [accountName, setAccountName] = useState('')
  const [cardNo, setCardNo] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankBranch, setBankBranch] = useState('')

  const loadData = useCallback(async () => {
    if (!merchantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/merchants/${merchantId}/qualification` })
      console.log('[qualification] 加载响应:', res.data)
      const data = (res.data as any)?.data
      if (data) {
        setBusinessLicense(data.business_license_url || '')
        setFoodLicense(data.food_license_url || '')
        setOtherLicenses(Array.isArray(data.other_license_urls) ? data.other_license_urls : [])
        setAccountName(data.bank_account_name || '')
        setCardNo(data.bank_card_no || '')
        setBankName(data.bank_name || '')
        setBankBranch(data.bank_branch || '')
      }
      // 顺带取商家名称用于展示
      const mRes = await Network.request({ url: `/api/merchants/${merchantId}` })
      const mData = (mRes.data as any)?.data
      if (mData?.name) setMerchantName(mData.name)
    } catch (e) {
      console.error('[qualification] 加载失败:', e)
    } finally {
      setLoading(false)
    }
  }, [merchantId])

  useEffect(() => {
    loadData()
  }, [loadData])

  /** 选择图片并上传到对象存储 */
  const pickAndUpload = async (field: UploadField) => {
    try {
      const res = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = res.tempFilePaths?.[0]
      if (!filePath) return
      setUploading(field)
      // 优先 uploadFile 直传，失败自动降级 base64 通道（绕开真机域名白名单限制）
      const { url, errorMsg } = await uploadMiniAppImage(filePath)
      console.log('[qualification] 上传结果:', url)
      if (!url) throw new Error(errorMsg || '上传失败')
      if (field === 'business') setBusinessLicense(url)
      else if (field === 'food') setFoodLicense(url)
      else setOtherLicenses((prev) => [...prev, url])
    } catch (e: any) {
      if (e?.errMsg?.includes('cancel')) return
      console.error('[qualification] 上传失败:', e)
      Taro.showToast({ title: e?.message || '上传失败，请重试', icon: 'none' })
    } finally {
      setUploading('')
    }
  }

  const clearSingle = (field: 'business' | 'food') => {
    if (field === 'business') setBusinessLicense('')
    else setFoodLicense('')
  }

  const removeOther = (index: number) => {
    setOtherLicenses((prev) => prev.filter((_, i) => i !== index))
  }

  const preview = (url: string) => {
    Taro.previewImage({ urls: [url], current: url })
  }

  const handleSave = async () => {
    // 银行卡信息分组校验：填了任意一项则户名/卡号/开户行必填完整
    const trimmedCardNo = cardNo.replace(/\s+/g, '')
    const anyBankFilled = accountName.trim() || trimmedCardNo || bankName.trim() || bankBranch.trim()
    if (anyBankFilled) {
      if (!accountName.trim()) {
        Taro.showToast({ title: '请填写收款户名', icon: 'none' })
        return
      }
      if (!/^\d{8,32}$/.test(trimmedCardNo)) {
        Taro.showToast({ title: '请填写正确的银行卡号', icon: 'none' })
        return
      }
      if (!bankName.trim()) {
        Taro.showToast({ title: '请填写开户银行', icon: 'none' })
        return
      }
    }
    if (!businessLicense && !foodLicense && !anyBankFilled && otherLicenses.length === 0) {
      Taro.showToast({ title: '请至少上传资质或填写收款信息', icon: 'none' })
      return
    }

    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/merchants/${merchantId}/qualification`,
        method: 'POST',
        data: {
          business_license_url: businessLicense,
          food_license_url: foodLicense,
          other_license_urls: otherLicenses,
          bank_account_name: accountName.trim(),
          bank_card_no: trimmedCardNo,
          bank_name: bankName.trim(),
          bank_branch: bankBranch.trim(),
        },
      })
      const body = res.data as any
      console.log('[qualification] 保存响应:', body)
      if (res.statusCode >= 400 || body?.code !== 200) {
        throw new Error(body?.message || body?.msg || '保存失败')
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 600)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  /** 单图上传框 */
  const renderSingleUpload = (label: string, url: string, field: 'business' | 'food', hint: string) => (
    <View className="mb-4">
      <Text className="block text-sm font-medium text-gray-700 mb-2">{label}</Text>
      {url ? (
        <View className="relative">
          <Image
            src={url}
            className="w-full h-44 rounded-xl bg-gray-100"
            mode="aspectFit"
            onClick={() => preview(url)}
          />
          <View
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black bg-opacity-50 flex items-center justify-center"
            onClick={() => clearSingle(field)}
          >
            <X size={14} color="#ffffff" />
          </View>
        </View>
      ) : (
        <View
          className="h-44 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center"
          onClick={() => pickAndUpload(field)}
        >
          {uploading === field ? (
            <Text className="block text-sm text-gray-400">上传中...</Text>
          ) : (
            <>
              <Upload size={28} color="#9ca3af" />
              <Text className="block text-sm text-gray-500 mt-2">点击上传{label}</Text>
              <Text className="block text-xs text-gray-400 mt-1">{hint}</Text>
            </>
          )}
        </View>
      )}
    </View>
  )

  if (!merchantId) {
    return (
      <View className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Text className="block text-sm text-gray-400">缺少商家参数</Text>
      </View>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-32">
      {/* 顶部说明 */}
      <View className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-[#FF4757] to-[#ff6b81] p-4">
        <View className="flex flex-row items-center">
          <ShieldCheck size={22} color="#ffffff" />
          <Text className="text-base font-semibold text-white ml-2">资质与收款信息</Text>
        </View>
        <Text className="block text-xs text-white mt-2 opacity-90">
          {merchantName ? `「${merchantName}」的` : ''}经营资质与收款银行卡将用于平台审核与提现打款，请确保真实有效
        </Text>
      </View>

      {loading ? (
        <View className="px-4 mt-4 flex flex-col gap-3">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </View>
      ) : (
        <>
          {/* 经营资质 */}
          <View className="px-4 mt-4">
            <Card>
              <CardContent className="p-4">
                <View className="flex flex-row items-center mb-4">
                  <FileBadge size={18} color="#FF4757" />
                  <Text className="text-base font-semibold text-gray-800 ml-2">经营资质</Text>
                </View>

                {renderSingleUpload('营业执照', businessLicense, 'business', '拍摄或上传营业执照照片')}
                {renderSingleUpload('食品经营许可证', foodLicense, 'food', '餐饮行业请上传食品经营许可证')}

                <Text className="block text-sm font-medium text-gray-700 mb-2">其他资质（选填，最多 4 张）</Text>
                <View className="flex flex-row flex-wrap gap-3">
                  {otherLicenses.map((url, index) => (
                    <View key={url} className="relative w-20 h-20">
                      <Image
                        src={url}
                        className="w-20 h-20 rounded-xl bg-gray-100"
                        mode="aspectFill"
                        onClick={() => preview(url)}
                      />
                      <View
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black bg-opacity-50 flex items-center justify-center"
                        onClick={() => removeOther(index)}
                      >
                        <X size={12} color="#ffffff" />
                      </View>
                    </View>
                  ))}
                  {otherLicenses.length < 4 && (
                    <View
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center"
                      onClick={() => pickAndUpload('other')}
                    >
                      {uploading === 'other' ? (
                        <Text className="block text-xs text-gray-400">上传中</Text>
                      ) : (
                        <>
                          <Upload size={20} color="#9ca3af" />
                          <Text className="block text-xs text-gray-400 mt-1">添加</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>
              </CardContent>
            </Card>
          </View>

          {/* 收款银行卡 */}
          <View className="px-4 mt-4">
            <Card>
              <CardContent className="p-4">
                <View className="flex flex-row items-center mb-1">
                  <CreditCard size={18} color="#FF4757" />
                  <Text className="text-base font-semibold text-gray-800 ml-2">收款银行卡</Text>
                </View>
                <Text className="block text-xs text-gray-400 mb-4">
                  提现审核通过后，平台将打款至该银行卡
                </Text>

                <View className="mb-3">
                  <Text className="block text-sm font-medium text-gray-700 mb-2">收款户名</Text>
                  <Input
                    className="w-full"
                    placeholder="与银行卡一致的户名"
                    value={accountName}
                    onInput={(e) => setAccountName(e.detail.value)}
                  />
                </View>

                <View className="mb-3">
                  <Text className="block text-sm font-medium text-gray-700 mb-2">银行卡号</Text>
                  <Input
                    className="w-full"
                    type="number"
                    placeholder="请输入银行卡号"
                    value={cardNo}
                    onInput={(e) => setCardNo(e.detail.value)}
                  />
                </View>

                <View className="mb-3">
                  <Text className="block text-sm font-medium text-gray-700 mb-2">开户银行</Text>
                  <Input
                    className="w-full"
                    placeholder="如：中国工商银行"
                    value={bankName}
                    onInput={(e) => setBankName(e.detail.value)}
                  />
                </View>

                <View>
                  <Text className="block text-sm font-medium text-gray-700 mb-2">开户支行（选填）</Text>
                  <Input
                    className="w-full"
                    placeholder="如：贵阳南明支行"
                    value={bankBranch}
                    onInput={(e) => setBankBranch(e.detail.value)}
                  />
                </View>
              </CardContent>
            </Card>
          </View>

          {/* 提示 */}
          <View className="px-4 mt-4">
            <View className="flex flex-row items-start">
              <BadgeCheck size={14} color="#9ca3af" />
              <Text className="text-xs text-gray-400 ml-1 flex-1">
                资质图片与银行卡信息仅用于平台审核与提现打款，不会对外展示
              </Text>
            </View>
          </View>
        </>
      )}

      {/* 底部保存按钮（避开 TabBar 区域） */}
      <View
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px',
          backgroundColor: '#ffffff',
          borderTop: '1px solid #f3f4f6',
          zIndex: 100,
        }}
      >
        <Button className="w-full" disabled={saving || loading} onClick={handleSave}>
          <Landmark size={16} color="#ffffff" />
          <Text className="ml-1">{saving ? '保存中...' : '保存信息'}</Text>
        </Button>
      </View>
    </View>
  )
}
