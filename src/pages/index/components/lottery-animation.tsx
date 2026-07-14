import { View, Text, Image } from '@tarojs/components';
import { useState, useEffect } from 'react';
import { Gift, Trophy, Sparkles } from 'lucide-react-taro';
import { Button } from '@/components/ui/button';
import './lottery-animation.css';

interface LotteryAnimationProps {
  visible: boolean;
  isWinner: boolean;
  prizeName: string | null;
  onClose: () => void;
}

const LOGO_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_pengtuan_351a650c.png?sign=1786607826-2bed5f54c9-0-97678c83503bc0f3caa6d543ad6c00b34a3cd0feb4d4bdcebe92e8f5d9cd6125';

const LotteryAnimation = ({ visible, isWinner, prizeName, onClose }: LotteryAnimationProps) => {
  const [phase, setPhase] = useState<'idle' | 'shaking' | 'revealing' | 'result'>('idle');

  useEffect(() => {
    if (!visible) {
      setPhase('idle');
      return;
    }
    // 开始动画序列
    setPhase('shaking');
    const t1 = setTimeout(() => setPhase('revealing'), 1600);
    const t2 = setTimeout(() => setPhase('result'), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <View className="lottery-overlay">
      <View className="lottery-overlay-bg" />

      {/* 彩纸粒子 - 中奖时 */}
      {isWinner && phase === 'result' && (
        <View className="confetti-container">
          {Array.from({ length: 30 }).map((_, i) => (
            <View
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 0.8}s`,
                backgroundColor: ['#FF4757', '#FFA502', '#2ED573', '#1890FF', '#FF6B81', '#A29BFE', '#FDCB6E'][i % 7],
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </View>
      )}

      <View className="lottery-modal">
        {/* 阶段1: 摇晃卡片 */}
        {phase === 'shaking' && (
          <View className="flex flex-col items-center">
            <View className="lottery-card-shake">
              <View className="w-24 h-24 rounded-2xl bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center shadow-lg">
                <Image src={LOGO_URL} className="w-14 h-14 rounded-full" mode="aspectFill" />
              </View>
            </View>
            <Text className="block text-lg font-bold text-gray-800 mt-6">开奖中...</Text>
            <View className="flex flex-row gap-1.5 mt-3">
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  className="lottery-dot"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </View>
          </View>
        )}

        {/* 阶段2: 翻开卡片 */}
        {phase === 'revealing' && (
          <View className="flex flex-col items-center">
            <View className="lottery-card-reveal">
              <View className="w-24 h-24 rounded-2xl bg-gradient-to-br from-yellow-300 to-orange-400 flex items-center justify-center shadow-lg">
                <Sparkles size={40} color="#fff" />
              </View>
            </View>
            <Text className="block text-lg font-bold text-gray-800 mt-6">揭晓结果...</Text>
          </View>
        )}

        {/* 阶段3: 显示结果 */}
        {phase === 'result' && (
          <View className="flex flex-col items-center">
            {/* 中奖或未中奖图标 */}
            <View
              className={`lottery-result-icon ${isWinner ? 'lottery-result-winner' : 'lottery-result-loser'}`}
            >
              {isWinner ? (
                <Trophy size={44} color="#fff" />
              ) : (
                <Gift size={44} color="#fff" />
              )}
            </View>

            {/* 结果标题 */}
            <Text className={`block text-2xl font-bold mt-5 ${isWinner ? 'text-red-500' : 'text-gray-500'}`}>
              {isWinner ? '🎉 恭喜中奖！' : '😅 再接再厉'}
            </Text>

            {/* 中奖奖品名 */}
            {isWinner && prizeName && (
              <View className="lottery-prize-name">
                <Text className="block text-lg font-bold text-red-500">{prizeName}</Text>
              </View>
            )}

            {/* 未中奖鼓励语 */}
            {!isWinner && (
              <Text className="block text-sm text-gray-400 text-center mt-2">
                下次一定中！再下一单试试手气吧
              </Text>
            )}

            <Button
              className="w-full bg-red-500 mt-6"
              onClick={onClose}
            >
              <Text className="block text-white font-semibold">我知道了</Text>
            </Button>
          </View>
        )}
      </View>
    </View>
  );
};

export default LotteryAnimation;