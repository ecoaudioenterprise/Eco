
// Utility to convert Lat/Lon to Tile Coordinates
// Based on OpenStreetMap Wiki: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames

export const long2tile = (lon: number, zoom: number) => {
  return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
}

export const lat2tile = (lat: number, zoom: number) => {
  return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
}

export const getTileUrl = (x: number, y: number, z: number, theme: 'light' | 'dark' | 'satellite' = 'light') => {
  if (theme === 'satellite') {
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  }
  const subdomain = ['a', 'b', 'c', 'd'][Math.floor(Math.random() * 4)];
  const type = theme === 'light' ? 'voyager' : 'dark_all';
  return `https://${subdomain}.basemaps.cartocdn.com/rastertiles/${type}/${z}/${x}/${y}@2x.png`;
}

export const downloadTilesInBounds = async (
  bounds: [number, number, number, number], // west, south, east, north
  zoom: number,
  theme: 'light' | 'dark' | 'satellite',
  onProgress?: (progress: number) => void
) => {
  const [west, south, east, north] = bounds;
  
  const left = long2tile(west, zoom);
  const right = long2tile(east, zoom);
  const top = lat2tile(north, zoom);
  const bottom = lat2tile(south, zoom);

  const tiles = [];
  
  for (let x = left; x <= right; x++) {
    for (let y = top; y <= bottom; y++) {
      tiles.push({ x, y, z: zoom });
    }
  }

  console.log(`Calculated ${tiles.length} tiles for offline download.`);
  
  let completed = 0;
  const total = tiles.length;

  // Function to fetch and cache a single tile
  const fetchTile = async (tile: { x: number, y: number, z: number }) => {
    const url = getTileUrl(tile.x, tile.y, tile.z, theme);
    try {
      // We use the browser's Cache API if available, or just fetch to prime the HTTP cache
      if ('caches' in window) {
        const cache = await caches.open('offline-map-tiles');
        await cache.add(url);
      } else {
        await fetch(url, { mode: 'no-cors' });
      }
    } catch (e) {
      console.warn(`Failed to download tile ${url}`, e);
    } finally {
      completed++;
      if (onProgress) onProgress((completed / total) * 100);
    }
  };

  // Process in batches to avoid overwhelming the network
  const BATCH_SIZE = 10;
  for (let i = 0; i < tiles.length; i += BATCH_SIZE) {
    const batch = tiles.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fetchTile));
  }
  
  return tiles.length;
};
