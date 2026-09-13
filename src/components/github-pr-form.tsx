'use client'

import { useState } from 'react'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Opens a GitHub PR with the fixed HTML. Token is sent once and never stored.
 */
export function GithubPrForm({
  fixedCode,
  explanation,
  ruleId,
}: {
  fixedCode: string
  explanation: string
  ruleId: string
}) {
  const [open, setOpen] = useState(false)
  const [owner, setOwner] = useState('')
  const [repo, setRepo] = useState('')
  const [path, setPath] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prUrl, setPrUrl] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setPrUrl(null)
    try {
      const res = await fetch('/api/github/pr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner,
          repo,
          path,
          token,
          content: fixedCode,
          explanation,
          title: `fix(a11y): ${ruleId} via A11yFix`,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        prUrl?: string
      }
      if (!res.ok) {
        throw new Error(data.error || 'Could not open PR')
      }
      if (!data.prUrl) throw new Error('GitHub did not return a PR URL')
      setPrUrl(data.prUrl)
      setToken('')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs bg-slate-800 hover:bg-slate-700 text-white font-medium px-4 py-2 rounded transition border border-slate-600"
      >
        Open GitHub PR
      </button>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-slate-700 bg-slate-900/80 p-3"
    >
      <p className="text-xs text-slate-400">
        Paste a fine-grained personal access token with Contents and Pull
        requests write access. The token is used once for this request and is
        not saved.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-slate-400 space-y-1">
          Owner
          <input
            required
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            placeholder="acme"
            autoComplete="off"
          />
        </label>
        <label className="text-xs text-slate-400 space-y-1">
          Repo
          <input
            required
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            placeholder="website"
            autoComplete="off"
          />
        </label>
      </div>
      <label className="block text-xs text-slate-400 space-y-1">
        File path in repo
        <input
          required
          value={path}
          onChange={(e) => setPath(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 font-mono"
          placeholder="src/components/Hero.tsx"
          autoComplete="off"
        />
      </label>
      <label className="block text-xs text-slate-400 space-y-1">
        GitHub token
        <input
          required
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 font-mono"
          placeholder="github_pat_…"
          autoComplete="off"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded transition"
        >
          {busy ? 'Opening PR…' : 'Create pull request'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 px-3 py-2"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {prUrl ? (
        <p className="text-xs text-emerald-300">
          PR opened:{' '}
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            {prUrl}
          </a>
        </p>
      ) : null}
    </form>
  )
}
