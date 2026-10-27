import { Client } from '@elastic/elasticsearch';

export const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
});

export async function ensureTracksIndex() {
  const exists = await esClient.indices.exists({ index: 'tracks' });
  if (exists) return;

  await esClient.indices.create({
    index: 'tracks',
    body: {
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: { type: 'text', analyzer: 'standard' },
          title_suggest: { type: 'completion' },
          artists: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          album: { type: 'text' },
          genres: { type: 'keyword' },
          release_year: { type: 'integer' },
          popularity: { type: 'float' },
          duration_ms: { type: 'integer' },
          explicit: { type: 'boolean' },
          isrc: { type: 'keyword' },
        },
      },
    },
  });
}
