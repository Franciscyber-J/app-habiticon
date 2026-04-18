import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const UPLOAD_DIR = process.env.UPLOAD_PATH
  ? path.resolve(process.env.UPLOAD_PATH)
  : path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png":  "image/png",
  ".webp": "image/webp",
  ".gif":  "image/gif",
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await context.params;
    const relative = segments.join("/");
    const full = path.resolve(path.join(UPLOAD_DIR, relative));

    // Segurança: não permite sair da pasta de uploads
    if (!full.startsWith(path.resolve(UPLOAD_DIR))) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const buf = await fs.readFile(full);
    const ext = path.extname(full).toLowerCase();
    const ct  = MIME[ext] ?? "application/octet-stream";

    return new NextResponse(buf, {
      headers: {
        "Content-Type":  ct,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}