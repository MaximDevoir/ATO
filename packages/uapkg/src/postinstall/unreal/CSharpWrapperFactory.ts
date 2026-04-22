import * as CSharpAst from '@amplication/csharp-ast';

export type WrapperContextType = 'ModuleRules' | 'TargetRules';

/**
 * Produces the hashed helper class that wraps user-supplied `classBody` content.
 *
 * The helper has the shape:
 *
 * ```csharp
 * static class UAPKG_<hash>
 * {
 *     public static void Apply(ModuleRules|TargetRules rules|target)
 *     {
 *         <user body>
 *     }
 * }
 * ```
 *
 * We use `@amplication/csharp-ast` to generate a syntactically valid class and
 * then patch the output:
 *   * strip an invalid `using ;` line the library emits for empty namespaces;
 *   * retype the `object` parameter back to the requested ModuleRules/TargetRules.
 */
export class CSharpWrapperFactory {
  public createWrapper(
    className: string,
    contextType: WrapperContextType,
    contextName: string,
    body: string,
  ): string {
    const wrapperClass = new CSharpAst.Class({
      name: className,
      namespace: '',
      access: 'private',
      static_: true,
      isNestedClass: true,
    });
    const applyMethod = new CSharpAst.Method({
      name: 'Apply',
      access: 'public',
      isAsync: false,
      type: CSharpAst.MethodType.STATIC,
      parameters: [
        new CSharpAst.Parameter({
          name: contextName,
          // csharp-ast adds invalid `using ;` when ClassReference namespace is empty.
          // We emit with `object` and patch to ModuleRules/TargetRules below.
          type: CSharpAst.Type.object(),
        }),
      ],
      body: new CSharpAst.CodeBlock({ code: body.trim() }),
    });
    wrapperClass.addMethod(applyMethod);

    const writer = new CSharpAst.Writer({});
    writer.writeNode(wrapperClass);
    return this.normalize(writer.toString(), contextType, contextName);
  }

  private normalize(source: string, contextType: WrapperContextType, contextName: string): string {
    const withoutTrailing = source.trim().replace(/[ \t]+\n/g, '\n');
    return withoutTrailing
      .replace(/^private static class/m, 'static class')
      .replace(
        new RegExp(`public static void Apply\\(object\\s+${contextName}\\)`),
        `public static void Apply(${contextType} ${contextName})`,
      )
      .replace(/\)\s*{\n/g, ')\n    {\n')
      .replace(/;\}/g, ';\n    }');
  }
}

