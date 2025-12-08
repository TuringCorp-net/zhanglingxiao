import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';

const execAsync = promisify(exec);

const ASSETS_DIR = join(process.cwd(), 'assets');
const BUCKET_NAME = 'langhua-assets';

async function getFiles(dir) {
    const dirents = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = join(dir, dirent.name);
        return dirent.isDirectory() ? getFiles(res) : res;
    }));
    return files.flat();
}

async function calculateMD5(filePath) {
    const content = await readFile(filePath);
    return createHash('md5').update(content).digest('hex');
}

async function uploadFile(filePath, relativePath, md5) {
    console.log(`⬆️  Uploading ${relativePath}...`);
    try {
        // Use single quotes and escape any single quotes in the paths
        const escapedPath = filePath.replace(/'/g, "'\\''");
        const escapedRelPath = relativePath.replace(/'/g, "'\\''");
        await execAsync(`npx wrangler r2 object put '${BUCKET_NAME}/${escapedRelPath}' --file '${escapedPath}' --remote`);
        console.log(`✅ Uploaded ${relativePath}`);
        return { path: relativePath, md5 };
    } catch (error) {
        console.error(`❌ Failed to upload ${relativePath}:`, error.message);
        process.exit(1);
    }
}

async function deleteFile(key) {
    console.log(`🗑️  Deleting ${key}...`);
    try {
        const escapedKey = key.replace(/'/g, "'\\''");
        await execAsync(`npx wrangler r2 object delete '${BUCKET_NAME}/${escapedKey}' --remote`);
        console.log(`✅ Deleted ${key}`);
    } catch (error) {
        console.error(`❌ Failed to delete ${key}:`, error.message);
    }
}

async function loadState() {
    try {
        const stateFile = join(process.cwd(), '.assets-state.json');
        const content = await readFile(stateFile, 'utf-8');
        return JSON.parse(content);
    } catch {
        return {};
    }
}

async function saveState(state) {
    const { writeFile } = await import('node:fs/promises');
    const stateFile = join(process.cwd(), '.assets-state.json');
    await writeFile(stateFile, JSON.stringify(state, null, 2));
}

async function main() {
    console.log('Starting incremental asset sync...');

    // Load previous state
    const previousState = await loadState();
    const currentState = {};

    // Get all local files
    const files = await getFiles(ASSETS_DIR);
    const localFiles = new Map();

    for (const file of files) {
        const relativePath = relative(ASSETS_DIR, file);
        // Skip hidden files
        if (relativePath.includes('.DS_Store') || relativePath.startsWith('.')) {
            continue;
        }

        const md5 = await calculateMD5(file);
        localFiles.set(relativePath, { path: file, md5 });
    }

    // Determine what to upload and what to delete
    const toUpload = [];
    const toDelete = [];

    // Check for new or modified files
    for (const [relativePath, { path, md5 }] of localFiles.entries()) {
        if (!previousState[relativePath] || previousState[relativePath] !== md5) {
            toUpload.push({ path, relativePath, md5 });
        }
        currentState[relativePath] = md5;
    }

    // Check for deleted files
    for (const relativePath of Object.keys(previousState)) {
        if (!localFiles.has(relativePath)) {
            toDelete.push(relativePath);
        }
    }

    // Report summary
    console.log(`\n📊 Sync Summary:`);
    console.log(`   New/Modified: ${toUpload.length}`);
    console.log(`   To Delete: ${toDelete.length}`);
    console.log(`   Unchanged: ${localFiles.size - toUpload.length}\n`);

    // Upload new or modified files
    for (const { path, relativePath, md5 } of toUpload) {
        await uploadFile(path, relativePath, md5);
    }

    // Delete removed files
    for (const key of toDelete) {
        await deleteFile(key);
    }

    // Save current state
    await saveState(currentState);

    if (toUpload.length === 0 && toDelete.length === 0) {
        console.log('✨ All assets are up to date!');
    } else {
        console.log('\n✨ Asset sync complete!');
    }
}

main();
