import { builder } from "../builder";
import { AttachmentRef } from "./refs";

export const AttachmentType = AttachmentRef.implement({
  fields: (t) => ({
    id: t.exposeString("id"),
    taskId: t.exposeString("taskId"),
    fileName: t.exposeString("fileName"),
    fileSize: t.exposeInt("fileSize"),
    mimeType: t.exposeString("mimeType"),
    createdAt: t.field({
      type: "String",
      resolve: (a) => a.createdAt.toISOString(),
    }),
  }),
});

// Mutation: upload attachment
builder.mutationField("uploadAttachment", (t) =>
  t.field({
    type: AttachmentRef,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      fileName: t.arg.string({ required: true }),
      fileSize: t.arg.int({ required: true }),
      mimeType: t.arg.string({ required: true }),
      fileBase64: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const { put } = await import("@vercel/blob");
      const buffer = Buffer.from(args.fileBase64, "base64");

      const blob = await put(
        `attachments/${ctx.userId}/${args.taskId}/${args.fileName}`,
        buffer,
        { access: "public", contentType: args.mimeType },
      );

      return ctx.services.attachment.upload(ctx.userId!, {
        taskId: args.taskId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        blobUrl: blob.url,
      });
    },
  }),
);

// Mutation: delete attachment
builder.mutationField("deleteAttachment", (t) =>
  t.field({
    type: "Boolean",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      const blobUrl = await ctx.services.attachment.download(args.id, ctx.userId!);
      const { del } = await import("@vercel/blob");
      await del(blobUrl);
      await ctx.services.attachment.deleteAttachment(args.id, ctx.userId!);
      return true;
    },
  }),
);

// Query: download attachment URL
builder.queryField("attachmentDownloadUrl", (t) =>
  t.field({
    type: "String",
    authScopes: { authenticated: true },
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      return ctx.services.attachment.download(args.id, ctx.userId!);
    },
  }),
);
