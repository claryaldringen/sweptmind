import { NextRequest, NextResponse } from "next/server";
import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, fileName, fileSize, mimeType } = await req.json();

  try {
    // Validate premium status, file size, storage quota, MIME type
    await services.attachment.validateUpload(session.user.id, taskId, fileSize, mimeType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 },
    );
  }

  const pathname = `attachments/${session.user.id}/${taskId}/${fileName}`;

  const clientToken = await generateClientTokenFromReadWriteToken({
    token: process.env.BLOB_READ_WRITE_TOKEN!,
    pathname,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: 10 * 1024 * 1024, // 10 MB
    validUntil: Date.now() + 5 * 60 * 1000, // 5 min
    addRandomSuffix: true,
  });

  return NextResponse.json({ clientToken, pathname });
}
