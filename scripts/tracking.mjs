import fs from 'node:fs';
import path from 'node:path';
import { RULESET, ID, HASH, atomicWrite, canonical, candidates, dependencyClosure, fields, loadLibrary,
  nonempty, normalize, object, readJson, readText, requireThat, sha, snapshotHash, strings } from './library.mjs';

export const DOCUMENT = 'design/uiux-design.md';
export const ADOPTION = 'design/uiux-adoption.json';
const DECISION = /^D-[a-zA-Z0-9-]+$/;
const REF = /^(UXR-\d{4})@([a-f0-9]{12})$/;
const DISPOSITIONS = ['applied', 'not_applicable', 'exception'];

export function projectFile(root, relative) {
  root = fs.realpathSync(root);
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    if (fs.existsSync(target)) requireThat(!fs.lstatSync(target).isSymbolicLink(), `项目文件路径不支持符号链接：${target}`);
  }
  return target;
}

export function parseDocument(text) {
  text = normalize(text);
  const entries = new Map();
  const pattern = /^<!-- uiux:decision (\{[^\n]*\}) -->\n([\s\S]*?)^<!-- \/uiux:decision -->$/gm;
  let count = 0;
  for (const match of text.matchAll(pattern)) {
    count++;
    const meta = JSON.parse(match[1]);
    fields(meta, ['id', 'tags', 'refs', 'local']);
    requireThat(DECISION.test(meta.id) && !entries.has(meta.id), `设计条目 ID 无效或重复：${meta.id}`);
    requireThat(strings(meta.tags) && meta.tags.every(tag => /^[a-z][a-z0-9-]*$/.test(tag)), `${meta.id} 标签无效`);
    requireThat(strings(meta.refs) && meta.refs.every(ref => REF.test(ref)), `${meta.id} 引用必须含 12 位短指纹`);
    const ids = meta.refs.map(ref => ref.split('@')[0]);
    requireThat(new Set(ids).size === ids.length, `${meta.id} 重复引用同一规则`);
    requireThat(typeof meta.local === 'boolean' && (meta.local ? meta.refs.length === 0 : meta.refs.length > 0), `${meta.id} 本地规则与公共引用不能混用`);
    requireThat(meta.local || meta.tags.length > 0, `${meta.id} 公共规则条目必须有场景标签`);
    requireThat(nonempty(match[2]) && !match[2].includes('<!-- uiux:'), `${meta.id} 正文为空或嵌套了标记`);
    entries.set(meta.id, { ...meta, body: normalize(match[2]), hash: sha(canonical({ ...meta, body: normalize(match[2]) })) });
  }
  requireThat(count === (text.match(/<!-- uiux:decision/g) || []).length && count === (text.match(/<!-- \/uiux:decision/g) || []).length, '设计文档有不完整或错误格式的条目标记');
  const outside = text.replace(pattern, '');
  requireThat(!/^## /m.test(outside), '设计文档的二级条目必须放在 uiux:decision 标记内');
  return entries;
}

function validateRuleRecord(id, record) {
  fields(record, ['hash', 'snapshot', 'disposition', 'reason', 'approval']);
  requireThat(HASH.test(record.hash) && record.hash === snapshotHash(record.snapshot), `${id} 旧快照损坏`);
  requireThat(record.snapshot.metadata.id === id && ID.test(id), `${id} 快照身份不匹配`);
  requireThat(DISPOSITIONS.includes(record.disposition) && nonempty(record.reason), `${id} 复核结论或理由缺失`);
  requireThat(typeof record.approval === 'string' && (record.disposition !== 'exception' || nonempty(record.approval)), `${id} 例外缺少用户决定依据`);
}

function validateAdoption(adoption) {
  fields(adoption, ['schema_version', 'ruleset', 'decisions', 'removed_decisions']);
  requireThat(adoption.schema_version === 1 && adoption.ruleset === RULESET, '采纳记录 schema 或规则库身份不匹配');
  requireThat(object(adoption.decisions) && object(adoption.removed_decisions), '采纳条目格式无效');
  for (const [id, record] of Object.entries(adoption.decisions)) {
    requireThat(DECISION.test(id), '采纳条目 ID 无效');
    fields(record, ['document_hash', 'rules', 'retired_rules', 'rationale', 'implementation', 'reviewed_at']);
    requireThat(HASH.test(record.document_hash) && object(record.rules) && object(record.retired_rules) && nonempty(record.rationale), `${id} 采纳记录无效`);
    requireThat(nonempty(record.reviewed_at) && Number.isFinite(Date.parse(record.reviewed_at)), `${id} 复核时间无效`);
    validateImplementation(record.implementation);
    for (const [ruleId, rule] of Object.entries(record.rules)) validateRuleRecord(ruleId, rule);
    for (const [ruleId, retired] of Object.entries(record.retired_rules)) {
      fields(retired, ['record', 'reason']);
      requireThat(nonempty(retired.reason) && !Object.hasOwn(record.rules, ruleId), `${ruleId} 退出记录无效`);
      validateRuleRecord(ruleId, retired.record);
    }
  }
  for (const [id, reason] of Object.entries(adoption.removed_decisions)) {
    requireThat(DECISION.test(id) && nonempty(reason) && !Object.hasOwn(adoption.decisions, id), '已删除条目记录无效');
  }
}

function validateImplementation(value) {
  fields(value, ['status', 'evidence']);
  requireThat(['unverified', 'verified'].includes(value.status) && typeof value.evidence === 'string', '实现验证状态无效');
  requireThat(value.status !== 'verified' || nonempty(value.evidence), '已验证状态需要实际证据');
}

export function inspectProject(library, root) {
  const documentPath = projectFile(root, DOCUMENT);
  const adoptionPath = projectFile(root, ADOPTION);
  const documentText = fs.existsSync(documentPath) ? readText(documentPath) : null;
  const adoptionText = fs.existsSync(adoptionPath) ? readText(adoptionPath) : null;
  requireThat(documentText !== null || adoptionText === null, '采纳记录存在，但设计文档缺失');
  const entries = documentText === null ? new Map() : parseDocument(documentText);
  const adoption = adoptionText === null ? { schema_version: 1, ruleset: RULESET, decisions: {}, removed_decisions: {} } : JSON.parse(adoptionText);
  validateAdoption(adoption);
  const state = sha(canonical({ library: library.hash, document: documentText, adoption: adoptionText }));
  return { entries, adoption, state, documentPath, adoptionPath, documentText };
}

function scopedRules(library, entry) {
  const roots = new Set(candidates(library, entry.tags));
  for (const ref of entry.refs) if (library.rules.has(ref.split('@')[0])) roots.add(ref.split('@')[0]);
  return dependencyClosure(library, [...roots]);
}

export function checkProject(library, root) {
  const project = inspectProject(library, root);
  const findings = [];
  const add = (kind, decision, rule, extra = {}) => findings.push({ kind, decision, ...(rule ? { rule } : {}), ...extra });
  if (project.documentText === null) return { ruleset: RULESET, state: project.state, status: 'untracked', findings: [] };
  if (project.entries.size === 0) add('empty_document', null);
  const knownTags = new Set([...library.rules.values()].flatMap(rule => rule.tags));
  for (const [id, entry] of project.entries) {
    const previous = project.adoption.decisions[id];
    for (const tag of entry.tags) if (!knownTags.has(tag)) add('unknown_tag', id, null, { tag });
    if (!previous) add('unreviewed_decision', id);
    else if (previous.document_hash !== entry.hash) add('design_changed', id);
    for (const ref of entry.refs) {
      const [ruleId, prefix] = ref.split('@');
      const rule = library.rules.get(ruleId);
      if (!rule) { add('unknown_rule', id, ruleId); continue; }
      if (rule.hash.slice(0, 12) !== prefix) add('reference_mismatch', id, ruleId, { current_ref: `${ruleId}@${rule.hash.slice(0, 12)}` });
      if (rule.status !== 'active') add('deprecated_rule', id, ruleId, { replaced_by: rule.replaced_by });
      const record = previous?.rules[ruleId];
      if (record && record.disposition === 'not_applicable') add('reference_disposition_conflict', id, ruleId);
      for (const dependency of dependencyClosure(library, [ruleId])) {
        if (!entry.refs.some(item => item.startsWith(`${dependency}@`))) add('dependency_not_referenced', id, dependency);
      }
    }
    const scoped = scopedRules(library, entry);
    for (const ruleId of scoped) {
      if (!previous?.rules[ruleId]) add('candidate_unreviewed', id, ruleId);
    }
    for (const [ruleId, record] of Object.entries(previous?.rules || {})) {
      const rule = library.rules.get(ruleId);
      if (!rule) add('rule_missing', id, ruleId);
      else {
        if (rule.hash !== record.hash) add('rule_changed', id, ruleId, { previous_hash: record.hash, current_hash: rule.hash });
        if (rule.status !== 'active') add('deprecated_rule', id, ruleId, { replaced_by: rule.replaced_by });
      }
      if (!scoped.includes(ruleId)) add('rule_left_scope', id, ruleId);
      if (record.disposition !== 'not_applicable' && !entry.refs.some(ref => ref.startsWith(`${ruleId}@`))) add('adopted_reference_removed', id, ruleId);
    }
  }
  for (const id of Object.keys(project.adoption.decisions)) if (!project.entries.has(id)) add('removed_decision', id);
  const unique = [...new Map(findings.map(finding => [canonical(finding), finding])).values()];
  return { ruleset: RULESET, state: project.state, status: unique.length ? 'review_required' : 'current',
    decisions: project.entries.size, findings: unique,
    implementation: Object.fromEntries(Object.entries(project.adoption.decisions).map(([id, record]) => [id, record.implementation])) };
}

export function prepareReview(library, root, id) {
  const project = inspectProject(library, root);
  const entry = project.entries.get(id);
  const previous = project.adoption.decisions[id];
  requireThat(entry || previous, `找不到条目：${id}`);
  const result = { schema_version: 1, ruleset: RULESET, expected_state: project.state, decisions: {}, remove_decisions: {} };
  if (!entry) { result.remove_decisions[id] = ''; return result; }
  const scoped = scopedRules(library, entry).filter(ruleId => library.rules.get(ruleId).status === 'active');
  result.decisions[id] = {
    rationale: '', implementation: { status: 'unverified', evidence: '' },
    rules: Object.fromEntries(scoped.map(ruleId => [ruleId, { disposition: 'pending', reason: '', approval: '' }])),
    retire_rules: Object.fromEntries(Object.keys(previous?.rules || {}).filter(ruleId => !scoped.includes(ruleId)).map(ruleId => [ruleId, ''])),
  };
  return result;
}

export function recordReview(library, root, review) {
  fields(review, ['schema_version', 'ruleset', 'expected_state', 'decisions', 'remove_decisions']);
  requireThat(review.schema_version === 1 && review.ruleset === RULESET && HASH.test(review.expected_state), '复核请求格式无效');
  requireThat(object(review.decisions) && object(review.remove_decisions) && Object.keys(review.decisions).length + Object.keys(review.remove_decisions).length > 0, '需要明确复核或移除的条目');
  const project = inspectProject(library, root);
  requireThat(project.documentText !== null, '请先编写设计文档');
  requireThat(project.state === review.expected_state, '检查后状态已变化，请重新检查和复核');
  const next = structuredClone(project.adoption);
  for (const [id, input] of Object.entries(review.decisions)) {
    const entry = project.entries.get(id);
    requireThat(entry && !Object.hasOwn(review.remove_decisions, id), `条目不存在或同时要求删除：${id}`);
    fields(input, ['rationale', 'implementation', 'rules', 'retire_rules']);
    requireThat(nonempty(input.rationale) && object(input.rules) && object(input.retire_rules), `${id} 缺少复核理由或规则结论`);
    validateImplementation(input.implementation);
    const knownTags = new Set([...library.rules.values()].flatMap(rule => rule.tags));
    requireThat(entry.tags.every(tag => knownTags.has(tag)), `${id} 有未知标签，先选择已维护的场景标签`);
    const scoped = scopedRules(library, entry).filter(ruleId => library.rules.get(ruleId).status === 'active');
    requireThat(canonical(Object.keys(input.rules).sort()) === canonical(scoped.sort()), `${id} 必须逐项处理全部候选规则和依赖`);
    const rules = {};
    for (const ruleId of scoped) {
      const rule = library.rules.get(ruleId);
      const item = input.rules[ruleId];
      fields(item, ['disposition', 'reason', 'approval']);
      const record = { hash: rule.hash, snapshot: rule.snapshot, ...item };
      validateRuleRecord(ruleId, record);
      const referenced = entry.refs.includes(`${ruleId}@${rule.hash.slice(0, 12)}`);
      requireThat(referenced === (item.disposition !== 'not_applicable'), `${id} 的 ${ruleId} 引用与复核结论不一致`);
      rules[ruleId] = record;
    }
    for (const ref of entry.refs) {
      const [ruleId, prefix] = ref.split('@');
      const rule = library.rules.get(ruleId);
      requireThat(rule?.status === 'active' && rule.hash.slice(0, 12) === prefix, `${id} 仍有未知、废弃或旧指纹引用：${ref}`);
      requireThat(dependencyClosure(library, [ruleId]).every(dep => entry.refs.some(value => value.startsWith(`${dep}@`))), `${id} 未引用必要依赖`);
    }
    const previous = next.decisions[id];
    const dropped = Object.keys(previous?.rules || {}).filter(ruleId => !Object.hasOwn(rules, ruleId)).sort();
    requireThat(canonical(Object.keys(input.retire_rules).sort()) === canonical(dropped), `${id} 必须说明退出范围的每条旧规则`);
    const retired = { ...(previous?.retired_rules || {}) };
    for (const ruleId of dropped) {
      requireThat(nonempty(input.retire_rules[ruleId]), `${ruleId} 缺少退出理由`);
      retired[ruleId] = { record: previous.rules[ruleId], reason: input.retire_rules[ruleId] };
    }
    for (const ruleId of Object.keys(rules)) delete retired[ruleId];
    next.decisions[id] = { document_hash: entry.hash, rules, retired_rules: retired, rationale: input.rationale,
      implementation: input.implementation, reviewed_at: new Date().toISOString() };
    delete next.removed_decisions[id];
  }
  for (const [id, reason] of Object.entries(review.remove_decisions)) {
    requireThat(Object.hasOwn(next.decisions, id) && !project.entries.has(id) && nonempty(reason), `${id} 不能移除：仍在文档内、没有旧记录或缺少理由`);
    delete next.decisions[id];
    next.removed_decisions[id] = reason;
  }
  validateAdoption(next);
  const lockPath = `${project.adoptionPath}.write-lock`;
  let lock;
  try {
    lock = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, expected_state: review.expected_state }));
    const assertUnchanged = () => requireThat(inspectProject(loadLibrary(library.root), root).state === review.expected_state, '写入前状态已变化，拒绝覆盖');
    assertUnchanged();
    atomicWrite(project.adoptionPath, JSON.stringify(next, null, 2) + '\n', assertUnchanged);
  } finally {
    if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(lockPath); }
  }
  return checkProject(loadLibrary(library.root), root);
}

export function ruleDiff(library, root, decision, ruleId) {
  const record = inspectProject(library, root).adoption.decisions[decision];
  const previous = record?.rules[ruleId] || record?.retired_rules[ruleId]?.record;
  const current = library.rules.get(ruleId);
  requireThat(previous || current, '找不到规则版本');
  return { decision, rule: ruleId, previous: previous?.snapshot || null, current: current?.snapshot || null };
}
