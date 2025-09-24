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

/**
 * Parse Figma URL to extract file key
 * @param url Figma design URL
 * @returns file key or null if invalid URL
 */
export function parseFigmaUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'www.figma.com') {
      return null;
    }

    // Figma URLs are in format: https://www.figma.com/design/{fileKey}/{title}?node-id={nodeId}
    const pathParts = urlObj.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 2 && pathParts[0] === 'design') {
      return pathParts[1]; // fileKey is the second part
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch Figma file data using the API
 * @param fileKey Figma file key
 * @param figmaToken Figma access token
 * @returns Figma file data or throws error
 */
export async function getFigmaFile(fileKey: string, figmaToken: string): Promise<FigmaFile> {
  if (!figmaToken) {
    throw new Error('Figma access token is required');
  }

  if (!fileKey) {
    throw new Error('Figma file key is required');
  }

  const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: {
      'X-Figma-Token': figmaToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid Figma access token');
    } else if (response.status === 403) {
      throw new Error('Access denied to Figma file');
    } else if (response.status === 404) {
      throw new Error('Figma file not found');
    } else {
      throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
    }
  }

  const data = await response.json();
  return data as FigmaFile;
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
    console.warn(`Failed to fetch Figma images: ${response.status} ${response.statusText}`);
    return {};
  }

  const data = await response.json();
  return data.images || {};
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
