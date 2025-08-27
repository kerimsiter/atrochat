import React, { useState, useMemo } from 'react';
import { FolderIcon, FileIcon, ChevronRightIcon } from './icons';

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

  const handleClick = () => {
    if (isFolder) {
      // Klasör satırına tıklama: referans ekle (sonunda '/') ve aç/kapa
      onFileSelect(`${node.path}/`);
      setIsOpen(!isOpen);
    } else {
      // Dosya satırı: referans ekle + görüntüleyici aç
      onFileSelect(node.path);
      onFileView?.(node.path);
    }
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
        onClick={handleClick}
        className="flex items-center p-1 rounded-md hover:bg-surface-light cursor-pointer text-sm"
        style={{ paddingLeft: `${level * 16}px` }}
      >
        {isFolder && (
          <span onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
            <ChevronRightIcon className={`w-4 h-4 mr-1 text-secondary/70 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </span>
        )}
        {isFolder ? <FolderIcon className="w-4 h-4 mr-2 text-cyan-400" /> : <FileIcon className="w-4 h-4 mr-2 text-secondary" />}
        <span className="truncate text-secondary">{node.name}</span>
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