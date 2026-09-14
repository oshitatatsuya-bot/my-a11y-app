import { GuideDocument } from "@/components/guide-document"

export const metadata = {
  title: "User guide — A11yFix",
  description:
    "How to use A11yFix: site scans, AI fixes, GitHub PRs, draft ACR, badges, and monitoring.",
}

export const dynamic = "force-static"

export default function GuidePage() {
  return (
    <GuideDocument
      file="user-guide.md"
      langSwitch={{ href: "/guide/ja", label: "日本語" }}
    />
  )
}
