import { View, Text } from '@tarojs/components'
import type { OrchardCalendarCell } from '@/lib/orchard-api'

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 浇水打卡日历：红=已浇 / 浅红=漏浇 / 红圈=今天 / 灰=未来（膨胀团主题） */
export default function WaterCalendar({
  cells,
  onSelectMissed,
}: {
  cells: (OrchardCalendarCell | null)[][]
  onSelectMissed?: (date: string) => void
}) {
  return (
    <View>
      <View style={{ display: 'flex', flexDirection: 'row' }}>
        {WEEK_LABELS.map((w) => (
          <View key={w} style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <Text className="text-xs" style={{ color: '#a8a29e' }}>{w}</Text>
          </View>
        ))}
      </View>
      {cells.map((week, wi) => (
        <View key={wi} style={{ display: 'flex', flexDirection: 'row', marginTop: 8 }}>
          {week.map((cell, ci) => {
            if (!cell) return <View key={ci} style={{ flex: 1 }} />
            const day = Number(cell.date.slice(-2))
            let bg = 'transparent'
            let color = '#a8a29e'
            let border = 'none'
            if (cell.watered) { bg = '#FFE5EC'; color = '#E11D48' }
            else if (cell.missed) { bg = '#fee2e2'; color = '#b91c1c' }
            else if (cell.isFuture) { bg = 'transparent'; color = '#d6d3d1' }
            if (cell.isToday) border = '1px solid #FF4757'
            return (
              <View key={ci} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <View
                  style={{
                    width: 34, height: 34, borderRadius: 17, backgroundColor: bg, border,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  onClick={() => cell.missed && onSelectMissed?.(cell.date)}
                >
                  <Text className="text-xs font-semibold" style={{ color }}>{day}</Text>
                </View>
                <Text style={{ fontSize: 10, color: cell.watered ? '#FF4757' : cell.missed ? '#dc2626' : '#d6d3d1', lineHeight: '14px' }}>
                  {cell.watered ? '💧' : cell.missed ? '补' : ''}
                </Text>
              </View>
            )
          })}
        </View>
      ))}
      <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
        <Text className="text-xs" style={{ color: '#78716c' }}>💧 已浇水　·　补 可补浇（点日期）　·　灰 未到期</Text>
      </View>
    </View>
  )
}
