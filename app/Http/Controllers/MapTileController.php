<?php

namespace App\Http\Controllers;

use App\Models\MapTileCacheEntry;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class MapTileController extends Controller
{
    private string $provider = 'default';

    public function show(int $z, int $x, int $y): Response|StreamedResponse
    {
        abort_unless($this->validCoordinates($z, $x, $y), 404);

        $path = $this->tilePath($z, $x, $y);
        $disk = Storage::disk(config('map_tiles.cache_disk'));

        if (config('map_tiles.cache_enabled') && $disk->exists($path)) {
            $this->markHit($z, $x, $y, $path, (int) $disk->size($path));

            return $this->streamTile($path);
        }

        $tile = $this->fetchTile($z, $x, $y);

        if (config('map_tiles.cache_enabled')) {
            $this->storeTile($z, $x, $y, $path, $tile);
        }

        return response($tile, 200, $this->headers(strlen($tile), 'MISS'));
    }

    private function validCoordinates(int $z, int $x, int $y): bool
    {
        $minZoom = (int) config('map_tiles.min_zoom');
        $maxZoom = (int) config('map_tiles.max_zoom');

        if ($z < $minZoom || $z > $maxZoom) {
            return false;
        }

        $maxCoordinate = (2 ** $z) - 1;

        return $x >= 0 && $x <= $maxCoordinate && $y >= 0 && $y <= $maxCoordinate;
    }

    private function fetchTile(int $z, int $x, int $y): string
    {
        $url = strtr(config('map_tiles.provider'), [
            '{z}' => $z,
            '{x}' => $x,
            '{y}' => $y,
        ]);

        try {
            return Http::timeout((int) config('map_tiles.timeout'))
                ->withHeaders([
                    'Accept' => 'image/png,image/*;q=0.8,*/*;q=0.5',
                    'User-Agent' => (string) config('map_tiles.provider_user_agent'),
                ])
                ->get($url)
                ->throw()
                ->body();
        } catch (RequestException $exception) {
            abort($exception->response?->status() ?: 502, 'Map tile provider is unavailable.');
        }
    }

    private function storeTile(int $z, int $x, int $y, string $path, string $tile): void
    {
        $size = strlen($tile);

        $this->pruneFor($size, $path);

        $disk = Storage::disk(config('map_tiles.cache_disk'));
        $disk->put($path, $tile);

        MapTileCacheEntry::updateOrCreate(
            [
                'provider' => $this->provider,
                'z' => $z,
                'x' => $x,
                'y' => $y,
            ],
            [
                'path' => $path,
                'size_bytes' => $size,
                'hit_count' => 1,
                'cached_at' => now(),
                'last_accessed_at' => now(),
            ],
        );
    }

    private function markHit(int $z, int $x, int $y, string $path, int $size): void
    {
        $entry = MapTileCacheEntry::firstOrNew([
            'provider' => $this->provider,
            'z' => $z,
            'x' => $x,
            'y' => $y,
        ]);

        $entry->fill([
            'path' => $path,
            'size_bytes' => $size,
            'hit_count' => ((int) $entry->hit_count) + 1,
            'cached_at' => $entry->cached_at ?: now(),
            'last_accessed_at' => now(),
        ]);
        $entry->save();
    }

    private function pruneFor(int $incomingBytes, string $incomingPath): void
    {
        $limitBytes = (int) ((float) config('map_tiles.max_cache_gb') * 1024 * 1024 * 1024);

        if ($limitBytes <= 0) {
            return;
        }

        $totalBytes = (int) MapTileCacheEntry::sum('size_bytes');

        if (($totalBytes + $incomingBytes) <= $limitBytes) {
            return;
        }

        $disk = Storage::disk(config('map_tiles.cache_disk'));
        $entries = MapTileCacheEntry::query()
            ->where('path', '!=', $incomingPath)
            ->orderBy('hit_count')
            ->orderBy('last_accessed_at')
            ->orderBy('cached_at')
            ->cursor();

        foreach ($entries as $entry) {
            if (($totalBytes + $incomingBytes) <= $limitBytes) {
                break;
            }

            if ($disk->exists($entry->path)) {
                $disk->delete($entry->path);
            }

            $totalBytes -= (int) $entry->size_bytes;
            $entry->delete();
        }
    }

    private function streamTile(string $path): StreamedResponse
    {
        $disk = Storage::disk(config('map_tiles.cache_disk'));

        return response()->stream(function () use ($disk, $path) {
            echo $disk->get($path);
        }, 200, $this->headers((int) $disk->size($path), 'HIT'));
    }

    private function headers(int $size, string $cacheStatus): array
    {
        return [
            'Cache-Control' => 'public, max-age=604800, immutable',
            'Content-Length' => (string) $size,
            'Content-Type' => 'image/png',
            'X-Map-Tile-Cache' => $cacheStatus,
        ];
    }

    private function tilePath(int $z, int $x, int $y): string
    {
        return sprintf('%s/%d/%d/%d.png', config('map_tiles.cache_path'), $z, $x, $y);
    }
}
