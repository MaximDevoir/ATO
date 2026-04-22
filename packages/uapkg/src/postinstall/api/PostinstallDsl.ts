import { z } from 'zod';

/**
 * Zone-level content injected into a single Unreal build file (Build.cs or Target.cs).
 *
 * - `includes`: raw C# `using ...;` lines appended to the file's using block.
 * - `classBody`: raw C# members placed inside the target class; uapkg wraps them
 *   in a hashed helper class and inserts a single `Apply(this)` call into the
 *   constructor. The content must compile as a member list.
 */
export const ZoneSchema = z
  .object({
    includes: z.string().min(1).optional(),
    classBody: z.string().min(1).optional(),
  })
  .strict();

/**
 * Project-level setup: plugins to enable in the host project's `.uproject`.
 */
export const ProjectSetupSchema = z
  .object({
    plugins: z.array(z.string().min(1)).optional(),
  })
  .strict();

/**
 * The authoritative shape of `export default definePostinstall({...})`.
 *
 * Scopes:
 * - `setupModules`: applied to each *project postinstall module* Build.cs file.
 * - `setupTargets`: applied to every *.Target.cs in the host project.
 * - `setupProject`: edits the host project's `.uproject`.
 */
export const PostinstallDefinitionSchema = z
  .object({
    setupModules: ZoneSchema.optional(),
    setupTargets: ZoneSchema.optional(),
    setupProject: ProjectSetupSchema.optional(),
  })
  .strict();

export type ZoneDefinition = z.infer<typeof ZoneSchema>;
export type ProjectSetupDefinition = z.infer<typeof ProjectSetupSchema>;
export type PostinstallDefinition = z.infer<typeof PostinstallDefinitionSchema>;

