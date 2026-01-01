import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

// Read version from manifest.json
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const version = manifest.version;

const distDir = 'dist';
const releaseDir = 'releases';
const zipName = `quartermaster-v${version}.zip`;

console.log('======================================');
console.log('Creating BRAT-Compatible Release');
console.log('======================================');
console.log(`Version: ${version}`);
console.log('');

// Check if dist folder exists
if (!fs.existsSync(distDir)) {
    console.error('ERROR: dist folder not found!');
    console.error('Please run "npm run build" first.');
    process.exit(1);
}

// Create releases directory if it doesn't exist
if (!fs.existsSync(releaseDir)) {
    fs.mkdirSync(releaseDir, { recursive: true });
}

const output = createWriteStream(path.join(releaseDir, zipName));
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

output.on('close', () => {
    const bytes = archive.pointer();
    const kb = (bytes / 1024).toFixed(2);
    console.log('');
    console.log('======================================');
    console.log('Release package created successfully!');
    console.log('======================================');
    console.log(`File: ${releaseDir}/${zipName}`);
    console.log(`Size: ${kb} KB (${bytes} bytes)`);
    console.log('');
    console.log('This package is BRAT-compatible and ready for distribution.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test the release by extracting it to a test vault');
    console.log('2. Create a GitHub release and attach this zip file');
    console.log('3. Beta testers can install via BRAT using your repo URL');
    console.log('');
});

archive.on('error', (err) => {
    throw err;
});

archive.pipe(output);

// Add files from dist directory
console.log('Adding files to release package:');
console.log(`  - main.js`);
archive.file(path.join(distDir, 'main.js'), { name: 'main.js' });

console.log(`  - manifest.json`);
archive.file(path.join(distDir, 'manifest.json'), { name: 'manifest.json' });

console.log(`  - styles.css`);
archive.file(path.join(distDir, 'styles.css'), { name: 'styles.css' });

// Add config directory
console.log(`  - config/ directory`);
archive.directory(path.join(distDir, 'config'), 'config');

// Finalize the archive
archive.finalize();
