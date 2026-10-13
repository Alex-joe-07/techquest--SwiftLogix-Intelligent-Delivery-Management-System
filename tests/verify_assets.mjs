import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('\n--- Verifying Project Files & Import Integrity ---');

const baseDir = path.resolve('src');

const requiredFiles = [
  'index.html',
  'css/main.css',
  'css/dashboard.css',
  'css/orders.css',
  'css/agents.css',
  'css/assignment.css',
  'data/orders.json',
  'data/agents.json',
  'js/app.js',
  'js/models/order.js',
  'js/models/agent.js',
  'js/services/orderService.js',
  'js/services/agentService.js',
  'js/services/assignmentService.js',
  'js/services/assignmentConfig.js',
  'js/utils/constants.js',
  'js/utils/distance.js',
  'js/utils/validation.js',
  'js/utils/storage.js',
  'js/utils/notifications.js',
  'js/pages/dashboard.js',
  'js/pages/orders.js',
  'js/pages/agents.js',
  'js/pages/assignment.js',
];

for (const rel of requiredFiles) {
  const fullPath = path.join(baseDir, rel);
  assert.ok(fs.existsSync(fullPath), `Missing file: ${rel}`);
  const stats = fs.statSync(fullPath);
  assert.ok(stats.size > 0, `File is empty: ${rel}`);
  console.log(`  ✓ ${rel} (${stats.size} bytes)`);
}

// Verify that all relative imports inside js/ files exist
function checkImportsInDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkImportsInDir(fullPath);
    } else if (entry.name.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const importMatches = content.matchAll(/from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = match[1];
        if (importPath.startsWith('.')) {
          const resolvedPath = path.resolve(dir, importPath);
          assert.ok(
            fs.existsSync(resolvedPath),
            `Broken import in ${path.relative(baseDir, fullPath)}: "${importPath}" -> ${resolvedPath}`
          );
        }
      }
    }
  }
}

checkImportsInDir(path.join(baseDir, 'js'));
console.log('  ✓ All relative JS import paths resolve cleanly');

console.log('\n========================================');
console.log('All project assets and import paths verified!');
console.log('========================================\n');
