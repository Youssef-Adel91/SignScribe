// Graphics extracted from the Figma file; one file per Figma node id (e.g. node 2:6 -> n2-6.svg).
const files = import.meta.glob('../assets/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export function assetUrl(nodeId: string): string {
  const url = files[`../assets/n${nodeId.replace(':', '-')}.svg`];
  if (!url) throw new Error(`Missing asset for Figma node ${nodeId}`);
  return url;
}
