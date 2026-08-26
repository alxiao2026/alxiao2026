import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
/**
 * 驿站管理配置页（独立分包 · 隐藏管理页）
 * - 入口一：关于页顶部标题连点 5 次 → 口令（DEPLOY.ADMIN_PASSWORD，默认 8888）
 * - 入口二：系统管理员「管理后台」→「驿站设置」菜单直达（roleCode===2 可见）
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, Store, Settings2 } from 'lucide-react-taro'
import {
  MAX_GROUP_BUYS,
  PRESET_STATIONS,
  loadGroupBuys,
  loadStationConfig,
  saveGroupBuys,
  saveStationConfig,
  type GroupBuyItem,
  type StationConfig,
} from '../../lib/station-config'

/**
 * 驿站管理配置页（隐藏入口：关于页连点 5 次标题 → 口令进入，口令见 DEPLOY.ADMIN_PASSWORD）
 * - 管理驿站信息（名称/编码/菜鸟stationId/地址/营业时间）
 * - 团购列表增删改（上限 5 条，超出提示）
 * - 数据本地存储 mock；▶▶ 预留 API 接口层见 lib/station-config.ts 顶部注释
 */
const EMPTY_GROUP_BUY: GroupBuyItem = {
  id: '',
  title: '',
  description: '',
  price: 0,
  originalPrice: 0,
  tag: '',
}

const StationAdminPage = () => {
  const [station, setStation] = useState<StationConfig>(() => loadStationConfig())
  const [groupBuys, setGroupBuys] = useState<GroupBuyItem[]>(() => loadGroupBuys(loadStationConfig().code))
  const [editingBuy, setEditingBuy] = useState<GroupBuyItem | null>(null)
  const [editingIndex, setEditingIndex] = useState(-1)

  const updateField = (key: keyof StationConfig, value: string) => {
    setStation((s) => ({ ...s, [key]: value }))
  }

  /** 保存驿站信息（▶▶ 预留 API：PUT /api/station/config） */
  const handleSaveStation = () => {
    if (!station.code.trim()) {
      Taro.showToast({ title: '驿站编码不能为空', icon: 'none' })
      return
    }
    if (!station.name.trim()) {
      Taro.showToast({ title: '驿站名称不能为空', icon: 'none' })
      return
    }
    saveStationConfig(station)
    Taro.showToast({ title: '驿站信息已保存', icon: 'success' })
  }

  /** 切换预设 mock 驿站（A/B/C，用于验证菜鸟未配置降级逻辑） */
  const handlePresetPick = (idx: number) => {
    const preset = PRESET_STATIONS[idx]
    setStation({ ...preset })
    setGroupBuys(loadGroupBuys(preset.code))
    saveStationConfig({ ...preset })
    Taro.showToast({ title: `已切换：${preset.name}`, icon: 'none' })
  }

  /** 新增团购（上限 MAX_GROUP_BUYS 条） */
  const handleAddBuy = () => {
    if (groupBuys.length >= MAX_GROUP_BUYS) {
      Taro.showToast({ title: `最多展示 ${MAX_GROUP_BUYS} 条团购，请先删除再新增`, icon: 'none' })
      return
    }
    setEditingBuy({ ...EMPTY_GROUP_BUY, id: `gb-${Date.now()}` })
    setEditingIndex(-1)
  }

  const handleEditBuy = (idx: number) => {
    setEditingBuy({ ...groupBuys[idx] })
    setEditingIndex(idx)
  }

  /** 保存团购列表（▶▶ 预留 API：PUT /api/station/group-buys） */
  const handleSaveBuyList = (list: GroupBuyItem[]) => {
    setGroupBuys(list)
    saveGroupBuys(station.code, list)
  }

  const handleDeleteBuy = (idx: number) => {
    Taro.showModal({
      title: '删除团购',
      content: `确定删除「${groupBuys[idx].title}」吗？`,
      success: (res) => {
        if (res.confirm) {
          handleSaveBuyList(groupBuys.filter((_, i) => i !== idx))
          Taro.showToast({ title: '已删除', icon: 'success' })
        }
      },
    })
  }

  /** 编辑弹窗保存 */
  const handleEditingSave = () => {
    const item = editingBuy
    if (!item) return
    if (!item.title.trim()) {
      Taro.showToast({ title: '请填写团购标题', icon: 'none' })
      return
    }
    if (!item.id.trim()) {
      Taro.showToast({ title: '请填写团购ID（主包套餐ID）', icon: 'none' })
      return
    }
    const priceNum = Number(item.price)
    const originalNum = Number(item.originalPrice)
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      Taro.showToast({ title: '请填写正确的团购价', icon: 'none' })
      return
    }
    const normalized: GroupBuyItem = {
      ...item,
      title: item.title.trim(),
      id: item.id.trim(),
      price: priceNum,
      originalPrice: Number.isFinite(originalNum) && originalNum > 0 ? originalNum : priceNum,
    }
    if (editingIndex < 0) {
      handleSaveBuyList([...groupBuys, normalized])
    } else {
      const next = [...groupBuys]
      next[editingIndex] = normalized
      handleSaveBuyList(next)
    }
    setEditingBuy(null)
    Taro.showToast({ title: '团购已保存', icon: 'success' })
  }

  const updateBuyField = (key: keyof GroupBuyItem, value: string | number) => {
    setEditingBuy((b) => (b ? { ...b, [key]: value } : b))
  }

  const labeledInput = (label: string, value: string, onInput: (v: string) => void, placeholder: string) => (
    <View className="mt-3">
      <Text className="block text-xs text-gray-500 mb-2">{label}</Text>
      {/* 跨端规范：Input 外层 View 承载样式 */}
      <View className="bg-gray-50 rounded-xl px-4 py-3">
        <Input className="w-full bg-transparent" placeholder={placeholder} value={value} onInput={(e) => onInput(e.detail.value)} />
      </View>
    </View>
  )

  return (
    <View className="flex flex-col h-screen bg-gray-50">
      <ScrollView className="flex-1" scrollY>
        {/* ===== 驿站信息管理 ===== */}
        <View className="px-4 pt-4">
          <View className="bg-white rounded-3xl p-5 shadow-md">
            <View className="flex flex-row items-center gap-2">
              <Settings2 size={14} color="#FF6B35" />
              <Text className="block text-sm font-bold text-gray-800">驿站信息</Text>
            </View>

            {labeledInput('驿站名称', station.name, (v) => updateField('name', v), '如：A032 快递驿站')}
            {labeledInput('驿站编码（拼多多 station_code）', station.code, (v) => updateField('code', v), '如：A032042625')}
            {labeledInput(
              '菜鸟 stationId（留空 = 未开通，查菜鸟按钮置灰）',
              station.cainiaoStationId,
              (v) => updateField('cainiaoStationId', v),
              '如：642757'
            )}
            {labeledInput('驿站地址', station.address, (v) => updateField('address', v), '详细地址')}
            {labeledInput('营业时间', station.businessHours, (v) => updateField('businessHours', v), '如：09:00 - 21:00')}

            {/* 驿站介绍（Textarea 跨端规范：外层 View 承载样式） */}
            <View className="mt-3">
              <Text className="block text-xs text-gray-500 mb-2">驿站介绍</Text>
              <View className="bg-gray-50 rounded-xl p-4">
                <Textarea
                  style={{ width: '100%', minHeight: '60px', backgroundColor: 'transparent' }}
                  placeholder="驿站一句话介绍"
                  value={station.intro}
                  onInput={(e) => updateField('intro', e.detail.value)}
                  maxlength={100}
                />
              </View>
            </View>

            <Button className="w-full h-auto py-3 mt-4 rounded-full bg-[#FF6B35] text-white" onClick={handleSaveStation}>
              <Text>保存驿站信息</Text>
            </Button>

            {/* 预设 mock 驿站快捷切换（演示/验证降级逻辑用） */}
            <View className="mt-4 pt-4 border-t border-gray-100">
              <Text className="block text-xs text-gray-400 mb-3">预设驿站（演示切换，C 站验证菜鸟降级）</Text>
              <View className="flex flex-row gap-2">
                {PRESET_STATIONS.map((p, i) => (
                  <View
                    key={p.code}
                    className={`flex-1 rounded-full py-2 px-2 text-center ${station.code === p.code ? 'bg-[#FFF3E5]' : 'bg-gray-50'}`}
                    onClick={() => handlePresetPick(i)}
                  >
                    <Text className="text-xs text-[#FF6B35]">{p.code}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* ===== 团购列表管理 ===== */}
        <View className="px-4 mt-4 pb-10">
          <View className="bg-white rounded-3xl p-5 shadow-md">
            <View className="flex flex-row items-center gap-2">
              <Store size={14} color="#FF6B35" />
              <Text className="block text-sm font-bold text-gray-800 flex-1">附近好店 · 团购管理</Text>
              <Text className="block text-xs text-gray-400">
                {groupBuys.length}/{MAX_GROUP_BUYS}
              </Text>
            </View>

            {groupBuys.map((item, idx) => (
              <View key={item.id + idx} className="bg-gray-50 rounded-2xl p-4 mt-3 flex flex-row items-center">
                <View className="flex-1 min-w-0">
                  <Text className="block text-sm font-semibold text-gray-800 truncate">{item.title}</Text>
                  <View className="flex flex-row items-baseline gap-1 mt-1">
                    <Text className="text-xs text-gray-400">ID {item.id}</Text>
                    <Text className="text-xs font-bold text-[#FF6B35] ml-1">¥{item.price}</Text>
                    {item.originalPrice > item.price && (
                      <Text className="text-xs text-gray-300 line-through">¥{item.originalPrice}</Text>
                    )}
                  </View>
                </View>
                <View className="flex flex-row items-center gap-1 flex-shrink-0">
                  <View
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm"
                    onClick={() => handleEditBuy(idx)}
                  >
                    <Pencil size={13} color="#FF6B35" />
                  </View>
                  <View
                    className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm ml-2"
                    onClick={() => handleDeleteBuy(idx)}
                  >
                    <Trash2 size={13} color="#EF4444" />
                  </View>
                </View>
              </View>
            ))}

            {groupBuys.length === 0 && (
              <View className="bg-gray-50 rounded-2xl py-6 mt-3 flex items-center justify-center">
                <Text className="text-xs text-gray-400">暂无团购，点击下方新增</Text>
              </View>
            )}

            <Button variant="outline" className="w-full h-auto py-3 mt-4 rounded-full" onClick={handleAddBuy}>
              <View className="flex flex-row items-center justify-center">
                <Plus size={14} color="#FF6B35" />
                <Text className="text-sm text-[#FF6B35] ml-1">新增团购（上限 {MAX_GROUP_BUYS} 条）</Text>
              </View>
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* ===== 团购编辑弹窗 ===== */}
      <Dialog open={editingBuy !== null} onOpenChange={(open) => { if (!open) setEditingBuy(null) }}>
        <DialogContent className="bg-white rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center text-base font-semibold text-gray-900">
              {editingIndex < 0 ? '新增团购' : '编辑团购'}
            </DialogTitle>
          </DialogHeader>
          {editingBuy && (
            <ScrollView scrollY style={{ maxHeight: '360px' }}>
              {labeledInput('团购ID（主包套餐ID，跳转详情用）', editingBuy.id, (v) => updateBuyField('id', v), '如：套餐ID')}
              {labeledInput('团购标题', editingBuy.title, (v) => updateBuyField('title', v), '如：老王烧烤 · 双人套餐')}
              {labeledInput('团购描述', editingBuy.description, (v) => updateBuyField('description', v), '一句话卖点')}
              {labeledInput('团购价（元）', String(editingBuy.price), (v) => updateBuyField('price', v), '9.9')}
              {labeledInput('原价（元）', String(editingBuy.originalPrice), (v) => updateBuyField('originalPrice', v), '19.9')}
              {labeledInput('标签', editingBuy.tag, (v) => updateBuyField('tag', v), '如：爆款 / 新客')}
            </ScrollView>
          )}
          <View className="flex flex-row gap-3 mt-5">
            <DialogClose className="flex-1">
              <Button variant="outline" className="w-full rounded-full">
                <Text>取消</Text>
              </Button>
            </DialogClose>
            <View className="flex-1">
              <Button className="w-full rounded-full bg-[#FF6B35] text-white" onClick={handleEditingSave}>
                <Text>保存</Text>
              </Button>
            </View>
          </View>
        </DialogContent>
      </Dialog>
    </View>
  )
}

export default StationAdminPage
