const fs = require('fs');
const input = JSON.parse(fs.readFileSync('.ua/tmp/ua-arch-input.json', 'utf8'));
const nodes = input.fileNodes;
const layers = {
  'layer:frontend-app': [],
  'layer:frontend-config': [],
  'layer:api': [],
  'layer:service': [],
  'layer:data': [],
  'layer:backend-support': [],
  'layer:infrastructure': [],
  'layer:documentation': [],
  'layer:utility': [],
};
function norm(p) { return (p || '').replace(/\\/g, '/'); }

nodes.forEach(n => {
  const p = norm(n.filePath || n.name || '');
  const id = n.id;
  if (n.type === 'document') { layers['layer:documentation'].push(id); return; }
  if (p === '.kiro/specs/user-authentication/.config.kiro') { layers['layer:documentation'].push(id); return; }
  if (p.startsWith('client/src/')) { layers['layer:frontend-app'].push(id); return; }
  if (p.startsWith('client/')) {
    if (/Dockerfile/.test(p)) { layers['layer:infrastructure'].push(id); return; }
    layers['layer:frontend-config'].push(id); return;
  }
  if (p.startsWith('server/app/controllers/') || p === 'server/app/main.py') { layers['layer:api'].push(id); return; }
  if (p.startsWith('server/app/services/') || p.startsWith('server/app/agents/') || p.startsWith('server/app/llm/')) { layers['layer:service'].push(id); return; }
  if (p.startsWith('server/app/models/') || p.startsWith('server/app/repositories/')) { layers['layer:data'].push(id); return; }
  if (p.startsWith('server/app/middleware/') || p.startsWith('server/app/core/') || p.startsWith('server/app/async_jobs/') || p.startsWith('server/app/seed/') || p === 'server/app/__init__.py') { layers['layer:backend-support'].push(id); return; }
  if (p.startsWith('server/') && (/Dockerfile/.test(p) || p === 'server/pyproject.toml')) { layers['layer:infrastructure'].push(id); return; }
  if (/^\.github\//.test(p) || /docker-compose/.test(p) || p === '.dockerignore' || p === 'deploy.bat' || p === '.claude/settings.json' || p === '.ua/.understandignore') { layers['layer:infrastructure'].push(id); return; }
  if (p.startsWith('scripts/')) { layers['layer:utility'].push(id); return; }
  console.log('UNASSIGNED', id, p);
});

let total = 0;
Object.entries(layers).forEach(([k, v]) => { console.log(k, v.length); total += v.length; });
console.log('TOTAL', total, 'expected', nodes.length);
fs.writeFileSync('.ua/tmp/ua-arch-layers-partition.json', JSON.stringify(layers, null, 2));
