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
    console.log(`⬆️  正在上传 ${relativePath}...`);
    try {
        // 使用单引号并转义路径中的单引号
        const escapedPath = filePath.replace(/'/g, "'\\''");
        const escapedRelPath = relativePath.replace(/'/g, "'\\''");
        await execAsync(`npx wrangler r2 object put '${BUCKET_NAME}/${escapedRelPath}' --file '${escapedPath}' --remote`);
        console.log(`✅ 上传成功 ${relativePath}`);
        return { path: relativePath, md5 };
    } catch (error) {
        console.error(`❌ 上传失败 ${relativePath}:`, error.message);
        process.exit(1);
    }
}

async function deleteFile(key) {
    console.log(`🗑️  正在删除 ${key}...`);
    try {
        const escapedKey = key.replace(/'/g, "'\\''");
        await execAsync(`npx wrangler r2 object delete '${BUCKET_NAME}/${escapedKey}' --remote`);
        console.log(`✅ 删除成功 ${key}`);
    } catch (error) {
        console.error(`❌ 删除失败 ${key}:`, error.message);
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
    console.log('开始增量资源同步...');

    // 加载之前的状态
    const previousState = await loadState();
    const currentState = {};

    // 获取所有本地文件
    const files = await getFiles(ASSETS_DIR);
    const localFiles = new Map();

    for (const file of files) {
        const relativePath = relative(ASSETS_DIR, file);
        // 跳过隐藏文件
        if (relativePath.includes('.DS_Store') || relativePath.startsWith('.')) {
            continue;
        }

        const md5 = await calculateMD5(file);
        localFiles.set(relativePath, { path: file, md5 });
    }

    // 决定上传和删除的文件
    const toUpload = [];
    const toDelete = [];

    // 检查新增或修改的文件
    for (const [relativePath, { path, md5 }] of localFiles.entries()) {
        if (!previousState[relativePath] || previousState[relativePath] !== md5) {
            toUpload.push({ path, relativePath, md5 });
        }
        currentState[relativePath] = md5;
    }

    // 检查删除的文件
    for (const relativePath of Object.keys(previousState)) {
        if (!localFiles.has(relativePath)) {
            toDelete.push(relativePath);
        }
    }

    // 报告摘要
    console.log(`\n📊 同步摘要:`);
    console.log(`   新增/修改: ${toUpload.length}`);
    console.log(`   需删除:   ${toDelete.length}`);
    console.log(`   未变更:   ${localFiles.size - toUpload.length}\n`);

    // 执行上传
    for (const { path, relativePath, md5 } of toUpload) {
        await uploadFile(path, relativePath, md5);
    }

    // 执行删除
    for (const key of toDelete) {
        await deleteFile(key);
    }

    // 保存当前状态
    await saveState(currentState);

    if (toUpload.length === 0 && toDelete.length === 0) {
        console.log('✨ 所有资源已是最新！');
    } else {
        console.log('\n✨ 资源同步完成！');
    }
}

main();
