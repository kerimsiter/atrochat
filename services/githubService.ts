import { FileContent } from '../types';

interface FetchParams {
    owner: string;
    repo: string;
    token?: string | null;
}

const fetchWithAuth = (url: string, token?: string | null) => {
    const headers: HeadersInit = {
        'Accept': 'application/vnd.github.v3+json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { headers });
};

/**
 * Converts a single gitignore pattern to a regular expression.
 * @param pattern The gitignore pattern.
 * @param basePath The directory path where the .gitignore file resides, relative to the project root.
 */
const createRegexForRule = (pattern: string, basePath: string): { regex: RegExp; isNegated: boolean } => {
  const isNegated = pattern.startsWith('!');
  if (isNegated) {
    pattern = pattern.substring(1);
  }

  // Prepend basePath to anchor the pattern correctly.
  let fullPattern = [basePath, pattern].filter(Boolean).join('/');
  if (fullPattern.startsWith('/')) fullPattern = fullPattern.substring(1);

  // Convert glob-like pattern to regex.
  let regexStr = fullPattern
    .replace(/\./g, '\\.')
    .replace(/\?/g, '.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');

  // Match the exact name, or the name as a directory prefix
  if (regexStr.endsWith('/')) {
    // It's explicitly a directory
    regexStr = `^${regexStr.slice(0, -1)}(/.*)?$`;
  } else {
    // It could be a file or a directory
    regexStr = `^${regexStr}(/.*)?$`;
  }

  return { regex: new RegExp(regexStr), isNegated };
};

/**
 * Decodes a base64 encoded string into a UTF-8 string using TextDecoder for robustness.
 */
const decodeBase64UTF8 = (base64: string): string => {
    try {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        // Use TextDecoder with 'fatal: true' to ensure it's valid UTF-8
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
        console.warn("Failed to decode base64 string as UTF-8, it might be a binary file.", e);
        return "Hata: Dosya içeriği okunamadı (muhtemelen metin dosyası değil).";
    }
}

const BINARY_EXTENSIONS = new Set([
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.ico', '.tif', '.tiff', '.svg',
    // Audio
    '.mp3', '.wav', '.ogg', '.flac', '.aac',
    // Video
    '.mp4', '.mov', '.avi', '.mkv', '.webm',
    // Archives
    '.zip', '.rar', '.7z', '.tar', '.gz',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    // Fonts
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    // Other
    '.exe', '.dll', '.so', '.dmg', '.jar', '.pyc', '.bin', '.lock'
]);

/**
 * Processes an array of items in batches with a delay between each batch.
 * @param items The array of items to process.
 * @param batchSize The size of each batch.
 * @param delay The delay in milliseconds between batches.
 * @param processFn The async function to apply to each item.
 */
async function processInBatches<T, R>(
    items: T[], 
    batchSize: number, 
    delay: number, 
    processFn: (item: T) => Promise<R>
): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchPromises = batch.map(processFn);
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        if (i + batchSize < items.length) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return results;
}


/**
 * Fetches the contents of a public GitHub repository, honoring .gitignore rules.
 * @param repoUrl The full URL of the GitHub repository.
 * @param token Optional GitHub Personal Access Token for authenticated requests.
 */
export const fetchRepoContents = async (repoUrl: string, token?: string | null): Promise<{ files: FileContent[], commitSha: string }> => {
    // 1. Parse URL to get owner and repo
    const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) throw new Error("Geçersiz GitHub depo URL'si. Format: https://github.com/owner/repo");
    const [, owner, repo] = urlMatch;

    // 2. Get default branch to find the root tree SHA
    const repoInfoResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`, token);
    if (!repoInfoResponse.ok) throw new Error(`Depo bulunamadı veya API limiti aşıldı. Status: ${repoInfoResponse.status}`);
    const repoData = await repoInfoResponse.json();
    const defaultBranch = repoData.default_branch;

    const branchInfoResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/branches/${defaultBranch}`, token);
    if(!branchInfoResponse.ok) throw new Error("Varsayılan dal bilgisi alınamadı.");
    const branchData = await branchInfoResponse.json();
    const latestCommitSha = branchData.commit.sha;
    const treeSha = branchData.commit.commit.tree.sha;
    
    // 3. Get file tree recursively
    const treeResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token);
    if (!treeResponse.ok) throw new Error("Dosya ağacı alınamadı.");
    const treeData = await treeResponse.json();

    if (treeData.truncated) {
        console.warn("Repository file tree is truncated. Some files may be missing.");
    }

    const allPaths: { path: string; sha: string, type: 'blob' | 'tree' }[] = treeData.tree;

    // 4. Find, fetch, and parse all .gitignore files
    const allRules: { regex: RegExp; isNegated: boolean }[] = [];
    const defaultIgnores = ".git\n.env\n.env.*\nnode_modules";
    defaultIgnores.split('\n').forEach(line => {
      allRules.push(createRegexForRule(line.trim(), ''));
    });
    
    const gitignoreFiles = allPaths.filter(file => file.path.split('/').pop() === '.gitignore' && file.type === 'blob');
    
    const gitignoreContents = await Promise.all(
        gitignoreFiles.map(async file => {
            const blobResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`, token);
            const blobData = await blobResponse.json();
            const content = blobData.content ? decodeBase64UTF8(blobData.content) : '';
            const basePath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';
            return { content, basePath };
        })
    );

    // Build rules, respecting precedence (deeper .gitignore files are more specific)
    gitignoreContents.sort((a, b) => a.basePath.length - b.basePath.length);
    gitignoreContents.forEach(({ content, basePath }) => {
        content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .forEach(line => {
                allRules.push(createRegexForRule(line, basePath));
            });
    });

    // 5. Filter the full file list based on the collected rules and file types
    const isPathIgnored = (path: string): boolean => {
        let ignored = false;
        for (const rule of allRules) {
            if (rule.regex.test(path)) {
                ignored = !rule.isNegated;
            }
        }
        return ignored;
    };

    const filesToFetch = allPaths.filter(file => {
        if (file.type !== 'blob') return false;
        if (isPathIgnored(file.path)) return false;
        const fileParts = file.path.split('.');
        if (fileParts.length > 1) {
            const extension = '.' + fileParts.pop()?.toLowerCase();
            if (BINARY_EXTENSIONS.has(extension)) return false;
        }
        return true;
    });

    // 6. Fetch content for the remaining files in batches to avoid rate limiting
    const fileContents: FileContent[] = await processInBatches(filesToFetch, 20, 1000, async file => {
        try {
            const blobResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/git/blobs/${file.sha}`, token);
             if (!blobResponse.ok) {
                console.error(`Failed to fetch blob for ${file.path}: ${blobResponse.status} ${blobResponse.statusText}`);
                return { path: file.path, content: `Error: İçerik alınamadı (status ${blobResponse.status}).` };
            }
            const blobData = await blobResponse.json();
            const content = blobData.content ? decodeBase64UTF8(blobData.content) : '';
            return { path: file.path, content };
        } catch (error) {
            console.error(`Exception while fetching blob for ${file.path}:`, error);
            return { path: file.path, content: "Error: İçerik alınırken istisna oluştu." };
        }
    });

    return { files: fileContents, commitSha: latestCommitSha };
};

const getLatestCommitSha = async (owner: string, repo: string, token?: string | null): Promise<string> => {
    const repoInfoResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}`, token);
    if (!repoInfoResponse.ok) throw new Error(`Depo bilgisi alınamadı: ${repoInfoResponse.status}`);
    const repoData = await repoInfoResponse.json();
    const defaultBranch = repoData.default_branch;

    const branchInfoResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/branches/${defaultBranch}`, token);
    if(!branchInfoResponse.ok) throw new Error("Varsayılan dal bilgisi alınamadı.");
    const branchData = await branchInfoResponse.json();
    return branchData.commit.sha;
};

const fetchFileContent = async (owner: string, repo: string, path: string, token?: string | null): Promise<FileContent> => {
    const response = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, token);
    if (!response.ok) {
        console.error(`Failed to fetch content for ${path}: ${response.status}`);
        return { path, content: `Hata: İçerik alınamadı (status ${response.status}).` };
    }
    const data = await response.json();
    const content = data.content ? decodeBase64UTF8(data.content) : '';
    return { path, content };
};

export const syncRepoChanges = async (repoUrl: string, baseSha: string, token?: string | null) => {
    const urlMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!urlMatch) throw new Error("Geçersiz GitHub depo URL'si.");
    const [, owner, repo] = urlMatch;

    const headSha = await getLatestCommitSha(owner, repo, token);

    if (baseSha === headSha) {
        return { hasChanges: false, newCommitSha: headSha, addedFiles: [], modifiedFiles: [], removedPaths: [] };
    }

    const compareResponse = await fetchWithAuth(`https://api.github.com/repos/${owner}/${repo}/compare/${baseSha}...${headSha}`, token);
    if (!compareResponse.ok) throw new Error(`Commit'ler karşılaştırılamadı: ${compareResponse.status}`);
    const compareData = await compareResponse.json();
    
    const addedPaths: string[] = [];
    const modifiedPaths: string[] = [];
    const removedPaths: string[] = [];

    (compareData.files || []).forEach((file: any) => {
        switch(file.status) {
            case 'added':
                addedPaths.push(file.filename);
                break;
            case 'modified':
                modifiedPaths.push(file.filename);
                break;
            case 'removed':
                removedPaths.push(file.filename);
                break;
            // 'renamed' status could be handled here as well if needed
        }
    });

    const pathsToFetch = [...addedPaths, ...modifiedPaths];

    // Note: We might want to filter these by .gitignore and binary extensions again,
    // but for simplicity, we assume the user wants to sync all changed text files.

    const fetchedFiles = await processInBatches(pathsToFetch, 10, 500, (path) => 
        fetchFileContent(owner, repo, path, token)
    );

    const addedFiles = fetchedFiles.filter(f => addedPaths.includes(f.path));
    const modifiedFiles = fetchedFiles.filter(f => modifiedPaths.includes(f.path));

    return {
        hasChanges: true,
        newCommitSha: headSha,
        addedFiles,
        modifiedFiles,
        removedPaths
    };
};