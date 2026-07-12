const fs = require('fs');
const path = require('path');

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const { fileNodes, importEdges, allEdges } = raw;

  const nodeById = new Map(fileNodes.map(n => [n.id, n]));

  // A. Directory grouping
  function normPath(p) {
    return (p || '').replace(/\\/g, '/');
  }
  const paths = fileNodes.map(n => normPath(n.filePath || n.name || ''));

  function commonPrefix(strs) {
    if (strs.length === 0) return '';
    let prefix = strs[0];
    for (const s of strs.slice(1)) {
      let i = 0;
      while (i < prefix.length && i < s.length && prefix[i] === s[i]) i++;
      prefix = prefix.slice(0, i);
    }
    // trim to last '/'
    const idx = prefix.lastIndexOf('/');
    return idx >= 0 ? prefix.slice(0, idx + 1) : '';
  }

  const prefix = commonPrefix(paths);

  function groupForPath(p) {
    let rest = p.startsWith(prefix) ? p.slice(prefix.length) : p;
    const parts = rest.split('/').filter(Boolean);
    if (parts.length <= 1) {
      // flat - group by extension/pattern
      const base = parts[0] || rest;
      if (/\.test\.|\.spec\.|^test_|_test\.go$|Test\.java$|_spec\.rb$|Test\.php$|Tests\.cs$/.test(base)) return 'test';
      if (/\.config\./.test(base)) return 'config';
      const extMatch = base.match(/\.([a-zA-Z0-9]+)$/);
      return extMatch ? extMatch[1] : 'root';
    }
    return parts[0];
  }

  const directoryGroups = {};
  fileNodes.forEach((n, i) => {
    const grp = groupForPath(paths[i]);
    if (!directoryGroups[grp]) directoryGroups[grp] = [];
    directoryGroups[grp].push(n.id);
  });

  // B. Node type grouping
  const nodeTypeGroups = {};
  fileNodes.forEach(n => {
    if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
    nodeTypeGroups[n.type].push(n.id);
  });

  // C. Import adjacency
  const fanOut = {};
  const fanIn = {};
  const adjacency = {};
  importEdges.forEach(e => {
    fanOut[e.source] = (fanOut[e.source] || 0) + 1;
    fanIn[e.target] = (fanIn[e.target] || 0) + 1;
    if (!adjacency[e.source]) adjacency[e.source] = new Set();
    adjacency[e.source].add(e.target);
  });

  // group lookup
  const groupOfId = {};
  Object.entries(directoryGroups).forEach(([g, ids]) => {
    ids.forEach(id => { groupOfId[id] = g; });
  });

  // D. Cross-category dependency analysis
  const crossCategoryMap = new Map();
  allEdges.forEach(e => {
    const s = nodeById.get(e.source);
    const t = nodeById.get(e.target);
    if (!s || !t) return;
    if (s.type === t.type) return; // only cross-category
    const key = `${s.type}|${t.type}|${e.type}`;
    crossCategoryMap.set(key, (crossCategoryMap.get(key) || 0) + 1);
  });
  const crossCategoryEdges = Array.from(crossCategoryMap.entries()).map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('|');
    return { fromType, toType, edgeType, count };
  });

  // E. Inter-group import frequency
  const interGroupMap = new Map();
  importEdges.forEach(e => {
    const gs = groupOfId[e.source];
    const gt = groupOfId[e.target];
    if (!gs || !gt || gs === gt) return;
    const key = `${gs}|${gt}`;
    interGroupMap.set(key, (interGroupMap.get(key) || 0) + 1);
  });
  const interGroupImports = Array.from(interGroupMap.entries()).map(([k, count]) => {
    const [from, to] = k.split('|');
    return { from, to, count };
  }).sort((a, b) => b.count - a.count);

  // F. Intra-group density
  const intraGroupDensity = {};
  Object.keys(directoryGroups).forEach(g => {
    intraGroupDensity[g] = { internalEdges: 0, totalEdges: 0 };
  });
  importEdges.forEach(e => {
    const gs = groupOfId[e.source];
    const gt = groupOfId[e.target];
    if (gs) {
      intraGroupDensity[gs].totalEdges++;
      if (gs === gt) intraGroupDensity[gs].internalEdges++;
    }
    if (gt && gt !== gs) {
      intraGroupDensity[gt].totalEdges++;
    }
  });
  Object.keys(intraGroupDensity).forEach(g => {
    const d = intraGroupDensity[g];
    d.density = d.totalEdges > 0 ? +(d.internalEdges / d.totalEdges).toFixed(3) : 0;
  });

  // G. Directory pattern matching
  const dirPatterns = [
    [['routes', 'api', 'controllers', 'endpoints', 'handlers', 'controller', 'routers', 'blueprints', 'serializers'], 'api'],
    [['services', 'core', 'lib', 'domain', 'logic', 'signals', 'composables', 'internal', 'mailers', 'jobs', 'channels'], 'service'],
    [['models', 'db', 'data', 'persistence', 'repository', 'entities', 'migrations', 'entity', 'repositories'], 'data'],
    [['components', 'views', 'pages', 'ui', 'layouts', 'screens'], 'ui'],
    [['middleware', 'plugins', 'interceptors', 'guards'], 'middleware'],
    [['utils', 'helpers', 'common', 'shared', 'tools', 'templatetags', 'pkg'], 'utility'],
    [['config', 'constants', 'env', 'settings', 'management', 'commands'], 'config'],
    [['__tests__', 'test', 'tests', 'spec', 'specs'], 'test'],
    [['types', 'interfaces', 'schemas', 'contracts', 'dtos', 'dto', 'request', 'response'], 'types'],
    [['hooks'], 'hooks'],
    [['store', 'state', 'reducers', 'actions', 'slices'], 'state'],
    [['assets', 'static', 'public'], 'assets'],
    [['cmd'], 'entry'],
    [['bin'], 'entry'],
    [['docs', 'documentation', 'wiki'], 'documentation'],
    [['deploy', 'deployment', 'infra', 'infrastructure', 'k8s', 'kubernetes', 'helm', 'charts', 'terraform', 'tf', 'docker'], 'infrastructure'],
    [['.github', '.gitlab', '.circleci'], 'ci-cd'],
    [['sql', 'database', 'schema'], 'data'],
    [['agents', 'llm'], 'service'],
    [['context'], 'state'],
  ];
  function matchDirPattern(dirName) {
    const lower = dirName.toLowerCase();
    for (const [names, label] of dirPatterns) {
      if (names.includes(lower)) return label;
    }
    return null;
  }
  const patternMatches = {};
  Object.keys(directoryGroups).forEach(g => {
    const m = matchDirPattern(g);
    if (m) patternMatches[g] = m;
  });

  // File-level pattern overrides info (informational, not restructuring groups)
  const fileLevelPatterns = {};
  fileNodes.forEach(n => {
    const p = normPath(n.filePath || n.name || '');
    const base = path.posix.basename(p);
    if (/\.test\.|\.spec\.|^test_|_test\.go$|Test\.java$|_spec\.rb$|Test\.php$|Tests\.cs$/.test(base)) {
      fileLevelPatterns[n.id] = 'test';
    } else if (/\.d\.ts$/.test(base)) {
      fileLevelPatterns[n.id] = 'types';
    } else if (base === 'index.ts' || base === 'index.js' || base === '__init__.py') {
      fileLevelPatterns[n.id] = 'entry';
    } else if (base === 'manage.py') {
      fileLevelPatterns[n.id] = 'entry';
    } else if (base === 'wsgi.py' || base === 'asgi.py') {
      fileLevelPatterns[n.id] = 'config';
    } else if (base === 'main.go' && /cmd\//.test(p)) {
      fileLevelPatterns[n.id] = 'entry';
    } else if (base === 'main.rs' || base === 'lib.rs') {
      fileLevelPatterns[n.id] = 'entry';
    } else if (base === 'Application.java' || base === 'Program.cs') {
      fileLevelPatterns[n.id] = 'entry';
    } else if (base === 'config.ru') {
      fileLevelPatterns[n.id] = 'entry';
    } else if (['Cargo.toml', 'go.mod', 'Gemfile', 'pom.xml', 'build.gradle', 'composer.json'].includes(base)) {
      fileLevelPatterns[n.id] = 'config';
    } else if (/^Dockerfile/.test(base) || /^docker-compose/.test(base)) {
      fileLevelPatterns[n.id] = 'infrastructure';
    } else if (/\.tf$|\.tfvars$/.test(base)) {
      fileLevelPatterns[n.id] = 'infrastructure';
    } else if (/\.github\/workflows\//.test(p) || base === '.gitlab-ci.yml' || base === 'Jenkinsfile') {
      fileLevelPatterns[n.id] = 'ci-cd';
    } else if (/\.sql$/.test(base)) {
      fileLevelPatterns[n.id] = 'data';
    } else if (/\.graphql$|\.gql$|\.proto$/.test(base)) {
      fileLevelPatterns[n.id] = 'types';
    } else if (/\.md$|\.rst$/.test(base)) {
      fileLevelPatterns[n.id] = 'documentation';
    } else if (base === 'Makefile') {
      fileLevelPatterns[n.id] = 'infrastructure';
    }
  });

  // H. Deployment topology detection
  const infraFiles = [];
  let hasDockerfile = false, hasCompose = false, hasK8s = false, hasTerraform = false, hasCI = false;
  fileNodes.forEach(n => {
    const p = normPath(n.filePath || n.name || '');
    const base = path.posix.basename(p);
    if (/^Dockerfile/.test(base)) { hasDockerfile = true; infraFiles.push(p); }
    if (/^docker-compose/.test(base)) { hasCompose = true; infraFiles.push(p); }
    if (/k8s|kubernetes|helm/i.test(p)) { hasK8s = true; infraFiles.push(p); }
    if (/\.tf$|\.tfvars$|terraform/i.test(p)) { hasTerraform = true; infraFiles.push(p); }
    if (/\.github\/workflows\//.test(p) || base === '.gitlab-ci.yml' || base === 'Jenkinsfile') { hasCI = true; infraFiles.push(p); }
  });

  // I. Data pipeline detection
  const schemaFiles = [];
  const migrationFiles = [];
  const dataModelFiles = [];
  const apiHandlerFiles = [];
  fileNodes.forEach(n => {
    const p = normPath(n.filePath || n.name || '');
    if (/\.sql$/.test(p) || /schema\.(graphql|prisma)$/.test(p)) schemaFiles.push(p);
    if (/migrations?\//i.test(p)) migrationFiles.push(p);
    if (/models?\//i.test(p) || /entities\//i.test(p) || /repositories\//i.test(p)) dataModelFiles.push(p);
    if (/routes?\/|controllers?\/|api\//i.test(p)) apiHandlerFiles.push(p);
  });

  // J. Documentation coverage
  const docFiles = fileNodes.filter(n => n.type === 'document');
  const groupsWithDocsSet = new Set();
  docFiles.forEach(d => {
    const g = groupOfId[d.id];
    if (g) groupsWithDocsSet.add(g);
  });
  const totalGroups = Object.keys(directoryGroups).length;
  const groupsWithDocs = groupsWithDocsSet.size;
  const undocumentedGroups = Object.keys(directoryGroups).filter(g => !groupsWithDocsSet.has(g));

  // K. Dependency direction
  const dependencyDirection = [];
  const seenPairs = new Set();
  interGroupImports.forEach(({ from, to, count }) => {
    const reverseKey = `${to}|${from}`;
    const key = `${from}|${to}`;
    if (seenPairs.has(key) || seenPairs.has(reverseKey)) return;
    const reverseCount = interGroupMap.get(reverseKey) || 0;
    if (count > reverseCount) {
      dependencyDirection.push({ dependent: from, dependsOn: to });
    } else if (reverseCount > count) {
      dependencyDirection.push({ dependent: to, dependsOn: from });
    }
    seenPairs.add(key);
    seenPairs.add(reverseKey);
  });

  // fileStats
  const filesPerGroup = {};
  Object.entries(directoryGroups).forEach(([g, ids]) => { filesPerGroup[g] = ids.length; });
  const nodeTypeCounts = {};
  Object.entries(nodeTypeGroups).forEach(([t, ids]) => { nodeTypeCounts[t] = ids.length; });

  const result = {
    scriptCompleted: true,
    commonPrefix: prefix,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    fileLevelPatterns,
    deploymentTopology: {
      hasDockerfile, hasCompose, hasK8s, hasTerraform, hasCI,
      infraFiles: Array.from(new Set(infraFiles)),
    },
    dataPipeline: {
      schemaFiles: Array.from(new Set(schemaFiles)),
      migrationFiles: Array.from(new Set(migrationFiles)),
      dataModelFiles: Array.from(new Set(dataModelFiles)),
      apiHandlerFiles: Array.from(new Set(apiHandlerFiles)),
    },
    docCoverage: {
      groupsWithDocs,
      totalGroups,
      coverageRatio: totalGroups > 0 ? +(groupsWithDocs / totalGroups).toFixed(3) : 0,
      undocumentedGroups,
    },
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts,
    },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Analysis complete. Output written to', outputPath);
}

try {
  main();
} catch (err) {
  console.error('Fatal error:', err && err.stack ? err.stack : err);
  process.exit(1);
}
