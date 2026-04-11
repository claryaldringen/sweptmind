import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { services } from "@/infrastructure/container";
import { blobStorage } from "@/infrastructure/container";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const taskId = formData.get("taskId") as string | null;

  if (!file || !taskId) {
    return NextResponse.json({ error: "Missing file or taskId" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";

  try {
    await services.attachment.validateUpload(session.user.id, taskId, file.size, mimeType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Validation failed" },
      { status: 400 },
    );
  }

  const relativePath = `attachments/${session.user.id}/${taskId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const blobUrl = await blobStorage.save(relativePath, buffer);

  return NextResponse.json({ blobUrl });
}
