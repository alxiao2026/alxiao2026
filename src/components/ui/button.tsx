import * as React from "react"
import { View, Button as TaroButton } from "@tarojs/components"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary hover:bg-opacity-90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive hover:bg-opacity-90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary hover:bg-opacity-80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<typeof View>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  disabled?: boolean
  className?: string
  /** 原生 Button 的 plain 模式（镂空、去默认边框背景），仅 openType 原生渲染分支生效 */
  plain?: boolean
  /** 小程序开放能力（如 openType="share" 触发分享面板），传入后底层自动切换为原生 Button 渲染 */
  openType?: "share" | "contact" | "getPhoneNumber" | "openSetting" | "feedback" | "chooseAvatar" | "launchApp" | "agreePrivacyAuthorization"
  onGetPhoneNumber?: (e: { detail?: { encryptedData?: string; iv?: string; code?: string; errMsg?: string } }) => void
  onChooseAvatar?: (e: { detail?: { avatarUrl?: string } }) => void
}

const Button = React.forwardRef<React.ElementRef<typeof View>, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, openType, onGetPhoneNumber, onChooseAvatar, children, ...props }, ref) => {
    const tabIndex = (props as { tabIndex?: number }).tabIndex ?? (disabled ? -1 : 0)
    const cls = cn(
      buttonVariants({ variant, size, className }),
      disabled && "opacity-50 pointer-events-none"
    )

    // 小程序开放能力场景（分享/获取手机号等）：必须使用原生 Button 才能触发对应能力
    // 外层 View 负责视觉样式，内层原生 Button 全透明覆盖以触发开放能力
    if (openType) {
      // 必须先解构出用户传入的 style，否则 { ...props } 会覆盖内部 position: 'relative'
      const { style: userStyle, ...viewProps } = props
      return (
        <View className={cls} style={{ position: 'relative', ...(userStyle as object) }} {...viewProps}>
          <TaroButton
            openType={openType}
            disabled={disabled}
            plain
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, zIndex: 10 }}
            onGetPhoneNumber={onGetPhoneNumber}
            onChooseAvatar={onChooseAvatar}
          />
          {children}
        </View>
      )
    }

    return (
      <View
        className={cls}
        ref={ref}
        {...({ tabIndex } as { tabIndex?: number })}
        hoverClass={
          disabled
            ? undefined
            : "border-ring ring-2 ring-ring ring-offset-2 ring-offset-background"
        }
        {...props}
      >
        {children}
      </View>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
