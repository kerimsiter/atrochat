/**
 * Figma API Service
 * Handles communication with Figma API to fetch design data
 */

export interface FigmaFile {
  document: FigmaDocument;
  components: Record<string, FigmaComponent>;
  componentSets: Record<string, FigmaComponentSet>;
  schemaVersion: number;
  styles: Record<string, FigmaStyle>;
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  role: string;
  editorType: string;
  linkAccess: string;
}

export interface FigmaDocument {
  id: string;
  name: string;
  type: 'DOCUMENT';
  children: FigmaNode[];
}

export interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  [key: string]: any;
}

export interface FigmaComponent {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
}

export interface FigmaComponentSet {
  key: string;
  name: string;
  description: string;
}

export interface FigmaStyle {
  key: string;
  name: string;
  description: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
}

// Yeni Arayüz: Belirli bir node istendiğinde API'den dönen yanıt için
export interface FigmaNodeResponse {
  nodes: {
    [nodeId: string]: {
      document: FigmaNode;
    } | null;
  };
}

/**
 * Parse Figma URL to extract file key and node ID
 * @param url Figma design URL
 * @returns Object with fileKey and nodeId, or null if invalid URL
 */
export function parseFigmaUrl(url: string): { fileKey: string; nodeId: string | null } | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'www.figma.com') {
      return null;
    }

    // Figma URLs are in format: https://www.figma.com/design/{fileKey}/{title}?node-id={nodeId}
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2 && (pathParts[0] === 'design' || pathParts[0] === 'file')) {
      const fileKey = pathParts[1];
      const nodeId = urlObj.searchParams.get('node-id');
      return { fileKey, nodeId };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a specific node and its children from a Figma file
 * @param fileKey Figma file key
 * @param nodeId The ID of the node to fetch
 * @param figmaToken Figma access token
 * @returns The requested FigmaNode or null
 */
export async function getFigmaNode(fileKey: string, nodeId: string, figmaToken: string): Promise<FigmaNode | null> {
  if (!figmaToken || !fileKey || !nodeId) {
    throw new Error('Figma token, file key, and node ID are required');
  }

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeId}`, {
    headers: {
      'X-Figma-Token': figmaToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error for nodes: ${response.status}`);
  }

  const data: FigmaNodeResponse = await response.json();
  return data.nodes?.[nodeId]?.document ?? null;
}

/**
 * Fetch Figma file data using the API
 * @param fileKey Figma file key
 * @param figmaToken Figma access token
 * @returns Figma file data or throws error
 */
export async function getFigmaFile(fileKey: string, figmaToken: string): Promise<FigmaFile> {
  if (!figmaToken || !fileKey) {
    throw new Error('Figma token and file key are required');
  }

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: {
      'X-Figma-Token': figmaToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Figma API error for file: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get Figma image URLs for specific nodes
 * @param fileKey Figma file key
 * @param nodeIds Array of node IDs to get images for
 * @param figmaToken Figma access token
 * @returns Object mapping node IDs to image URLs
 */
export async function getFigmaImages(
  fileKey: string,
  nodeIds: string[],
  figmaToken: string
): Promise<Record<string, string>> {
  if (!figmaToken || !fileKey || nodeIds.length === 0) {
    return {};
  }

  const params = new URLSearchParams({
    ids: nodeIds.join(','),
    format: 'png',
    scale: '1',
  });

  const response = await fetch(`https://api.figma.com/v1/images/${fileKey}?${params}`, {
    headers: {
      'X-Figma-Token': figmaToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.warn(`Failed to fetch Figma images: ${response.status}`);
    return {};
  }

  const data = await response.json();
  return data.images || {};
}

/**
 * Summarize a specific Figma node for AI context
 * @param node The FigmaNode to summarize
 * @returns A concise summary string
 */
export function summarizeFigmaNode(node: FigmaNode): string {
  const summary = [
    `# Figma Node Analysis: "${node.name}"`,
    ` - **Type**: ${node.type}`,
    ` - **ID**: ${node.id}`,
  ];

  if (node.children && node.children.length > 0) {
    summary.push(` - **Contains**: ${node.children.length} direct child layers.`);
    const childTypes = node.children.map(c => c.type).reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    summary.push(`   - Children Breakdown: ${Object.entries(childTypes).map(([type, count]) => ` ${type} (${count})`).join(', ')}`);
  }

  if (node.fills && node.fills.length > 0 && node.fills[0].color) {
    const color = node.fills[0].color;
    summary.push(` - **Background Color**: rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a.toFixed(2)})`);
  }

  if (node.characters) {
    summary.push(` - **Text Content**: "${node.characters.substring(0, 50)}${node.characters.length > 50 ? '...' : ''}"`);
  }

  return summary.join('\n');
}

/**
 * Summarize Figma file data for AI context
 * @param figmaFile Figma file data
 * @returns Summarized context string
 */
export function summarizeFigmaFile(figmaFile: FigmaFile): string {
  const { document, components, componentSets, styles } = figmaFile;

  // Count different types of nodes
  const pageCount = document.children?.length || 0;
  const componentCount = Object.keys(components).length;
  const componentSetCount = Object.keys(componentSets).length;
  const styleCount = Object.keys(styles).length;

  // Extract main colors from styles
  const colorStyles = Object.values(styles).filter(style => style.styleType === 'FILL');
  const textStyles = Object.values(styles).filter(style => style.styleType === 'TEXT');

  // Get main page names
  const pageNames = document.children?.map(page => page.name) || [];

  // Get main component names
  const componentNames = Object.values(components).slice(0, 10).map(comp => comp.name);

  const summary = [
    `# Figma Design: ${figmaFile.name}`,
    '',
    '## Overview',
    `- **Pages**: ${pageCount} (${pageNames.slice(0, 5).join(', ')}${pageNames.length > 5 ? '...' : ''})`,
    `- **Components**: ${componentCount}`,
    `- **Component Sets**: ${componentSetCount}`,
    `- **Styles**: ${styleCount} (Colors: ${colorStyles.length}, Text: ${textStyles.length})`,
    '',
    '## Main Components',
    componentNames.map(name => `- ${name}`).join('\n'),
    '',
    '## Design System',
    colorStyles.length > 0 ? `**Color Palette**: ${colorStyles.length} defined colors` : '',
    textStyles.length > 0 ? `**Typography**: ${textStyles.length} text styles` : '',
  ].filter(Boolean).join('\n');

  return summary;
}
