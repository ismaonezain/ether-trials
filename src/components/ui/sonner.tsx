"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      toastOptions={{
        duration: 3000,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-gradient-to-r group-[.toaster]:from-gray-900 group-[.toaster]:to-gray-800 group-[.toaster]:text-white group-[.toaster]:border-2 group-[.toaster]:border-yellow-500/30 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-yellow-500/20 group-[.toaster]:backdrop-blur-sm group-[.toaster]:rounded-xl group-[.toaster]:p-4",
          description: "group-[.toast]:text-gray-300 group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-yellow-500 group-[.toast]:text-black group-[.toast]:font-bold group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:hover:bg-yellow-400",
          cancelButton:
            "group-[.toast]:bg-gray-700 group-[.toast]:text-gray-300 group-[.toast]:font-medium group-[.toast]:rounded-lg group-[.toast]:px-4 group-[.toast]:py-2 group-[.toast]:hover:bg-gray-600",
          success: "group-[.toast]:border-green-500/50 group-[.toast]:shadow-green-500/20",
          error: "group-[.toast]:border-red-500/50 group-[.toast]:shadow-red-500/20",
          info: "group-[.toast]:border-blue-500/50 group-[.toast]:shadow-blue-500/20",
          warning: "group-[.toast]:border-yellow-500/50 group-[.toast]:shadow-yellow-500/20",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
