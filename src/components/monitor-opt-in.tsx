'use client'

import { useState } from 'react'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export function MonitorOptIn({
  seedUrl,
  defaultEmail,
}: {
  seedUrl: string
  defaultEmail?: string
}) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [slack, setSlack] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs border border-slate-600 hover:border-slate-400 text-slate-200 px-3 py-1.5 rounded transition"
      >
        Enable weekly monitoring
      </button>
    )
  }

  return (
    <form
      className="space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError(null)
        setMessage(null)
        try {
          const res = await fetch('/api/monitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              seedUrl,
              alertEmail: email,
              slackWebhookUrl: slack || undefined,
              cadence: 'weekly',
              enabled: true,
            }),
          })
          const data = (await res.json()) as { error?: string }
          if (!res.ok) throw new Error(data.error || 'Could not enable monitoring')
          setMessage(
            'Weekly monitoring is on. We will re-scan this host and email you if the score drops.'
          )
        } catch (err) {
          setError(errorMessage(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-xs text-slate-400">
        Catch regressions when editors add pages. Uses one scan credit per
        weekly check.
      </p>
      <label className="block text-xs text-slate-400 space-y-1">
        Alert email
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
        />
      </label>
      <label className="block text-xs text-slate-400 space-y-1">
        Slack webhook (optional)
        <input
          value={slack}
          onChange={(e) => setSlack(e.target.value)}
          placeholder="https://hooks.slack.com/services/…"
          className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 font-mono"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="text-xs bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-3 py-1.5 rounded"
        >
          {busy ? 'Saving…' : 'Save monitor'}
        </button>
        <button
          type="button"
          className="text-xs text-slate-400 px-2"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
      {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  )
}
