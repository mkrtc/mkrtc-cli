import z from "zod";

export const CheckCreateAndSaveSshDtoSchema = z.object({
  user: z.string(),
  ip: z.string(),
  password: z.string().optional(),
  name: z.string(),
  connect: z.boolean().optional(),
  args: z
    .string()
    .transform((v) => v.split(","))
    .optional(),
});

export type CreateAndSaveSshDto = z.infer<
  typeof CheckCreateAndSaveSshDtoSchema
>;

export const CheckConnectSshDtoSchema = z.object({
  name: z.string(),
});

export type ConnectSshDto = z.infer<typeof CheckConnectSshDtoSchema>;
