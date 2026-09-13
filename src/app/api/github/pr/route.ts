import { NextRequest, NextResponse } from "next/server"
import { Octokit } from "octokit"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export const maxDuration = 30

/**
 * Opens a GitHub pull request with an AI-generated HTML fix.
 * The fine-grained PAT is accepted per request and never stored.
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: "Sign in to open a pull request", code: "AUTH_REQUIRED" },
      { status: 401 }
    )
  }

  try {
    const body = await req.json()
    const token = String(body.token ?? "").trim()
    const owner = String(body.owner ?? "").trim()
    const repo = String(body.repo ?? "").trim()
    const path = String(body.path ?? "").trim().replace(/^\/+/, "")
    const content = String(body.content ?? "")
    const title =
      String(body.title ?? "").trim() || "fix(a11y): apply A11yFix suggestion"
    const explanation = String(body.explanation ?? "").trim()
    const baseBranch = String(body.base ?? "").trim() || undefined

    if (!token || !owner || !repo || !path || !content) {
      return NextResponse.json(
        {
          error:
            "token, owner, repo, path, and content are required to open a PR.",
        },
        { status: 400 }
      )
    }

    if (content.length > 200_000) {
      return NextResponse.json(
        { error: "Patch content is too large." },
        { status: 400 }
      )
    }

    const octokit = new Octokit({ auth: token })
    const { data: repository } = await octokit.rest.repos.get({ owner, repo })
    const defaultBase = baseBranch || repository.default_branch

    const { data: baseRef } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBase}`,
    })
    const baseSha = baseRef.object.sha

    const branch = `a11yfix/${Date.now().toString(36)}`
    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    })

    let existingSha: string | undefined
    try {
      const { data: existing } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref: branch,
      })
      if (!Array.isArray(existing) && "sha" in existing) {
        existingSha = existing.sha
      }
    } catch {
      // File may not exist yet — create it.
    }

    const message = explanation
      ? `${title}\n\n${explanation.slice(0, 1800)}\n\nGenerated with A11yFix.`
      : `${title}\n\nGenerated with A11yFix.`

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(existingSha ? { sha: existingSha } : {}),
    })

    const bodyMarkdown = [
      "## A11yFix suggested change",
      "",
      explanation || "_No explanation provided._",
      "",
      "Please review before merge. Automated WCAG checks do not replace human judgment or legal advice.",
      "",
      `Opened via [A11yFix](https://www.geta11yfix.com).`,
    ].join("\n")

    const { data: pr } = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      head: branch,
      base: defaultBase,
      body: bodyMarkdown,
    })

    return NextResponse.json({
      prUrl: pr.html_url,
      prNumber: pr.number,
      branch,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("GitHub PR error:", message)
    const status =
      /Bad credentials|401/i.test(message)
        ? 401
        : /Not Found|404/i.test(message)
          ? 404
          : /403|Resource not accessible/i.test(message)
            ? 403
            : 500
    return NextResponse.json(
      {
        error:
          status === 401
            ? "GitHub rejected that token. Use a fine-grained PAT with Contents: Read and write and Pull requests: Read and write."
            : status === 404
              ? "Repository or path not found for that token."
              : status === 403
                ? "GitHub denied write access. Check token permissions and SSO authorization."
                : "Could not open the pull request. Check the repo path and try again.",
        details: message,
        code: "GITHUB_PR_FAILED",
      },
      { status }
    )
  }
}
