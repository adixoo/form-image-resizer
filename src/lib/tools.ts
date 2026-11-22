import { FileDown, FileImage, Files, IdCard, Image as ImageIcon } from "lucide-react"
import type { FileKind, ToolId } from "./file-library"

/** Every tool: its route, nav label key (nav.*), icon, and the file kinds it takes. */
export const TOOLS: { id: ToolId; href: string; icon: typeof ImageIcon; accepts: FileKind[] }[] = [
  { id: "image", href: "/", icon: ImageIcon, accepts: ["image"] },
  { id: "pdf", href: "/pdf-compress", icon: FileDown, accepts: ["pdf"] },
  { id: "idCard", href: "/id-card", icon: IdCard, accepts: ["image"] },
  { id: "merge", href: "/pdf-merge", icon: Files, accepts: ["pdf", "image"] },
  { id: "toPdf", href: "/image-to-pdf", icon: FileImage, accepts: ["image"] },
]
