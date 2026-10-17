import { createContext, useContext } from "react"
import type { ToolId } from "@/lib/file-library"

/** Which tool this page shows, for components shared by every tool (files bar). */
export const ToolContext = createContext<ToolId | null>(null)

export function useCurrentTool(): ToolId | null {
  return useContext(ToolContext)
}
