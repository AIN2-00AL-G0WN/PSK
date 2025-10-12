import * as React from "react";
import { cn } from "../lib/utils";

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border shadow-md",
      className
    )}
    style={{
      boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 -4px 6px rgba(0,0,0,0.05), 4px 0 6px rgba(0,0,0,0.05), -4px 0 6px rgba(0,0,0,0.05)",
      ...style,
    }}
    {...props}
  />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, style, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, style, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm", className)}
    style={{
      color: "#6b7280", // muted gray for description
      ...style,
    }}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-6 pt-0", className)}
    style={{
      color: "#374151", // slightly darker gray for content
      ...style,
    }}
    {...props}
  />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, style, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    style={{
      borderTop: "1px solid #e5e7eb",
      ...style,
    }}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};

// import * as React from "react";
// import { cn } from "../lib/utils";

// const Card = React.forwardRef<
//   HTMLDivElement,
//   React.HTMLAttributes<HTMLDivElement>
// >(({ className, style, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={cn(
//       "rounded-lg border shadow-md",
//       className
//     )}
//     style={{
//       boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 -4px 6px rgba(0,0,0,0.05), 4px 0 6px rgba(0,0,0,0.05), -4px 0 6px rgba(0,0,0,0.05)",
//       ...style,
//     }}
//     {...props}
//   />
// ));
// Card.displayName = "Card";

// const CardHeader = React.forwardRef<
//   HTMLDivElement,
//   React.HTMLAttributes<HTMLDivElement>
// >(({ className, style, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={cn("flex flex-col space-y-1.5 p-6", className)}
//     style={{
//       color: "#5b21b6", // deep purple header text
//       ...style,
//     }}
//     {...props}
//   />
// ));
// CardHeader.displayName = "CardHeader";

// const CardTitle = React.forwardRef<
//   HTMLHeadingElement,
//   React.HTMLAttributes<HTMLHeadingElement>
// >(({ className, style, ...props }, ref) => (
//   <h3
//     ref={ref}
//     className={cn("text-2xl font-semibold leading-none tracking-tight", className)}
//     style={{
//       color: "#4f46e5", // slightly lighter purple for title
//       ...style,
//     }}
//     {...props}
//   />
// ));
// CardTitle.displayName = "CardTitle";

// const CardDescription = React.forwardRef<
//   HTMLParagraphElement,
//   React.HTMLAttributes<HTMLParagraphElement>
// >(({ className, style, ...props }, ref) => (
//   <p
//     ref={ref}
//     className={cn("text-sm", className)}
//     style={{
//       color: "#6b7280", // muted gray for description
//       ...style,
//     }}
//     {...props}
//   />
// ));
// CardDescription.displayName = "CardDescription";

// const CardContent = React.forwardRef<
//   HTMLDivElement,
//   React.HTMLAttributes<HTMLDivElement>
// >(({ className, style, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={cn("p-6 pt-0", className)}
//     style={{
//       color: "#374151", // slightly darker gray for content
//       ...style,
//     }}
//     {...props}
//   />
// ));
// CardContent.displayName = "CardContent";

// const CardFooter = React.forwardRef<
//   HTMLDivElement,
//   React.HTMLAttributes<HTMLDivElement>
// >(({ className, style, ...props }, ref) => (
//   <div
//     ref={ref}
//     className={cn("flex items-center p-6 pt-0", className)}
//     style={{
//       borderTop: "1px solid #e5e7eb",
//       ...style,
//     }}
//     {...props}
//   />
// ));
// CardFooter.displayName = "CardFooter";

// export {
//   Card,
//   CardHeader,
//   CardFooter,
//   CardTitle,
//   CardDescription,
//   CardContent,
// };
