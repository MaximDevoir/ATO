import path from 'node:path';
import ignore from 'ignore';
import type { IgnoreRule } from './IgnoreRuleLoader.js';

export class IgnoreEvaluator {
  shouldIgnore(relativePath: string, absolutePath: string, rules: IgnoreRule[]) {
    if (relativePath === 'uapkg.lock') {
      return true;
    }

    if (relativePath === '.uapkg' || relativePath.startsWith('.uapkg/')) {
      return true;
    }

    const fullPathNormalized = absolutePath.split(path.sep).join('/');

    let ignored = false;

    for (const rule of rules) {
      const ruleDirNormalized = path.resolve(rule.ruleDirectory).split(path.sep).join('/');
      if (!fullPathNormalized.startsWith(ruleDirNormalized)) {
        continue;
      }

      const relativeFromRuleDir = path.relative(rule.ruleDirectory, absolutePath).split(path.sep).join('/');

      if (relativeFromRuleDir.startsWith('..')) {
        continue;
      }

      const matcher = ignore().add(rule.pattern);
      if (matcher.ignores(relativeFromRuleDir)) {
        ignored = !rule.pattern.trimStart().startsWith('!');
      }
    }

    return ignored;
  }
}
