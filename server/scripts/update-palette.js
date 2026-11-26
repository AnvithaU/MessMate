const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'client', 'src');

// Map old hex colors to new CSS variable-compatible replacements
const replacements = [
  // Forest green → obsidian
  [/#0C3B2E/g, '#081C15'],
  [/#07251D/g, '#061811'],
  [/#164E3F/g, '#132F22'],
  // Sage → olive
  [/#6D9773/g, '#52796F'],
  [/#8EB494/g, '#6B9C90'],
  [/#527557/g, '#3D5C55'],
  // Amber → gold
  [/#B46617/g, '#C5A059'],
  [/#D47E24/g, '#D4AF37'],
  [/#8C4D0F/g, '#A07D3A'],
  // Cream → alabaster
  [/#F5F1E8/g, '#FAF8F5'],
  [/#FCFAF6/g, '#FDFCFA'],
  [/#E9E6DD/g, '#E8E3D9'],
  [/#D1CDBC/g, '#D5D0C5'],
  // Gold highlight
  [/#E8C97A/g, '#E8C97A'],  // kept same (already gold-light)
];

function walkDir(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(full));
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const files = walkDir(path.join(root, 'portals')).concat(walkDir(path.join(root, 'components')));
let totalChanged = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  
  for (const [pattern, replacement] of replacements) {
    content = content.replace(pattern, replacement);
  }
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    const name = path.relative(root, file);
    console.log(`Updated: ${name}`);
    totalChanged++;
  }
}

console.log(`\nDone. ${totalChanged} files updated.`);
