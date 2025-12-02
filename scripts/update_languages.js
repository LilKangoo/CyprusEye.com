
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ROOT_DIR = path.join(__dirname, '..');
const IGNORE_DIRS = ['dist', 'node_modules', '.git', 'scripts', 'tests', 'coverage'];

function shouldProcess(filePath) {
    if (!filePath.endsWith('.html')) return false;
    const relative = path.relative(ROOT_DIR, filePath);
    if (IGNORE_DIRS.some(dir => relative.startsWith(dir + path.sep) || relative === dir)) return false;
    return true;
}

function walk(dir, callback) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filepath = path.join(dir, file);
        const stats = fs.statSync(filepath);
        if (stats.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                walk(filepath, callback);
            }
        } else {
            if (shouldProcess(filepath)) {
                callback(filepath);
            }
        }
    });
}

function commentOutTag(content, regex) {
    return content.replace(regex, (match) => {
        if (match.trim().startsWith('<!--')) return match; // Already commented
        return `<!-- ${match} -->`;
    });
}

// Regex patterns
const PATTERNS = [
    // Language pills for EL and HE
    /<button[^>]*data-language-pill="el"[^>]*>[\s\S]*?<\/button>/gi,
    /<button[^>]*data-language-pill="he"[^>]*>[\s\S]*?<\/button>/gi,
    
    // Meta og:locale:alternate for EL and HE
    /<meta[^>]*property="og:locale:alternate"[^>]*content="el_GR"[^>]*>/gi,
    /<meta[^>]*property="og:locale:alternate"[^>]*content="he_IL"[^>]*>/gi,
    
    // Link alternate for EL and HE
    /<link[^>]*rel="alternate"[^>]*hreflang="el"[^>]*>/gi,
    /<link[^>]*rel="alternate"[^>]*hreflang="he"[^>]*>/gi
];

let modifiedCount = 0;

walk(ROOT_DIR, (filePath) => {
    // console.log(`Processing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    PATTERNS.forEach(pattern => {
        content = commentOutTag(content, pattern);
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Modified ${filePath}`);
        modifiedCount++;
    }
});

console.log(`Finished. Modified ${modifiedCount} files.`);
