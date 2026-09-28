import { View, Text } from '@tarojs/components'

export default function PrivacyPage() {
  return (
    <View className="min-h-screen bg-white px-4 py-5">
      <Text className="block text-xl font-bold text-gray-900 mb-4">隐私政策</Text>

      <Text className="block text-sm text-gray-500 mb-4">更新时间：2026年9月28日</Text>

      <Text className="block text-sm text-gray-700 leading-relaxed mb-4">
        膨胀团（以下简称「我们」）非常重视您的个人信息和隐私保护。本政策将向您说明我们在您使用膨胀团小程序（以下简称「本小程序」）时如何收集、使用、存储和保护您的个人信息。请您在使用本小程序前仔细阅读本政策。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">一、我们收集的信息</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        1.1 为向您提供服务，在您授权登录时，我们可能会收集您的微信昵称、头像、OpenID 等公开信息。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        1.2 在您下单、核销、参与抽奖或领取优惠券时，我们可能会收集您的订单信息、手机号（如填写）、位置信息（如您主动使用附近门店功能）等。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        1.3 为改进产品体验，我们可能会收集您在本小程序中的操作日志、设备信息（如设备型号、操作系统版本）及崩溃日志。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">二、信息的使用</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        2.1 我们将使用您的信息用于身份识别、订单处理、售后服务、活动通知及防欺诈等目的。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        2.2 我们可能会使用您的联系方式向您发送订单状态、活动提醒等重要服务通知；营销类信息将仅在您同意后发送。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">三、信息的共享与披露</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        3.1 我们不会向第三方出售您的个人信息。仅在以下情形中，我们可能会与第三方共享您的信息：
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-2 ml-2">
        （1）为完成交易订单，向合作商家提供必要的订单信息；
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-2 ml-2">
        （2）为提供支付服务，向微信支付等第三方支付机构提供必要的交易信息；
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-2 ml-2">
        （3）根据法律法规要求或政府机关的合法要求。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">四、信息的存储与安全</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        4.1 我们将采取合理的技术和管理措施保护您的个人信息安全，防止数据泄露、丢失或被滥用。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        4.2 您的个人信息将在实现本政策所述目的所必要的最短时间内保存；超出保存期限后，我们将对您的个人信息进行删除或匿名化处理。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">五、您的权利</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        5.1 您有权查阅、更正、删除您的个人信息，或撤回已同意的授权。如需行使上述权利，可通过本小程序「我的-客服」与我们联系。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">六、未成年人保护</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        6.1 我们非常重视未成年人的个人信息保护。若您是未成年人，请在监护人指导下使用本小程序。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">七、政策更新</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        7.1 我们可能会根据法律法规变化或服务调整不时修订本政策，修订后的政策将在本小程序内公示，您继续使用即视为接受。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">八、联系我们</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-8">
        如您对本隐私政策有任何疑问、意见或建议，可通过本小程序「我的-客服」功能与我们联系。
      </Text>
    </View>
  )
}
