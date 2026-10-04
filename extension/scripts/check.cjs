const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.version,'0.1.0');
assert.deepEqual(manifest.permissions,['storage','activeTab','scripting','alarms']);
assert.deepEqual(manifest.optional_permissions,['notifications']);
assert.ok(!manifest.host_permissions.includes('<all_urls>'));
const files=[manifest.background.service_worker,manifest.action.default_popup,...Object.values(manifest.icons),...manifest.content_scripts.flatMap(s=>s.js),...manifest.web_accessible_resources.flatMap(s=>s.resources)];
files.forEach(f=>assert.ok(fs.existsSync(path.join(root,f)),`Missing ${f}`));
function walk(dir) {return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory() ? ['tests','test-results','playwright-report','node_modules'].includes(e.name) ? [] : walk(path.join(dir,e.name)) : [path.join(dir,e.name)]);}
let checked=0;
for (const file of walk(root)) {
  const text=fs.readFileSync(file,'utf8');
  if (file.endsWith('.js')) {new vm.Script(text,{filename:file});checked++;}
  if (file.endsWith('.html')) {
    assert.ok(!/\son\w+\s*=/.test(text),'Inline event handler');
    for (const match of text.matchAll(/(?:src|href)="([^"#]+)"/g)) assert.ok(fs.existsSync(path.resolve(path.dirname(file),match[1])),`Missing asset ${match[1]}`);
  }
  if (file.endsWith('.js')) assert.ok(!/(?:postgres(?:ql)?:\/\/|sk-[A-Za-z0-9]{20}|SERPAPI_API_KEY\s*[:=]|DATABASE_URL\s*[:=])/.test(text),`Possible credential in ${file}`);
}
console.log(`Manifest and packaged assets valid; ${checked} JavaScript files parse; no credential patterns found. Chrome loading is tested separately.`);
