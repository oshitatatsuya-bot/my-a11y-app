import { readFile } from "node:fs/promises"
import path from "node:path"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export async function GuideDocument({
  file,
  langSwitch,
}: {
  file: "user-guide.md" | "user-guide.ja.md"
  langSwitch: { href: string; label: string }
}) {
  const md = await readFile(path.join(process.cwd(), "docs", file), "utf8")

  return (
    <main className="min-h-screen bg-white text-slate-800">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="text-sm font-semibold text-slate-950">
            A11yFix
          </Link>
          <p className="text-sm text-slate-500">
            <Link
              href={langSwitch.href}
              className="text-sky-800 underline underline-offset-4 hover:text-sky-950"
            >
              {langSwitch.label}
            </Link>
            <span aria-hidden="true"> · </span>
            <Link href="/scan" className="hover:text-slate-700">
              Open scanner
            </Link>
          </p>
        </div>

        <article className="guide-doc mt-10 text-sm leading-relaxed text-slate-700">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2 className="mt-10 text-xl font-semibold text-slate-950">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="mt-6 text-base font-semibold text-slate-950">
                  {children}
                </h3>
              ),
              p: ({ children }) => <p className="mt-3">{children}</p>,
              ul: ({ children }) => (
                <ul className="mt-3 list-disc space-y-1 pl-5">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="mt-3 list-decimal space-y-1 pl-5">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-sky-800 underline underline-offset-4 hover:text-sky-950"
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-slate-950">{children}</strong>
              ),
              hr: () => <hr className="my-8 border-slate-200" />,
              table: ({ children }) => (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full border-collapse text-left text-sm">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-slate-50 text-slate-600">{children}</thead>
              ),
              th: ({ children }) => (
                <th className="border-b border-slate-200 px-3 py-2 font-medium">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border-b border-slate-100 px-3 py-2 align-top">
                  {children}
                </td>
              ),
              code: ({ children, className }) => {
                const isBlock = Boolean(className)
                if (isBlock) {
                  return (
                    <code className="block overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">
                      {children}
                    </code>
                  )
                }
                return (
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-900">
                    {children}
                  </code>
                )
              },
            }}
          >
            {md}
          </ReactMarkdown>
        </article>

        <p className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
          Questions?{" "}
          <a
            href="mailto:support@geta11yfix.com"
            className="text-sky-800 underline underline-offset-4"
          >
            support@geta11yfix.com
          </a>
        </p>
      </div>
    </main>
  )
}
