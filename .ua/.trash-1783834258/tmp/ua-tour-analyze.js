const fs = require('fs');
const path = require('path');

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-tour-analyze.js <input.json> <output.json>');
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const nodes = raw.nodes || [];
  const edges = raw.edges || [];
  const layers = raw.layers || [];

  const nodeById = new Map(nodes.map(n => [n.id, n]));

  // Fan-in / Fan-out
  const fanIn = new Map();
  const fanOut = new Map();
  for (const n of nodes) { fanIn.set(n.id, 0); fanOut.set(n.id, 0); }
  const outEdgesByType = new Map(); // nodeId -> list of {target, type}
  for (const n of nodes) outEdgesByType.set(n.id, []);
  for (const e of edges) {
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue;
    fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
    fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
    outEdgesByType.get(e.source).push({ target: e.target, type: e.type });
  }

  const fanInRanking = nodes.map(n => ({ id: n.id, fanIn: fanIn.get(n.id) || 0, name: n.name }))
    .sort((a, b) => b.fanIn - a.fanIn).slice(0, 20);
  const fanOutRanking = nodes.map(n => ({ id: n.id, fanOut: fanOut.get(n.id) || 0, name: n.name }))
    .sort((a, b) => b.fanOut - a.fanOut).slice(0, 20);

  // Entry point candidates
  const entryFilenames = new Set(['index.ts','index.js','main.ts','main.js','app.ts','app.js','server.ts','server.js',
    'mod.rs','main.go','main.py','main.rs','manage.py','app.py','wsgi.py','asgi.py','run.py','__main__.py',
    'Application.java','Main.java','Program.cs','config.ru','index.php','App.swift','Application.kt','main.cpp','main.c']);

  const fanOutVals = fanOutRanking.map(x => x.fanOut).sort((a,b)=>b-a);
  const fanOutTop10Threshold = fanOutVals.length ? fanOutVals[Math.max(0, Math.floor(fanOutVals.length * 0.1) - 1)] : 0;
  const fanInVals = nodes.map(n => fanIn.get(n.id) || 0).sort((a,b)=>a-b);
  const fanInBottom25Threshold = fanInVals.length ? fanInVals[Math.floor(fanInVals.length * 0.25)] : 0;

  const entryCandidates = [];
  for (const n of nodes) {
    let score = 0;
    const fp = n.filePath || '';
    const base = path.basename(fp || n.name || '');
    if (n.type === 'document') {
      const isRoot = fp && !fp.includes('/') && !fp.includes('\\');
      if (base.toLowerCase() === 'readme.md' && isRoot) score += 5;
      else if (base.toLowerCase().endsWith('.md') && isRoot) score += 2;
    } else if (n.type === 'file') {
      if (entryFilenames.has(base)) score += 3;
      const depth = fp ? fp.split(/[\\\/]/).length : 99;
      if (depth <= 2) score += 1;
      const fo = fanOut.get(n.id) || 0;
      if (fo >= fanOutTop10Threshold && fo > 0) score += 1;
      const fi = fanIn.get(n.id) || 0;
      if (fi <= fanInBottom25Threshold) score += 1;
    }
    if (score > 0) entryCandidates.push({ id: n.id, score, name: n.name, summary: n.summary });
  }
  entryCandidates.sort((a, b) => b.score - a.score);
  const entryPointCandidates = entryCandidates.slice(0, 5);

  // BFS from top code entry point
  const topCodeEntry = entryCandidates.find(c => {
    const n = nodeById.get(c.id);
    return n && n.type !== 'document';
  });
  const startNode = topCodeEntry ? topCodeEntry.id : (nodes.find(n => n.type === 'file') || {}).id;

  const bfsOrder = [];
  const depthMap = {};
  const byDepth = {};
  if (startNode) {
    const visited = new Set([startNode]);
    const queue = [[startNode, 0]];
    while (queue.length) {
      const [cur, depth] = queue.shift();
      bfsOrder.push(cur);
      depthMap[cur] = depth;
      byDepth[depth] = byDepth[depth] || [];
      byDepth[depth].push(cur);
      const outs = outEdgesByType.get(cur) || [];
      for (const { target, type } of outs) {
        if ((type === 'imports' || type === 'calls') && !visited.has(target)) {
          visited.add(target);
          queue.push([target, depth + 1]);
        }
      }
    }
  }

  // Non-code file inventory
  const nonCodeFiles = { documentation: [], infrastructure: [], data: [], config: [] };
  for (const n of nodes) {
    const entry = { id: n.id, name: n.name, summary: n.summary };
    if (n.type === 'document') nonCodeFiles.documentation.push({ ...entry, type: n.type });
    else if (['service', 'pipeline', 'resource'].includes(n.type)) nonCodeFiles.infrastructure.push({ ...entry, type: n.type });
    else if (['table', 'schema', 'endpoint'].includes(n.type)) nonCodeFiles.data.push({ ...entry, type: n.type });
    else if (n.type === 'config') nonCodeFiles.config.push({ ...entry, type: n.type });
  }

  // Tightly coupled clusters
  const edgeSet = new Set(edges.map(e => `${e.source}=>${e.target}:${e.type}`));
  const adjacency = new Map(nodes.map(n => [n.id, new Set()]));
  const pairEdgeCount = new Map();
  for (const e of edges) {
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue;
    adjacency.get(e.source).add(e.target);
    const key = [e.source, e.target].sort().join('||');
    pairEdgeCount.set(key, (pairEdgeCount.get(key) || 0) + 1);
  }

  const bidirectionalPairs = [];
  for (const e of edges) {
    if (e.type !== 'imports' && e.type !== 'calls') continue;
    const rev = `${e.target}=>${e.source}:${e.type}`;
    if (edgeSet.has(rev) && e.source !== e.target) {
      bidirectionalPairs.push([e.source, e.target].sort());
    }
  }
  const seenPairs = new Set();
  const initialClusters = [];
  for (const [a, b] of bidirectionalPairs) {
    const key = `${a}||${b}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    initialClusters.push(new Set([a, b]));
  }

  // Merge overlapping clusters
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < initialClusters.length; i++) {
      for (let j = i + 1; j < initialClusters.length; j++) {
        const a = initialClusters[i], b = initialClusters[j];
        if (a === b) continue;
        let overlap = false;
        for (const x of a) if (b.has(x)) { overlap = true; break; }
        if (overlap && (a.size + b.size) <= 8) {
          for (const x of b) a.add(x);
          initialClusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  // Expand clusters by adding nodes connecting to 2+ members, cap at 5
  const clusters = [];
  for (const clusterSet of initialClusters) {
    let cluster = new Set(clusterSet);
    let changed = true;
    while (changed && cluster.size < 5) {
      changed = false;
      for (const n of nodes) {
        if (cluster.has(n.id)) continue;
        let connections = 0;
        for (const m of cluster) {
          if (adjacency.get(n.id) && adjacency.get(n.id).has(m)) connections++;
          if (adjacency.get(m) && adjacency.get(m).has(n.id)) connections++;
        }
        if (connections >= 2) {
          cluster.add(n.id);
          changed = true;
          if (cluster.size >= 5) break;
        }
      }
    }
    const nodeIds = Array.from(cluster).slice(0, 5);
    let edgeCount = 0;
    for (const e of edges) {
      if (nodeIds.includes(e.source) && nodeIds.includes(e.target)) edgeCount++;
    }
    clusters.push({ nodes: nodeIds, edgeCount });
  }
  clusters.sort((a, b) => b.edgeCount - a.edgeCount);
  const topClusters = clusters.slice(0, 10);

  // Layers
  const layerOutput = { count: layers.length, list: layers.map(l => ({ id: l.id, name: l.name, description: l.description })) };

  // Node summary index
  const nodeSummaryIndex = {};
  for (const n of nodes) {
    nodeSummaryIndex[n.id] = { name: n.name, type: n.type, summary: n.summary };
  }

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: { startNode, order: bfsOrder, depthMap, byDepth },
    nonCodeFiles,
    clusters: topClusters,
    layers: layerOutput,
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log('Analysis complete.');
}

try {
  main();
} catch (err) {
  console.error(err.stack || String(err));
  process.exit(1);
}
