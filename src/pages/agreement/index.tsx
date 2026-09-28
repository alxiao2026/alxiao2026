import { View, Text } from '@tarojs/components'

export default function AgreementPage() {
  return (
    <View className="min-h-screen bg-white px-4 py-5">
      <Text className="block text-xl font-bold text-gray-900 mb-4">用户服务协议</Text>

      <Text className="block text-sm text-gray-500 mb-4">更新时间：2026年9月28日</Text>

      <Text className="block text-sm text-gray-700 leading-relaxed mb-4">
        欢迎使用膨胀团小程序（以下简称「本小程序」）。本小程序由膨胀团运营方（以下简称「我们」）为用户提供团购、抽奖、优惠券等本地生活服务。在您使用本小程序前，请仔细阅读本协议。一旦您使用本小程序，即视为您已充分阅读、理解并同意接受本协议全部内容。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">一、服务范围</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        1.1 本小程序为用户提供商家团购套餐展示、在线下单、订单查询、到店核销、霸王餐抽奖、果园任务及优惠券领取等服务。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        1.2 我们可能会根据业务发展需要对服务内容进行调整，调整后的内容将在本小程序内公布，恕不另行通知。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">二、账号与登录</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        2.1 您使用微信授权登录本小程序时，我们将获取您的微信公开信息（如头像、昵称等）用于创建账号。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        2.2 您应妥善保管自己的账号信息，因您保管不善导致的损失由您自行承担。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">三、用户行为规范</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        3.1 您在使用本小程序时，应遵守中华人民共和国相关法律法规，不得发布违法违规、侵犯他人权益或扰乱平台秩序的内容。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        3.2 禁止使用任何自动化工具、脚本或技术手段恶意刷单、套利、攻击平台系统。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">四、订单与退款</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        4.1 用户下单后可在「我的订单」中查看订单状态，并按页面提示到店核销。
      </Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        4.2 退款/售后规则以具体团购套餐页面说明为准；霸王餐等特殊活动退款规则以活动规则为准。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">五、知识产权</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        5.1 本小程序及其相关内容（包括但不限于文字、图片、标识、代码等）的知识产权归我们或相关权利人所有。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">六、免责声明</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        6.1 我们将尽力维护平台服务的稳定与安全，但对于因不可抗力、网络故障、第三方原因等导致的服务中断或数据丢失，我们不承担责任。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">七、协议变更</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-3">
        7.1 我们有权根据法律法规变化或业务发展需要不时修改本协议，修改后的协议将在本小程序内公示，您继续使用即视为接受。
      </Text>

      <Text className="block text-base font-semibold text-gray-900 mt-4 mb-2">八、联系我们</Text>
      <Text className="block text-sm text-gray-700 leading-relaxed mb-8">
        如您对本协议有任何疑问，可通过本小程序「我的-客服」功能与我们联系。
      </Text>
    </View>
  )
}
