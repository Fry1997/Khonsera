import { NextRequest, NextResponse } from "next/server";
import { toBuffer } from "bwip-js/node";

export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get("data");
  const format = req.nextUrl.searchParams.get("format") ?? "azteccode";
  const scale = Number(req.nextUrl.searchParams.get("scale") ?? "3");

  if (!data) {
    return NextResponse.json({ error: "Missing ?data=" }, { status: 400 });
  }

  try {
    const png = await toBuffer({
      bcid: format,
      text: data,
      scale,
      paddingwidth: 4,
      paddingheight: 4,
    });

    return new NextResponse(new Uint8Array(png), {
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
