import { NextRequest, NextResponse } from "next/server";
import { debugFetchEmail } from "@/lib/actions/gmail";

export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("id");
  if (!messageId) {
    return NextResponse.json({ error: "Missing ?id= parameter" }, { status: 400 });
  }

  const result = await debugFetchEmail(messageId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    subject: result.value.subject,
    from: result.value.from,
    cleanedTextLength: result.value.cleanedText.length,
    cleanedText: result.value.cleanedText,
    htmlLength: result.value.html?.length ?? 0,
    attachments: result.value.attachments,
    pdfTexts: result.value.pdfTexts,
    parsed: result.value.parsed,
  });
}
