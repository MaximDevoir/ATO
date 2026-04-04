import { z } from 'zod';

const ZoneSchema = z
  .object({
    includes: z.string().min(1).optional(),
    classBody: z.string().min(1).optional(),
  })
  .strict();

const ProjectSetupSchema = z
  .object({
    plugins: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const PostinstallScriptSchema = z
  .object({
    setupModules: ZoneSchema.optional(),
    setupTargets: ZoneSchema.optional(),
    setupProject: ProjectSetupSchema.optional(),
  })
  .strict();

export type ZoneConfig = z.infer<typeof ZoneSchema>;
export type ProjectSetup = z.infer<typeof ProjectSetupSchema>;
export type PostinstallScript = z.infer<typeof PostinstallScriptSchema>;

export interface LoadedPostinstallScript {
  pluginName: string;
  pluginRoot: string;
  scriptPath: string;
  script: PostinstallScript;
}
