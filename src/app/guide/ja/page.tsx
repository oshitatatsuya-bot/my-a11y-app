import { GuideDocument } from "@/components/guide-document"

export const metadata = {
  title: "利用者ガイド — A11yFix",
  description:
    "A11yFix の使い方：サイトスキャン、AI 修正、GitHub PR、Draft ACR、バッジ、監視。",
}

export const dynamic = "force-static"

export default function GuideJaPage() {
  return (
    <GuideDocument
      file="user-guide.ja.md"
      langSwitch={{ href: "/guide", label: "English" }}
    />
  )
}
