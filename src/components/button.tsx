import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const variantStyles: Record<string, React.CSSProperties> = {
  default: {
    backgroundColor: "#9b5de5", // admin purple
    color: "#ffffff",
  },
  destructive: {
    backgroundColor: "#f44336",
    color: "#ffffff",
  },
  outline: {
    backgroundColor: "#9b5de5", // full purple for Edit button
    color: "#ffffff",
    border: "none",
  },
  secondary: {
    backgroundColor: "#f0f0f0",
    color: "#333333",
  },
  ghost: {
    backgroundColor: "transparent",
    color: "#9b5de5",
  },
  link: {
    backgroundColor: "transparent",
    color: "#9b5de5",
    textDecoration: "underline",
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  default: { height: "40px", padding: "0 16px", fontSize: "14px" },
  sm: { height: "32px", padding: "0 12px", fontSize: "12px" },
  lg: { height: "48px", padding: "0 24px", fontSize: "16px" },
  icon: { height: "40px", width: "40px", padding: "0" },
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "default", size = "default", className, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        style={{
          ...variantStyles[variant],
          ...sizeStyles[size],
          borderRadius: "6px",
          fontWeight: 500,
          cursor: "pointer",
          transition: "all 0.2s",
          ...style,
        }}
        className={className}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
