import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Network } from '@/network'
import {
  Wallet,
  ShoppingBag,
  CreditCard,
  Ticket,
  Timer,
  BadgeCheck,
  ChevronRight,
  Copy,
  Sparkles,
  MessageSquareText,
  SquarePen
} from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

type TemplateItem = {
  type: string
  label: string
  templateId: string
  configured: boolean
  source: 'db' | 'env'
}

type ParsedItem = TemplateItem & { displayName: string }

type IconComponent = React.ComponentType<{ size?: string | number; color?: string | number; strokeWidth?: string | number }>

const ICON_RULES: Array<{ keys: string[]; icon: IconComponent }> = [
  { keys: ['提现'], icon: Wallet },
  { keys: ['下单'], icon: ShoppingBag },
  { keys: ['付款', '支付'], icon: CreditCard },
  { keys: ['优惠券'], icon: Ticket },
  { keys: ['到期'], icon: Timer },
  { keys: ['核销'], icon: BadgeCheck }
]

function resolveIcon(label: string): IconComponent {
  const hit = ICON_RULES.find((rule) => rule.keys.some((k) => label.includes(k)))
  return hit ? hit.icon : MessageSquareText
}

function parseDisplayName(label: string): string {
  return label.replace(/（(商家|用户)）/g, '').trim()
}

export default function NotifyTemplateConfigPage() {
  const [items, setItems] = useState<ParsedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<ParsedItem | null>(null)
  const [editTemplateId, setEditTemplateId] = useState('')

  const loadConfigs = async () => {
    setLoading(true)
    try {
      const res = await Network.request<{ code: number; data: { list: TemplateItem[] } }>({
        url: '/api/notifications/admin/template-configs',
        method: 'GET',
        data: { admin_user_id: 'admin_13819627027' }
      })
      const list = res.data?.data?.list || []
      setItems(list.map((it) => ({ ...it, displayName: parseDisplayName(it.label) })))
    } catch (err) {
      console.error('[NotifyTemplateConfig] 加载模板配置失败:', err)
      Taro.showToast({ title: '加载失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  const openEdit = (item: ParsedItem) => {
    setEditTarget(item)
    setEditTemplateId(item.templateId)
  }

  const handleCopy = (text: string, tip: string) => {
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: tip, icon: 'none' })
    })
  }

  const handleSave = async () => {
    if (!editTarget || saving) return
    setSaving(true)
    try {
      const res = await Network.request<{ code: number; msg?: string }>({
        url: '/api/notifications/admin/template-configs',
        method: 'POST',
        data: {
          admin_user_id: 'admin_13819627027',
          type: editTarget.type,
          templateId: editTemplateId.trim()
        }
      })
      if (res.data?.code !== 200) {
        throw new Error(res.data?.msg || '保存失败')
      }
      Taro.showToast({ title: '已保存', icon: 'success' })
      setEditTarget(null)
      loadConfigs()
    } catch (err: any) {
      console.error('[NotifyTemplateConfig] 保存模板配置失败:', err)
      Taro.showToast({ title: err?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const configuredCount = items.filter((item) => item.configured).length
  const totalCount = items.length
  const percent = totalCount > 0 ? Math.round((configuredCount / totalCount) * 100) : 0

  const merchantItems = items.filter((it) => it.label.includes('（商家）'))
  const userItems = items.filter((it) => !it.label.includes('（商家）'))
  const groups = [
    { key: 'merchant', name: '商家通知', list: merchantItems },
    { key: 'user', name: '用户通知', list: userItems }
  ].filter((g) => g.list.length > 0)

  const renderCard = (item: ParsedItem) => {
    const IconCmp = resolveIcon(item.label)
    return (
      <Card
        key={item.type}
        className="rounded-2xl border-0 shadow-sm shadow-gray-100"
        onClick={() => openEdit(item)}
      >
        <CardContent className="p-4">
          <View className="flex flex-row items-center gap-3">
            <View
              className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${
                item.configured ? 'bg-red-50' : 'bg-gray-100'
              }`}
            >
              <IconCmp size={20} color={item.configured ? '#FF4757' : '#9ca3af'} />
            </View>

            <View className="min-w-0 flex-1">
              <View className="flex flex-row items-center gap-2">
                <Text className="text-sm font-semibold text-gray-900">{item.displayName}</Text>
                <Badge
                  variant="secondary"
                  className={`flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0 text-[10px] leading-4 ${
                    item.configured
                      ? 'bg-green-50 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {item.configured ? '已启用' : '未配置'}
                </Badge>
              </View>
              {item.configured ? (
                <View
                  className="mt-1 flex flex-row items-center gap-1"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopy(item.templateId, '模板 ID 已复制')
                  }}
                >
                  <Text className="min-w-0 flex-1 truncate text-xs text-gray-400">{item.templateId}</Text>
                  <Copy size={12} color="#9ca3af" />
                </View>
              ) : (
                <Text className="mt-1 block text-xs text-gray-400">仅发送站内通知，点击配置微信推送</Text>
              )}
            </View>

            <View className="flex-shrink-0">
              <ChevronRight size={16} color="#d1d5db" />
            </View>
          </View>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-8">
      {/* 头部概览卡 */}
      <View className="mx-4 mt-4 rounded-3xl bg-gradient-to-br from-red-500 to-rose-400 p-5 shadow-lg shadow-red-100">
        <View className="flex flex-row items-center justify-between">
          <View className="flex flex-row items-center gap-2">
            <Sparkles size={14} color="#ffffff" />
            <Text className="text-xs tracking-wide text-white text-opacity-90">微信订阅消息</Text>
          </View>
          <View
            className="rounded-full bg-white bg-opacity-20 px-3 py-1"
            onClick={() => handleCopy('https://mp.weixin.qq.com', '平台链接已复制')}
          >
            <Text className="text-xs text-white">申请模板</Text>
          </View>
        </View>

        <View className="mt-4 flex flex-row items-end gap-2">
          <Text className="text-3xl font-bold leading-9 text-white">
            {loading ? '--' : configuredCount}
          </Text>
          <Text className="pb-1 text-sm text-white text-opacity-70">/ {loading ? '--' : totalCount} 已启用</Text>
        </View>

        <Progress
          value={percent}
          className="mt-3 h-2 bg-white bg-opacity-25"
          indicatorClassName="bg-white"
        />

        <Text className="mt-3 block text-xs leading-relaxed text-white text-opacity-80">
          在微信公众平台「功能 → 订阅消息」申请模板后，将模板 ID 填入对应通知类型即可启用微信服务通知推送
        </Text>
      </View>

      {/* 加载骨架 */}
      {loading && (
        <View className="mx-4 mt-5 flex flex-col gap-3">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </View>
      )}

      {/* 分组列表 */}
      {!loading &&
        groups.map((group) => (
          <View key={group.key}>
            <View className="mx-4 mb-2 mt-5 flex flex-row items-center gap-2">
              <View className="h-4 w-1 rounded-full bg-red-500" />
              <Text className="text-sm font-bold text-gray-800">{group.name}</Text>
              <Text className="text-xs text-gray-400">{group.list.length} 项</Text>
            </View>
            <View className="mx-4 flex flex-col gap-3">{group.list.map(renderCard)}</View>
          </View>
        ))}

      {/* 空状态 */}
      {!loading && items.length === 0 && (
        <View className="mt-20 flex flex-col items-center">
          <MessageSquareText size={48} color="#d1d5db" strokeWidth={1.2} />
          <Text className="mt-4 block text-sm text-gray-400">暂无通知类型</Text>
        </View>
      )}

      {/* 编辑弹窗 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="w-4/5 max-w-sm">
          <DialogHeader>
            <DialogTitle>配置「{editTarget?.displayName}」</DialogTitle>
          </DialogHeader>
          <View className="mt-2">
            <Text className="mb-2 block text-xs leading-relaxed text-gray-500">
              粘贴微信公众平台订阅消息模板 ID，清空后保存可停用微信推送
            </Text>
            <Input
              className="h-11 rounded-xl border-gray-200"
              placeholder="粘贴模板 ID"
              value={editTemplateId}
              onInput={(e) => setEditTemplateId(e.detail.value)}
            />
          </View>
          <DialogFooter className="mt-4 flex-row gap-3">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setEditTarget(null)}>
              取消
            </Button>
            <Button className="flex-1 rounded-xl bg-red-500 text-white" disabled={saving} onClick={handleSave}>
              <SquarePen size={16} color="#fff" />
              <Text className="ml-1 text-white">{saving ? '保存中…' : '保存'}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
