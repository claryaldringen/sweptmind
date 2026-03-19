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

// Mutation: register attachment (client already uploaded to Vercel Blob)
builder.mutationField("registerAttachment", (t) =>
  t.field({
    type: AttachmentRef,
    authScopes: { authenticated: true },
    args: {
      taskId: t.arg.string({ required: true }),
      fileName: t.arg.string({ required: true }),
      fileSize: t.arg.int({ required: true }),
      mimeType: t.arg.string({ required: true }),
      blobUrl: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      return ctx.services.attachment.createRecord(ctx.userId!, {
        taskId: args.taskId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        mimeType: args.mimeType,
        blobUrl: args.blobUrl,
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
      const blobUrl = await ctx.services.attachment.getAttachmentBlobUrl(args.id, ctx.userId!);
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
