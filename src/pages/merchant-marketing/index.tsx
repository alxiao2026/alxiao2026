import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Plus, Pencil, Trash2, Megaphone } from 'lucide-react-taro'

interface Activity {
  id: string
  merchant_id: string
  title: string
  description: string | null
  start_time: string | null
  end_time: string | null
  status: 'draft' | 'active' | 'paused' | 'ended'
  created_at: string
  updated_at: string
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿',
  active: '进行中',
  paused: '已暂停',
  ended: '已结束',
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#999999',
  active: '#10B981',
  paused: '#F59E0B',
  ended: '#EF4444',
}

export default function MerchantMarketingPage() {
  const [merchantId, setMerchantId] = useState<string>('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    status: 'draft' as Activity['status'],
  })

  useEffect(() => {
    const instance = Taro.getCurrentInstance()
    const id = instance.router?.params?.merchant_id || ''
    setMerchantId(id)
    if (id) {
      loadActivities(id)
    }
  }, [])

  const loadActivities = async (id: string) => {
    setLoading(true)
    try {
      const res = await Network.request({
        url: `/api/merchant-marketing/${id}`,
        method: 'GET',
      })
      console.log('loadActivities res', res)
      const list = res?.data?.data || []
      setActivities(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('loadActivities err', err)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ title: '', description: '', start_time: '', end_time: '', status: 'draft' })
    setShowForm(true)
  }

  const openEdit = (item: Activity) => {
    setEditingId(item.id)
    setForm({
      title: item.title,
      description: item.description || '',
      start_time: item.start_time ? item.start_time.slice(0, 16) : '',
      end_time: item.end_time ? item.end_time.slice(0, 16) : '',
      status: item.status,
    })
    setShowForm(true)
  }

  const submitForm = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入活动标题', icon: 'none' })
      return
    }
    try {
      const toIso = (val: string) => {
        if (!val) return null
        const normalized = val.replace(' ', 'T')
        const d = new Date(normalized)
        return Number.isNaN(d.getTime()) ? null : d.toISOString()
      }
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        start_time: toIso(form.start_time),
        end_time: toIso(form.end_time),
        status: form.status,
      }
      if (editingId) {
        const res = await Network.request({
          url: `/api/merchant-marketing/${editingId}`,
          method: 'PUT',
          data: payload,
        })
        console.log('update activity res', res)
      } else {
        const res = await Network.request({
          url: '/api/merchant-marketing',
          method: 'POST',
          data: {
            merchant_id: merchantId,
            ...payload,
          },
        })
        console.log('create activity res', res)
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setShowForm(false)
      loadActivities(merchantId)
    } catch (err) {
      console.error('submitForm err', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '删除后无法恢复，是否继续？',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/merchant-marketing/${id}`,
              method: 'DELETE',
            })
            Taro.showToast({ title: '删除成功', icon: 'success' })
            loadActivities(merchantId)
          } catch (err) {
            console.error('delete activity err', err)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  return (
    <View className="min-h-screen bg-gray-50 pb-20">
      <View className="px-4 py-4">
        <Text className="block text-lg font-semibold text-gray-800">营销活动管理</Text>
        <Text className="block text-sm text-gray-500 mt-1">统一管理商家营销活动</Text>
      </View>

      <View className="px-4 pb-4">
        {loading ? (
          <View className="text-center py-8">
            <Text className="text-gray-500">加载中...</Text>
          </View>
        ) : activities.length === 0 ? (
          <View className="text-center py-12 bg-white rounded-2xl">
            <Megaphone size={48} color="#ccc" />
            <Text className="block text-gray-500 mt-4">暂无营销活动</Text>
            <Text className="block text-gray-400 text-sm mt-2">点击下方按钮创建活动</Text>
          </View>
        ) : (
          <View className="space-y-3">
            {activities.map((item) => (
              <Card key={item.id} className="bg-white border border-gray-200">
                <CardContent className="p-4">
                  <View className="flex items-start justify-between">
                    <View className="flex-1">
                      <Text className="block text-base font-semibold text-gray-800">
                        {item.title}
                      </Text>
                      {item.description && (
                        <Text className="block text-sm text-gray-500 mt-1">{item.description}</Text>
                      )}
                      <Text className="block text-xs text-gray-400 mt-2">
                        {item.start_time && item.end_time
                          ? `${new Date(item.start_time).toLocaleString()} ~ ${new Date(item.end_time).toLocaleString()}`
                          : item.start_time
                            ? `开始：${new Date(item.start_time).toLocaleString()}`
                            : item.end_time
                              ? `结束：${new Date(item.end_time).toLocaleString()}`
                              : '未设置时间'}
                      </Text>
                      <View className="inline-block mt-2 px-2 py-1 rounded-full" style={{ backgroundColor: `${STATUS_COLOR[item.status]}20` }}>
                        <Text className="text-xs" style={{ color: STATUS_COLOR[item.status] }}>
                          {STATUS_MAP[item.status]}
                        </Text>
                      </View>
                    </View>
                    <View className="flex items-center gap-2 ml-4">
                      <View
                        className="p-2 rounded-lg bg-red-50"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil size={16} color="#FF4757" />
                      </View>
                      <View
                        className="p-2 rounded-lg bg-red-50"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </View>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px', backgroundColor: '#fff', borderTop: '1px solid #e5e5e5', zIndex: 50 }}>
        <Button className="w-full bg-[#FF4757] text-white rounded-xl py-3" onClick={openCreate}>
          <Plus size={18} color="#fff" className="mr-2" />
          <Text className="text-white font-medium">新建营销活动</Text>
        </Button>
      </View>

      {showForm && (
        <View
          className="fixed inset-0 bg-black"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100 }}
          onClick={() => setShowForm(false)}
        >
          <View
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl"
            style={{ maxHeight: '80vh' }}
            onClick={(e) => e.stopPropagation()}
          >
            <View className="p-4 border-b border-gray-100">
              <Text className="block text-lg font-semibold text-center text-gray-800">
                {editingId ? '编辑活动' : '新建活动'}
              </Text>
            </View>
            <View className="p-4 space-y-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <View>
                <Text className="block text-sm text-gray-600 mb-2">活动标题</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入活动标题"
                    value={form.title}
                    onInput={(e) => setForm({ ...form, title: e.detail.value })}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm text-gray-600 mb-2">活动说明</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="请输入活动说明"
                    value={form.description}
                    onInput={(e) => setForm({ ...form, description: e.detail.value })}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm text-gray-600 mb-2">开始时间</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="YYYY-MM-DD HH:mm"
                    value={form.start_time}
                    onInput={(e) => setForm({ ...form, start_time: e.detail.value })}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm text-gray-600 mb-2">结束时间</Text>
                <View className="bg-gray-50 rounded-xl px-4 py-3">
                  <Input
                    className="w-full bg-transparent"
                    placeholder="YYYY-MM-DD HH:mm"
                    value={form.end_time}
                    onInput={(e) => setForm({ ...form, end_time: e.detail.value })}
                  />
                </View>
              </View>
              <View>
                <Text className="block text-sm text-gray-600 mb-2">活动状态</Text>
                <View className="flex flex-wrap gap-2">
                  {(['draft', 'active', 'paused', 'ended'] as const).map((s) => (
                    <View
                      key={s}
                      className={`px-4 py-2 rounded-full border ${form.status === s ? 'bg-[#FF4757] border-[#FF4757]' : 'bg-white border-gray-200'}`}
                      onClick={() => setForm({ ...form, status: s })}
                    >
                      <Text className={form.status === s ? 'text-white' : 'text-gray-600'}>
                        {STATUS_MAP[s]}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
            <View style={{ padding: '12px', borderTop: '1px solid #e5e5e5' }}>
              <Button className="w-full bg-[#FF4757] text-white rounded-xl py-3" onClick={submitForm}>
                <Text className="text-white font-medium">保存</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
