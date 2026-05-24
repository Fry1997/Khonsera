import { NextRequest, NextResponse } from "next/server";
import bwipjs from "bwip-js";

export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  const format = req.nextUrl.searchParams.get("format") ?? "azteccode";
  const scale = Number(req.nextUrl.searchParams.get("scale") ?? "3");

  if (!data) {
    return NextResponse.json({ error: "Missing ?data=" }, { status: 400 });
  }

  try {
    const png = await bwipjs.toBuffer({
      bcid: format,
      text: data,
      scale,
      padding: 4,
    });

    return new NextResponse(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Barcode generation failed" },
      { status: 500 },
    );
  }
}
