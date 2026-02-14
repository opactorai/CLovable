import { NextResponse } from "next/server";
import { checkRepositoryAvailabilitySimple } from "@/lib/github-api";
import { getPlainServiceToken } from "@/lib/services/tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { repo_name: string } }
) {
  try {
    const token = await getPlainServiceToken("github");
    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 401 });
    }

    const owner = "YOUR_GITHUB_USERNAME"; // 또는 DB에서 가볍게만
    const result = await checkRepositoryAvailabilitySimple(
      token,
      owner,
      params.repo_name
    );

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
