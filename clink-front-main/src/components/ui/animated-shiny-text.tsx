import { ComponentPropsWithoutRef, CSSProperties, FC } from "react";
import { cn } from "@/lib/utils";

export interface AnimatedShinyTextProps
  extends ComponentPropsWithoutRef<"span"> {
  shimmerWidth?: number;
}

export const AnimatedShinyText: FC<AnimatedShinyTextProps> = ({
  children,
  className,
  shimmerWidth = 50,
  ...props
}) => {
  return (
    <span
      style={
        {
          "--shiny-width": `${shimmerWidth}px`,
        } as CSSProperties
      }
      className={cn(
        // Shine effect
        "animate-shiny-text bg-clip-text text-transparent bg-no-repeat [background-size:var(--shiny-width)_100%] [background-position:0_0] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",

        // Shine gradient - metallic silver effect - thinner shine
        "bg-gradient-to-r from-transparent via-gray-400/50 via-50% to-transparent dark:via-gray-300/50",

        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
