"use client";

import * as React from "react";
import Link from "next/link";

/**
 * Button（依存なし版）
 *
 * 目的：
 * - 追加ライブラリ（@radix-ui/react-slot / class-variance-authority）に依存せずビルドを通す
 * - ボタン配色を「黒背景＋黄色文字」に統一（ユーザー要望）
 *
 * 注意：
 * - レイアウト（DOM構造・配置）は変えず、ボタンの見た目（className）のみ統一
 * - asChild は「子要素を1つだけ渡す」用途を想定して最小実装
 */

type ButtonVariant =
  | "primary"
  | "default"
  | "secondary"
  | "outline"
  | "ghost"
  | "link"
  | "destructive";

type ButtonSize = "default" | "sm" | "lg" | "icon";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
  /**
   * href が指定された場合は Link として描画する
   * - 既存コード互換（<Button href="/path" />）
   */
  href?: string;
}

// className の簡易結合（外部依存なし）
function cn(...classes: Array<string | undefined | null | false>) {
  return classes.filter(Boolean).join(" ");
}

// variant/size の class 定義（黒背景＋黄色文字を基準）
function getVariantClass(variant: ButtonVariant) {
  switch (variant) {
    case "primary":
      // primary は default と同等（用語だけ合わせる）
      return "bg-black text-yellow-300 hover:bg-zinc-900 hover:text-yellow-200";
    case "default":
      // ★統一基準：黒背景 + 黄色文字
      return "bg-black text-yellow-300 hover:bg-zinc-900 hover:text-yellow-200";
    case "secondary":
      return "bg-zinc-900 text-yellow-200 hover:bg-zinc-800 hover:text-yellow-100";
    case "outline":
      return "border border-yellow-500/40 bg-transparent text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-200";
    case "ghost":
      return "bg-transparent text-yellow-300 hover:bg-yellow-500/10 hover:text-yellow-200";
    case "link":
      return "bg-transparent text-yellow-300 underline-offset-4 hover:underline hover:text-yellow-200";
    case "destructive":
      return "bg-red-600 text-white hover:bg-red-700";
    default:
      return "bg-black text-yellow-300 hover:bg-zinc-900 hover:text-yellow-200";
  }
}

function getSizeClass(size: ButtonSize) {
  switch (size) {
    case "sm":
      return "h-9 rounded-md px-3 text-sm";
    case "lg":
      return "h-11 rounded-md px-8 text-sm";
    case "icon":
      return "h-10 w-10";
    case "default":
    default:
      return "h-10 px-4 py-2 text-sm rounded-md";
  }
}

const baseClass =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-black " +
  "disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "default",
      asChild = false,
      href,
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(baseClass, getVariantClass(variant), getSizeClass(size), className);

    // asChild：子要素が1つだけの時、その子にclassName等を合成（最小実装）
    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<any>;
      return React.cloneElement(child, {
        ...props,
        className: cn(child.props?.className, classes),
      });
    }

    // href 指定：Linkとして描画
    if (href) {
      // disabled でも見た目を保ちつつクリックを抑止
      const disabled = Boolean((props as any).disabled);
      return (
        <Link
          href={href}
          className={cn(classes, disabled ? "pointer-events-none opacity-50" : undefined)}
          aria-disabled={disabled ? "true" : undefined}
          onClick={(e) => {
            if (disabled) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
