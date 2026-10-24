import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const RULESET = 'uiux-refine-rules';
export const ID = /^UXR-\d{4}$/;
export const HASH = /^[a-f0-9]{64}$/;
export const normalize = text => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd() + '\n';
export const sha = text => createHash('sha256').update(text).digest('hex');
export const canonical = value => JSON.stringify(sort(value));
const sort = value => Array.isArray(value) ? value.map(sort) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])])) : value;
export const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
export const nonempty = value => typeof value === 'string' && value.trim().length > 0;
export const strings = value => Array.isArray(value) && value.every(nonempty) && new Set(value).size === value.length;
export const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export const fields = (value, required, optional = []) => {
  requireThat(object(value), '需要 JSON 对象');
  requireThat(required.every(key => Object.hasOwn(value, key)), `缺少字段：${required.join(', ')}`);
  requireThat(Object.keys(value).every(key => [...required, ...optional].includes(key)), '存在未知字段');
};

export const readText = filename => {
  requireThat(!fs.lstatSync(filename).isSymbolicLink(), `不读取符号链接：${filename}`);
  return new TextDecoder('utf-8', { fatal: true }).decode(fs.readFileSync(filename));
};
export const readJson = filename => JSON.parse(readText(filename));

export function atomicWrite(filename, text, beforeRename = () => {}) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, text, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    beforeRename();
    fs.renameSync(temporary, filename);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

export function validateMetadata(meta) {
  fields(meta, ['id', 'title', 'summary', 'level', 'status', 'tags', 'depends_on', 'replaced_by', 'basis', 'sources']);
  requireThat(ID.test(meta.id), '规则 ID 必须是 UXR-0001 格式');
  requireThat(nonempty(meta.title) && nonempty(meta.summary), `${meta.id} 缺少标题或摘要`);
  requireThat(['must', 'default', 'optional'].includes(meta.level), `${meta.id} 约束级别无效`);
  requireThat(['active', 'deprecated'].includes(meta.status), `${meta.id} 状态无效`);
  requireThat(strings(meta.tags) && meta.tags.length > 0 && meta.tags.every(tag => /^[a-z][a-z0-9-]*$/.test(tag)), `${meta.id} 标签无效`);
  for (const key of ['depends_on', 'replaced_by']) {
    requireThat(strings(meta[key]) && meta[key].every(id => ID.test(id)), `${meta.id} ${key} 无效`);
  }
  requireThat(meta.status === 'deprecated' || meta.replaced_by.length === 0, `${meta.id} 活跃规则不能有替代项`);
  requireThat(['standard', 'guidance', 'preference', 'engineering'].includes(meta.basis), `${meta.id} 依据类型无效`);
  requireThat(strings(meta.sources) && meta.sources.length > 0 && meta.sources.every(source => source.startsWith('https://') || /^user:\d{4}-\d{2}-\d{2}$/.test(source)), `${meta.id} 来源无效`);
}

export function snapshotHash(snapshot) {
  fields(snapshot, ['metadata', 'body']);
  validateMetadata(snapshot.metadata);
  requireThat(nonempty(snapshot.body), '规则正文不能为空');
  return sha(canonical({ metadata: snapshot.metadata, body: normalize(snapshot.body) }));
}

export function parseRule(text, filename) {
  const match = normalize(text).match(/^```json\n([\s\S]*?)\n```\n+([\s\S]+)$/);
  requireThat(match, `${filename} 必须以 JSON 元数据代码块开始`);
  const snapshot = { metadata: JSON.parse(match[1]), body: normalize(match[2]) };
  const hash = snapshotHash(snapshot);
  for (const heading of ['适用条件', '排除条件', '规则', '参数', '验收', '反例']) {
    requireThat(snapshot.body.includes(`\n## ${heading}\n`), `${filename} 缺少 ${heading}`);
  }
  return { ...snapshot.metadata, hash, snapshot, path: filename };
}

const walkRules = (directory, root) => fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en')).flatMap(entry => {
  requireThat(!entry.isSymbolicLink(), `规则目录不支持符号链接：${entry.name}`);
  const filename = path.join(directory, entry.name);
  if (entry.isDirectory()) return walkRules(filename, root);
  return entry.isFile() && entry.name.endsWith('.md') ? [parseRule(readText(filename), path.relative(root, filename).split(path.sep).join('/'))] : [];
});

function assertAcyclic(rules, relation) {
  const visiting = new Set();
  const visited = new Set();
  const visit = id => {
    requireThat(!visiting.has(id), `${relation} 存在循环：${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const target of rules.get(id)[relation]) {
      requireThat(rules.has(target), `${id} 引用了缺失规则 ${target}`);
      if (relation === 'depends_on' && rules.get(id).status === 'active') {
        requireThat(rules.get(target).status === 'active', `${id} 依赖了废弃规则 ${target}`);
      }
      visit(target);
    }
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of rules.keys()) visit(id);
}

export function loadLibrary(root, verifyIndex = true) {
  root = fs.realpathSync(root);
  requireThat(!fs.lstatSync(path.join(root, 'rules')).isSymbolicLink(), 'rules 目录不能是符号链接');
  const list = walkRules(path.join(root, 'rules'), root).sort((a, b) => a.id.localeCompare(b.id));
  requireThat(list.length > 0, '规则库为空');
  const rules = new Map();
  const prefixes = new Set();
  for (const rule of list) {
    requireThat(!rules.has(rule.id), `重复规则 ID：${rule.id}`);
    requireThat(!prefixes.has(rule.hash.slice(0, 12)), '短指纹发生冲突，需要迁移指纹长度');
    rules.set(rule.id, rule);
    prefixes.add(rule.hash.slice(0, 12));
  }
  assertAcyclic(rules, 'depends_on');
  assertAcyclic(rules, 'replaced_by');
  const index = {
    schema_version: 1, ruleset: RULESET,
    rules: list.map(({ id, title, summary, tags, level, status, depends_on, replaced_by, hash, path: file }) => ({ id, title, summary, tags, level, status, depends_on, replaced_by, hash, path: file })),
  };
  if (verifyIndex) requireThat(canonical(readJson(path.join(root, 'index.json'))) === canonical(index), '索引与正文不一致；维护规则后运行 index，再运行 validate');
  return { root, rules, index, hash: sha(canonical(index)) };
}

export function dependencyClosure(library, ids) {
  const result = new Set();
  const visit = id => {
    requireThat(library.rules.has(id), `未知规则：${id}`);
    if (result.has(id)) return;
    result.add(id);
    library.rules.get(id).depends_on.forEach(visit);
  };
  ids.forEach(visit);
  return [...result].sort();
}

export const candidates = (library, tags) => [...library.rules.values()]
  .filter(rule => rule.status === 'active' && rule.tags.some(tag => tags.includes(tag)))
  .map(rule => rule.id);

export function query(library, { tags = [], ids = [], full = false } = {}) {
  requireThat(!(tags.length && ids.length), 'tags 和 ids 只能选一种');
  const knownTags = [...new Set([...library.rules.values()].filter(rule => rule.status === 'active').flatMap(rule => rule.tags))].sort();
  if (!tags.length && !ids.length) return { ruleset: RULESET, available_tags: knownTags };
  requireThat(tags.every(tag => knownTags.includes(tag)), `存在未知标签；可用标签：${knownTags.join(', ')}`);
  const selected = ids.length ? ids : candidates(library, tags);
  return {
    ruleset: RULESET,
    selection: ids.length ? 'explicit' : 'candidates_require_context_review',
    rules: dependencyClosure(library, selected).map(id => {
      const rule = library.rules.get(id);
      return { id, ref: `${id}@${rule.hash.slice(0, 12)}`, title: rule.title, summary: rule.summary,
        level: rule.level, status: rule.status, path: rule.path, dependency: !selected.includes(id),
        ...(full ? { snapshot: rule.snapshot } : {}) };
    }),
  };
}
