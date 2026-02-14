import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { ingredients } = await req.json();

    if (!ingredients) {
      return NextResponse.json(
        { recipes: "재료를 입력해주세요 🙂" },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "너는 요리 전문가야." },
          {
            role: "user",
            content: `다음 재료로 만들 수 있는 요리를 3개 추천해줘: ${ingredients}`,
          },
        ],
      }),
    });

    const data = await response.json();

    console.log("OPENAI RAW RESPONSE 👉", data);

    // 🔴 OpenAI에서 에러가 왔을 경우 (쿼터 초과 등)
    if (!response.ok) {
      console.error("OpenAI Error:", data);

      return NextResponse.json({
        recipes: `⚠️ 현재 AI 사용량이 초과되어 임시 추천을 보여드립니다.

1. ${ingredients} 볶음
2. ${ingredients} 오믈렛
3. ${ingredients} 샐러드`,
      });
    }

    // 🔴 choices가 없는 경우 방어
    if (!data.choices || !data.choices[0]) {
      return NextResponse.json({
        recipes: "AI 응답이 비어 있습니다. 다시 시도해 주세요.",
      });
    }

    // ✅ 정상 응답
    return NextResponse.json({
      recipes: data.choices[0].message.content,
    });

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return NextResponse.json({
      recipes: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    });
  }
}
