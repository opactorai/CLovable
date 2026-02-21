import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRepositoryAvailability } from "@/lib/github-api";
import { getPlainServiceToken } from "@/lib/services/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repo_name: string }> }
) {
  try {
    const { repo_name } = await params; // 🔥 여기서 await 해야 함

    const token = await getPlainServiceToken("github");
    if (!token) {
      return NextResponse.json({ error: "No GitHub token" }, { status: 401 });
    }

    const owner = process.env.GITHUB_OWNER!;
    const result = await checkRepositoryAvailability(
      token,
      owner,
      repo_name
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
