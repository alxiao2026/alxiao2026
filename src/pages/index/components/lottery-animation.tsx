import { View, Text, Image } from '@tarojs/components';
import { useState, useEffect, useMemo } from 'react';
import { Gift, Trophy, Sparkles } from 'lucide-react-taro';
import { Button } from '@/components/ui/button';
import './lottery-animation.css';

interface LotteryAnimationProps {
  visible: boolean;
  isWinner: boolean;
  prizeName: string | null;
  prizeType?: 'coupon' | 'product' | 'free_meal';
  couponAmount?: string;
  couponMinSpend?: string;
  productName?: string;
  productValue?: string;
  redemptionCode?: string;
  refundAmount?: string;
  onClose: () => void;
}

const LOGO_URL = 'https://coze-coding-project.tos.coze.site/coze_storage_7662281810482692131/logo_pengtuan_351a650c.png?sign=1786607826-2bed5f54c9-0-97678c83503bc0f3caa6d543ad6c00b34a3cd0feb4d4bdcebe92e8f5d9cd6125';

const LotteryAnimation = ({ visible, isWinner, prizeName, prizeType, couponAmount, couponMinSpend, productName, productValue, redemptionCode, refundAmount, onClose }: LotteryAnimationProps) => {
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

  // 彩纸粒子位置 - 固定随机位置
  const confettiParticles = useMemo(() =>
    Array.from({ length: 30 }).map(() => ({
      left: `${Math.random() * 100}%`,
      animationDelay: `${Math.random() * 1.2}s`,
      backgroundColor: ['#FF4757', '#FFA502', '#2ED573', '#1890FF', '#FF6B81', '#A29BFE', '#FDCB6E'][Math.floor(Math.random() * 7)],
      width: `${6 + Math.random() * 8}px`,
      height: `${6 + Math.random() * 8}px`,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    })), []
  );

  if (!visible) return null;

  return (
    <View className="lottery-overlay">
      <View className="lottery-overlay-bg" />

      {/* 彩纸粒子 - 中奖时 */}
      {isWinner && phase === 'result' && (
        <View className="confetti-container">
          {confettiParticles.map((p, i) => (
            <View key={i} className="confetti-particle" style={p} />
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
            <Text className="block text-2xl font-bold lottery-text-white mt-6">开奖中...</Text>
            <View className="flex flex-row gap-2 mt-3">
              {[0, 1, 2].map((i) => (
                <View key={i} className="lottery-dot" style={{ animationDelay: `${i * 0.2}s` }} />
              ))}
            </View>
            <Text className="block text-sm lottery-text-white mt-6 opacity-60">
              正在抽取你的幸运奖品...
            </Text>
          </View>
        )}

        {/* 阶段2: 翻开卡片 */}
        {phase === 'revealing' && (
          <View className="flex flex-col items-center">
            <View className="lottery-card-reveal">
              <View className="lottery-card-reveal-inner">
                <Sparkles size={48} color="#fff" />
              </View>
            </View>
            <Text className="block text-2xl font-bold lottery-text-white mt-6">揭晓结果...</Text>
            <Text className="block text-sm lottery-text-white mt-3 opacity-60">
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
                <Trophy size={48} color="#fff" />
              ) : (
                <Gift size={48} color="#fff" />
              )}
            </View>

            {/* 结果标题 */}
            <Text className="block text-2xl font-bold mt-5 lottery-text-white">
              {isWinner ? '🎉 恭喜中奖！' : '😅 再接再厉'}
            </Text>

            {/* 中奖奖品名 */}
            {isWinner && prizeName && (
              <View className="lottery-prize-container">
                <Text className="block text-lg font-bold text-white text-center">{prizeName}</Text>
              </View>
            )}

            {/* 优惠券模式：显示金额和条件 */}
            {isWinner && prizeType === 'coupon' && (
              <View className="mt-3 flex flex-col items-center">
                <Text className="block text-sm lottery-text-white opacity-80">
                  优惠券金额 ¥{couponAmount}
                </Text>
                {Number(couponMinSpend) > 0 && (
                  <Text className="block text-xs lottery-text-white opacity-60 mt-1">
                    满 ¥{couponMinSpend} 可用，金额将退回原支付账户
                  </Text>
                )}
                {Number(couponMinSpend) <= 0 && (
                  <Text className="block text-xs lottery-text-white opacity-60 mt-1">
                    无门槛使用，金额将退回原支付账户
                  </Text>
                )}
              </View>
            )}

            {/* 商品模式：显示商品信息和兑换码 */}
            {isWinner && prizeType === 'product' && (
              <View className="mt-3 flex flex-col items-center">
                {productName && (
                  <Text className="block text-sm lottery-text-white opacity-80">
                    {productName}（价值 ¥{productValue}）
                  </Text>
                )}
                {redemptionCode && (
                  <View className="mt-2 bg-white bg-opacity-20 rounded-lg px-4 py-2">
                    <Text className="block text-xs lottery-text-white opacity-60">兑换码</Text>
                    <Text className="block text-sm font-bold text-white text-center mt-1">{redemptionCode}</Text>
                    <Text className="block text-xs lottery-text-white opacity-50 mt-1 text-center">请向商家出示此码兑换</Text>
                  </View>
                )}
              </View>
            )}

            {/* 霸王餐模式：显示退款信息 */}
            {isWinner && prizeType === 'free_meal' && (
              <View className="mt-3 flex flex-col items-center">
                <Text className="block text-sm lottery-text-white opacity-80">
                  支付金额 ¥{refundAmount} 将全额退回原支付账户
                </Text>
              </View>
            )}

            {/* 未中奖鼓励语 */}
            {!isWinner && (
              <Text className="block text-sm lottery-text-white text-center mt-3 opacity-70">
                下次一定中！再下一单试试手气吧
              </Text>
            )}

            {/* 我知道了按钮 */}
            <View className="mt-8">
              <Button
                onClick={onClose}
                className="bg-white bg-opacity-20 border border-white border-opacity-30 backdrop-blur-sm rounded-full px-10"
              >
                <Text className="block text-white font-semibold text-sm">我知道了</Text>
              </Button>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default LotteryAnimation;