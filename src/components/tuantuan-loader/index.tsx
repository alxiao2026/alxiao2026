import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import tuantuanActive from '@/assets/tabbar/tuantuan-active.png'
import tuantuanPlain from '@/assets/tabbar/tuantuan.png'
import './index.css'

/** 活泼的加载文案池：2.4s 轮换一次，符合膨胀团调性 */
const LOADING_TEXTS = [
  '团团正在疯狂膨胀中…',
  '金币哗啦啦装进口袋…',
  '霸王餐的香味飘过来了…',
  '团团跑得比外卖小哥还快！',
  '抢购手速正在热身…',
  '好吃的马上就到，先咽口水…',
]

interface TuantuanLoaderProps {
  /** 固定文案（不参与轮换） */
  text?: string
  /** 团团尺寸（逻辑像素，默认 96） */
  size?: number
}

/** 团团加载组件：团团跳动 + 地面阴影同步缩放 + 轮换文案 */
export function TuantuanLoader({ text, size = 96 }: TuantuanLoaderProps) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 2400)
    return () => clearInterval(timer)
  }, [])

  const content = text || LOADING_TEXTS[tick % LOADING_TEXTS.length]

  return (
    <View className="flex flex-col items-center justify-center py-10">
      <View className="tuantuan-bounce">
        <Image
          src={tuantuanActive}
          mode="aspectFit"
          style={{ width: Taro.pxTransform(size), height: Taro.pxTransform(size) }}
        />
      </View>
      <View
        className="tuantuan-shadow"
        style={{
          width: Taro.pxTransform(Math.round(size * 0.6)),
          height: Taro.pxTransform(Math.round(size * 0.1)),
        }}
      />
      <Text className="block text-sm font-bold text-amber-600 mt-2 text-center">{content}</Text>
    </View>
  )
}

interface TuantuanEmptyProps {
  title?: string
  desc?: string
  size?: number
}

/** 团团空状态组件：灰白团团轻微呼吸，与"加载中"明确区分 */
export function TuantuanEmpty({
  title = '团团翻遍了口袋',
  desc = '这里暂时没有活动，去别处逛逛吧~',
  size = 112,
}: TuantuanEmptyProps) {
  return (
    <View className="flex flex-col items-center justify-center py-10">
      <View className="tuantuan-breathe" style={{ opacity: 0.72 }}>
        <Image
          src={tuantuanPlain}
          mode="aspectFit"
          style={{ width: Taro.pxTransform(size), height: Taro.pxTransform(size) }}
        />
      </View>
      <Text className="block text-base font-bold text-gray-600 mt-3">{title}</Text>
      {desc ? <Text className="block text-xs text-gray-400 mt-1 text-center">{desc}</Text> : null}
    </View>
  )
}
