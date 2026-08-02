import { useEffect, useState, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { BellRing, CircleCheck, MessageSquareText, SquarePen } from 'lucide-react-taro'
import { Network } from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface TemplateConfig {
  type: string
  label: string
  title: string
  templateId: string
  configured: boolean
}

export default function NotifyTemplateConfig() {
  const [list, setList] = useState<TemplateConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editTarget, setEditTarget] = useState<TemplateConfig | null>(null)
  const [editValue, setEditValue] = useState('')

  const getAdminUserId = () =>
    Taro.getStorageSync('user_id') || Taro.getStorageSync('userInfo')?.user_id || ''

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/notifications/admin/template-configs?admin_user_id=${encodeURIComponent(getAdminUserId())}`,
      })
      console.log('[template-config] 列表响应:', res.data)
      const data = (res.data as any)?.data?.list
      setList(Array.isArray(data) ? data : [])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '加载失败', icon: 'none' })
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleSave = async () => {
    if (!editTarget) return
    setSaving(true)
    try {
      const res = await Network.request({
        url: '/api/notifications/admin/template-configs',
        method: 'POST',
        data: {
          type: editTarget.type,
          template_id: editValue.trim(),
          admin_user_id: getAdminUserId(),
        },
      })
      const body = res.data as any
      if (res.statusCode >= 400 || body?.code !== 200) {
        throw new Error(body?.message || body?.msg || '保存失败')
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setEditTarget(null)
      fetchList()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const configuredCount = list.filter((i) => i.configured).length

  return (
    <View className="min-h-screen bg-gray-50 pb-6">
      {/* 说明区 */}
      <View className="bg-white px-4 py-4 mb-3">
        <View className="flex flex-row items-center mb-2">
          <BellRing size={18} color="#0ea5e9" />
          <Text className="text-base font-semibold text-gray-800 ml-2">微信订阅消息模板配置</Text>
        </View>
        <Text className="block text-xs text-gray-500 leading-5">
          在微信公众平台（mp.weixin.qq.com）→ 功能 → 订阅消息 中申请模板后，将模板 ID 填入对应通知类型即可启用微信服务通知推送。已配置 {configuredCount}/{list.length} 项。
        </Text>
      </View>

      <View className="px-4 flex flex-col gap-3">
        {loading ? (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        ) : (
          list.map((item) => (
            <Card key={item.type}>
              <CardContent className="p-4">
                <View className="flex flex-row items-center justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex flex-row items-center mb-1">
                      <MessageSquareText size={15} color="#6b7280" />
                      <Text className="text-sm font-medium text-gray-800 ml-1">{item.label}</Text>
                    </View>
                    {item.configured ? (
                      <Text className="block text-xs text-gray-400">模板ID：{item.templateId}</Text>
                    ) : (
                      <Text className="block text-xs text-gray-400">未配置，仅发送站内通知</Text>
                    )}
                  </View>
                  <View className="flex flex-row items-center gap-2">
                    {item.configured ? (
                      <Badge variant="outline" className="border-green-500 text-green-600">
                        <CircleCheck size={11} color="#16a34a" />
                        <Text className="ml-1">已启用</Text>
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-gray-300 text-gray-400">未配置</Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditTarget(item)
                        setEditValue(item.templateId)
                      }}
                    >
                      <SquarePen size={14} color="#374151" />
                      <Text className="ml-1">{item.configured ? '修改' : '配置'}</Text>
                    </Button>
                  </View>
                </View>
              </CardContent>
            </Card>
          ))
        )}
      </View>

      {/* 编辑弹窗 */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget?.configured ? '修改模板 ID' : '配置模板 ID'}</DialogTitle>
          </DialogHeader>
          <View className="py-2">
            <Text className="block text-sm text-gray-600 mb-1">{editTarget?.label}</Text>
            <Text className="block text-xs text-gray-400 mb-3">
              清空模板 ID 并保存可停用该类型的微信推送（站内通知不受影响）
            </Text>
            <View className="bg-gray-50 rounded-xl px-4 py-3">
              <Input
                className="w-full bg-transparent"
                placeholder="请输入微信订阅消息模板 ID"
                value={editValue}
                onInput={(e) => setEditValue(e.detail.value)}
              />
            </View>
          </View>
          <DialogFooter>
            <View className="flex flex-row gap-3 w-full">
              <View className="flex-1">
                <Button variant="outline" className="w-full" onClick={() => setEditTarget(null)}>
                  <Text>取消</Text>
                </Button>
              </View>
              <View className="flex-1">
                <Button className="w-full" disabled={saving} onClick={handleSave}>
                  <Text>{saving ? '保存中...' : '保存'}</Text>
                </Button>
              </View>
            </View>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  )
}
