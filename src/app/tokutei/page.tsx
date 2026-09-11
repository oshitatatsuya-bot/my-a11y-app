import Link from "next/link"

import { MERCHANT } from "@/lib/merchant"

export const metadata = {
  title: "特定商取引法に基づく表記 — A11yFix",
  description: "A11yFix の特定商取引法に基づく表記です。",
}

const rows: { label: string; value: string }[] = [
  {
    label: "販売業者",
    value: `${MERCHANT.sellerName}（${MERCHANT.role}）。${MERCHANT.nameNote}`,
  },
  { label: "サービス名", value: MERCHANT.businessName },
  {
    label: "所在地",
    value: MERCHANT.address,
  },
  { label: "メールアドレス", value: MERCHANT.email },
  {
    label: "電話番号",
    value: `${MERCHANT.phone}（${MERCHANT.phoneNote}）`,
  },
  { label: "サイト URL", value: MERCHANT.siteUrl },
  { label: "販売価格", value: MERCHANT.priceNote },
  { label: "代金の支払時期・方法", value: MERCHANT.paymentNote },
  { label: "役務の提供時期", value: MERCHANT.deliveryNote },
  { label: "返品・キャンセル", value: MERCHANT.cancelNote },
  { label: "その他の費用", value: MERCHANT.extraFees },
]

export default function TokuteiPage() {
  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-slate-950">
          A11yFix
        </Link>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-950">
          特定商取引法に基づく表記
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Specified Commercial Transactions Act disclosure (Japan).
        </p>

        <dl className="mt-10 divide-y divide-slate-200 border-y border-slate-200">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-2 py-4 sm:grid-cols-[12rem_1fr] sm:gap-6"
            >
              <dt className="text-sm font-medium text-slate-950">{row.label}</dt>
              <dd className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                {row.label === "メールアドレス" ? (
                  <a
                    href={`mailto:${MERCHANT.email}`}
                    className="text-sky-800 underline underline-offset-4"
                  >
                    {row.value}
                  </a>
                ) : row.label === "サイト URL" ? (
                  <a
                    href={MERCHANT.siteUrl}
                    className="text-sky-800 underline underline-offset-4"
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-sm text-slate-500">
          表記内容に誤りや更新がある場合は{" "}
          <a
            href={`mailto:${MERCHANT.email}`}
            className="text-sky-800 underline underline-offset-4"
          >
            {MERCHANT.email}
          </a>{" "}
          までご連絡ください。
        </p>
      </div>
    </main>
  )
}
