import { View, Text, Image } from '@tarojs/components';
import { useState, useEffect, useMemo } from 'react';
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
    setPhase('shaking');
    const t1 = setTimeout(() => setPhase('revealing'), 1600);
    const t2 = setTimeout(() => setPhase('result'), 2200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  // 星星背景 - 用 useMemo 固定位置
  const stars = useMemo(() =>
    Array.from({ length: 20 }).map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      width: `${2 + Math.random() * 3}px`,
      height: `${2 + Math.random() * 3}px`,
      animationDelay: `${Math.random() * 3}s`,
    })), []
  );

  if (!visible) return null;

  return (
    <View className="lottery-overlay">
      <View className="lottery-overlay-bg" />

      {/* 星星背景 */}
      {stars.map((s, i) => (
        <View key={i} className="lottery-bg-star" style={s} />
      ))}

      {/* 光晕装饰 */}
      <View className="lottery-glow lottery-glow-1" />
      <View className="lottery-glow lottery-glow-2" />
      <View className="lottery-glow lottery-glow-3" />

      {/* 彩纸粒子 - 中奖时 */}
      {isWinner && phase === 'result' && (
        <View className="confetti-container">
          {Array.from({ length: 40 }).map((_, i) => (
            <View
              key={i}
              className="confetti-particle"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 1.2}s`,
                backgroundColor: ['#FF4757', '#FFA502', '#2ED573', '#1890FF', '#FF6B81', '#A29BFE', '#FDCB6E'][i % 7],
                width: `${6 + Math.random() * 10}px`,
                height: `${6 + Math.random() * 10}px`,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              }}
            />
          ))}
        </View>
      )}

      <View className="lottery-content">
        {/* 阶段1: 摇晃卡片 */}
        {phase === 'shaking' && (
          <View className="flex flex-col items-center">
            <View className="lottery-card-shake">
              <View className="lottery-card-image">
                <Image src={LOGO_URL} className="logo" mode="aspectFill" />
              </View>
            </View>
            <Text className="block text-3xl font-bold lottery-text-white mt-8">开奖中...</Text>
            <View className="flex flex-row gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <View key={i} className="lottery-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </View>
            <Text className="block text-base lottery-text-white mt-8 opacity-60">
              正在抽取你的幸运奖品...
            </Text>
          </View>
        )}

        {/* 阶段2: 翻开卡片 */}
        {phase === 'revealing' && (
          <View className="flex flex-col items-center">
            <View className="lottery-card-reveal">
              <View className="lottery-card-reveal-inner">
                <Sparkles size={56} color="#fff" />
              </View>
            </View>
            <Text className="block text-3xl font-bold lottery-text-white mt-8">揭晓结果...</Text>
            <Text className="block text-base lottery-text-white mt-4 opacity-60">
              命运即将揭晓...
            </Text>
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
                <Trophy size={56} color="#fff" />
              ) : (
                <Gift size={56} color="#fff" />
              )}
            </View>

            {/* 结果标题 */}
            <Text className="block text-3xl font-bold mt-6 lottery-text-white">
              {isWinner ? '🎉 恭喜中奖！' : '😅 再接再厉'}
            </Text>

            {/* 中奖奖品名 */}
            {isWinner && prizeName && (
              <View className="lottery-prize-container">
                <Text className="block text-xl font-bold text-white text-center">{prizeName}</Text>
              </View>
            )}

            {/* 未中奖鼓励语 */}
            {!isWinner && (
              <Text className="block text-base lottery-text-white text-center mt-4 opacity-70">
                下次一定中！再下一单试试手气吧
              </Text>
            )}

            {/* 我知道了 */}
            <View className="mt-10">
              <Button
                onClick={onClose}
              >
                <Text className="block text-white font-semibold">我知道了</Text>
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default LotteryAnimation;