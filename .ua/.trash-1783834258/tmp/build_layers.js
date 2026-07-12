const fs = require('fs');
const partition = JSON.parse(fs.readFileSync('.ua/tmp/ua-arch-layers-partition.json', 'utf8'));

const meta = {
  'layer:frontend-app': {
    name: 'Frontend Application',
    description: 'The React 19 + TypeScript client UI — pages, cart/frontdoor components, UI primitives, hooks, context, and the API client that talks to the FastAPI backend.',
  },
  'layer:frontend-config': {
    name: 'Frontend Build & Tooling',
    description: 'Vite, TypeScript, Capacitor, ESLint, and Nginx configuration that builds and serves the client PWA/Android app.',
  },
  'layer:api': {
    name: 'API Layer',
    description: 'FastAPI controllers and the app entrypoint that expose HTTP endpoints for cart, catalog, orders, vision, voice, and auth.',
  },
  'layer:service': {
    name: 'Service & Agent Layer',
    description: 'Business logic services plus the LangGraph agent graph/nodes and the LLM provider abstraction (Bedrock, Gemini, Groq, mock) that power intent capture.',
  },
  'layer:data': {
    name: 'Data Layer',
    description: 'Domain models, request/response DTOs, and repository implementations (DynamoDB, cache, in-memory) that persist and shape application data.',
  },
  'layer:backend-support': {
    name: 'Backend Cross-Cutting Support',
    description: 'Middleware (PII redaction, rate limiting, telemetry), core config/logging, async job handlers, and database seeding utilities that support the backend runtime.',
  },
  'layer:infrastructure': {
    name: 'Infrastructure & Deployment',
    description: 'Dockerfiles, docker-compose services, the GitHub Actions deploy pipeline, and project-level tooling config that build, containerize, and ship the app.',
  },
  'layer:documentation': {
    name: 'Documentation & Specs',
    description: 'Project READMEs, architecture write-ups, and Kiro spec-driven-development requirement/design/task documents.',
  },
  'layer:utility': {
    name: 'Data Utility Scripts',
    description: 'Standalone Python scripts for generating, verifying, and fixing catalog/product data outside the main application runtime.',
  },
};

const layers = Object.entries(partition)
  .filter(([id, nodeIds]) => nodeIds.length > 0)
  .map(([id, nodeIds]) => ({
    id,
    name: meta[id].name,
    description: meta[id].description,
    nodeIds,
  }));

let total = 0;
layers.forEach(l => { total += l.nodeIds.length; });
console.log('layers:', layers.length, 'total nodes:', total);

fs.mkdirSync('.ua/intermediate', { recursive: true });
fs.writeFileSync('.ua/intermediate/layers.json', JSON.stringify(layers, null, 2));
console.log('written');
