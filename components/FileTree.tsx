import React, { useState, useMemo } from 'react';
import { FolderIcon, FileIcon, ChevronRightIcon, EyeIcon, AtSymbolIcon } from './icons';

interface FileTreeProps {
  paths: string[];
  onFileSelect: (path: string) => void;
  onFileView?: (path: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  children?: { [key: string]: TreeNode };
}

// Helper function to build a tree structure from a flat list of paths
const buildTree = (paths: string[]): TreeNode => {
  const root: TreeNode = { name: 'root', path: '' };
  paths.forEach(path => {
    let currentNode = root;
    const parts = path.split('/');
    parts.forEach((part, index) => {
      if (!currentNode.children) {
        currentNode.children = {};
      }
      if (!currentNode.children[part]) {
        currentNode.children[part] = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
        };
      }
      currentNode = currentNode.children[part];
    });
  });
  return root;
};

const TreeNodeComponent: React.FC<{ node: TreeNode; onFileSelect: (path: string) => void; onFileView?: (path: string) => void; level: number }> = ({ node, onFileSelect, onFileView, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const isFolder = !!node.children;

  // Satıra tıklama sadece klasör aç/kapa yapar
  const handleRowClick = () => {
    if (isFolder) setIsOpen(!isOpen);
  };

  const handleToggleChevron = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) setIsOpen(!isOpen);
  };

  const handleAddReference = (e: React.MouseEvent) => {
    e.stopPropagation();
    const refPath = isFolder ? `${node.path}/` : node.path;
    onFileSelect(refPath);
  };

  const handleViewFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isFolder) onFileView?.(node.path);
  };

  const sortedChildren = isFolder ? Object.values(node.children!).sort((a, b) => {
    const aIsFolder = !!a.children;
    const bIsFolder = !!b.children;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  }) : [];

  return (
    <div>
      <div
        onClick={handleRowClick}
        className="group flex items-center justify-between p-1 rounded-md hover:bg-surface-light cursor-pointer text-sm"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        <div className="flex items-center min-w-0">
          {isFolder ? (
            <span onClick={handleToggleChevron}>
              <ChevronRightIcon className={`w-4 h-4 mr-1 text-secondary/70 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
            </span>
          ) : (
            <span className="w-4 h-4 mr-1 opacity-0" />
          )}
          {isFolder ? <FolderIcon className="w-4 h-4 mr-2 text-cyan-400" /> : <FileIcon className="w-4 h-4 mr-2 text-secondary" />}
          <span className="truncate text-secondary" title={node.path}>{node.name}</span>
        </div>

        <div className="flex items-center flex-shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFolder && (
            <button onClick={handleViewFile} className="p-1 text-secondary hover:text-primary" aria-label="Dosyayı Görüntüle">
              <EyeIcon className="w-4 h-4" />
            </button>
          )}
          <button onClick={handleAddReference} className="p-1 text-secondary hover:text-primary" aria-label="Referans Ekle">
            <AtSymbolIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isFolder && isOpen && (
        <div>
          {sortedChildren.map(child => (
            <TreeNodeComponent key={child.path} node={child} onFileSelect={onFileSelect} onFileView={onFileView} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = ({ paths, onFileSelect, onFileView }) => {
  const tree = useMemo(() => buildTree(paths), [paths]);
  const sortedRootChildren = Object.values(tree.children || {}).sort((a, b) => {
    const aIsFolder = !!a.children;
    const bIsFolder = !!b.children;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      {sortedRootChildren.map(node => (
        <TreeNodeComponent key={node.path} node={node} onFileSelect={onFileSelect} onFileView={onFileView} level={0} />
      ))}
    </div>
  );
};

export default FileTree;