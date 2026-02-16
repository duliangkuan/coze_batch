import { z } from "zod";

export const inputSchemaItem = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "file"]),
});

export const outputSchemaItem = z.object({
  key: z.string(),
  path: z.string(),
  label: z.string(),
  type: z.enum(["text", "file", "link"]),
});

export const inputSchemaArray = z.array(inputSchemaItem);
export const outputSchemaArray = z.array(outputSchemaItem);

export type InputSchemaItem = z.infer<typeof inputSchemaItem>;
export type OutputSchemaItem = z.infer<typeof outputSchemaItem>;
