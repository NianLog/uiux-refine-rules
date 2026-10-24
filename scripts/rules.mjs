#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { atomicWrite, loadLibrary, query, readJson, requireThat } from './library.mjs';
import { checkProject, prepareReview, recordReview, ruleDiff } from './tracking.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const help = `uiux-refine-rules (Node.js >=22，无外部依赖)
  node scripts/rules.mjs validate
  node scripts/rules.mjs index
  node scripts/rules.mjs query [--tags drawer,form | --ids UXR-0018] [--full]
  node scripts/rules.mjs check --project <path>
  node scripts/rules.mjs prepare --project <path> --decision D-001
  node scripts/rules.mjs diff --project <path> --decision D-001 --id UXR-0018
  node scripts/rules.mjs record --project <path> --review <review.json>
退出码：0 一致/成功；1 无法检查或请求无效；2 有待复核；3 项目未接入。
prepare 仅输出待填写 JSON。record 只写采纳记录，不修改设计文档。`;

try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    project: { type: 'string' }, decision: { type: 'string' }, id: { type: 'string' },
    tags: { type: 'string' }, ids: { type: 'string' }, full: { type: 'boolean' },
    review: { type: 'string' }, help: { type: 'boolean' },
  } });
  const command = positionals[0];
  if (values.help || !command) console.log(help);
  else {
    requireThat(positionals.length === 1, '只接受一个子命令');
    const allowed = { validate: [], index: [], query: ['tags', 'ids', 'full'], check: ['project'], prepare: ['project', 'decision'], diff: ['project', 'decision', 'id'], record: ['project', 'review'] };
    requireThat(Object.hasOwn(allowed, command), `未知命令：${command}`);
    requireThat(Object.keys(values).every(key => allowed[command].includes(key)), '该命令不支持所给参数');
    const library = loadLibrary(root, command !== 'index');
    let result;
    if (command === 'validate') result = { status: 'valid', rules: library.rules.size, library_hash: library.hash };
    else if (command === 'index') {
      atomicWrite(path.join(root, 'index.json'), JSON.stringify(library.index, null, 2) + '\n');
      result = { status: 'indexed', rules: library.rules.size };
    } else if (command === 'query') result = query(library, { tags: values.tags?.split(',') || [], ids: values.ids?.split(',') || [], full: values.full });
    else {
      requireThat(values.project, '缺少 --project');
      if (command === 'check') result = checkProject(library, values.project);
      if (command === 'prepare') { requireThat(values.decision, '缺少 --decision'); result = prepareReview(library, values.project, values.decision); }
      if (command === 'diff') { requireThat(values.decision && values.id, '缺少 --decision 或 --id'); result = ruleDiff(library, values.project, values.decision, values.id); }
      if (command === 'record') { requireThat(values.review, '缺少 --review'); result = recordReview(library, values.project, readJson(values.review)); }
    }
    console.log(JSON.stringify(result, null, 2));
    if (result.status === 'review_required') process.exitCode = 2;
    if (result.status === 'untracked') process.exitCode = 3;
  }
} catch (error) {
  console.error(JSON.stringify({ status: 'error', message: error.message }));
  process.exitCode = 1;
}
