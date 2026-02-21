import { NextRequest, NextResponse } from "next/server";
import { getPlainServiceToken } from "@/lib/services/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const repoName = body?.repo_name;
    const description = body?.description ?? "";
    const isPrivate = body?.private ?? false;

    if (!repoName || typeof repoName !== "string") {
      return NextResponse.json(
        { success: false, error: "repo_name is required" },
        { status: 400 }
      );
    }

    const token = await getPlainServiceToken("github");
    if (!token) {
      return NextResponse.json(
        { success: false, error: "GitHub token not configured" },
        { status: 401 }
      );
    }

    // 1️⃣ 사용자 정보 가져오기
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!userRes.ok) {
      throw new Error("Failed to fetch GitHub user");
    }

    const user = await userRes.json();

    // 2️⃣ 레포 생성
    const repoRes = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github+json",
      },
      body: JSON.stringify({
        name: repoName,
        description,
        private: isPrivate,
      }),
    });

    if (!repoRes.ok) {
      const err = await repoRes.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: err?.message ?? "Failed to create repo" },
        { status: repoRes.status }
      );
    }

    const repo = await repoRes.json();

    return NextResponse.json({
      success: true,
      repo_url: repo.html_url,
      html_url: repo.html_url,
      clone_url: repo.clone_url,
      default_branch: repo.default_branch,
      owner: user.login,
    });
  } catch (error) {
    console.error("[API] Failed to create GitHub repository:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create GitHub repository",
      },
      { status: 500 }
    );
  }
}