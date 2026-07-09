<?php

namespace Tests\Feature;

use App\Models\MapTileCacheEntry;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MapTileCacheTest extends TestCase
{
    use RefreshDatabase;

    public function test_map_tile_proxy_caches_provider_response(): void
    {
        Storage::fake('local');
        config([
            'map_tiles.cache_disk' => 'local',
            'map_tiles.cache_enabled' => true,
            'map_tiles.max_cache_gb' => 10,
            'map_tiles.provider' => 'https://example.test/{z}/{x}/{y}.png',
        ]);
        Http::fake([
            'https://example.test/*' => Http::response('tile-one', 200, ['Content-Type' => 'image/png']),
        ]);

        $this->get('/map-tiles/1/1/1')
            ->assertOk()
            ->assertHeader('X-Map-Tile-Cache', 'MISS')
            ->assertSee('tile-one', false);

        $this->get('/map-tiles/1/1/1')
            ->assertOk()
            ->assertHeader('X-Map-Tile-Cache', 'HIT');

        Http::assertSentCount(1);
        Storage::disk('local')->assertExists('map-tiles/1/1/1.png');
        $this->assertDatabaseHas('map_tile_cache_entries', [
            'z' => 1,
            'x' => 1,
            'y' => 1,
            'path' => 'map-tiles/1/1/1.png',
            'hit_count' => 2,
        ]);
    }

    public function test_map_tile_cache_prunes_old_low_use_tiles_when_limit_is_full(): void
    {
        Storage::fake('local');
        config([
            'map_tiles.cache_disk' => 'local',
            'map_tiles.cache_enabled' => true,
            'map_tiles.max_cache_gb' => 0.00000001,
            'map_tiles.provider' => 'https://example.test/{z}/{x}/{y}.png',
        ]);
        Http::fake([
            'https://example.test/*' => Http::response('12345678', 200, ['Content-Type' => 'image/png']),
        ]);

        $this->get('/map-tiles/2/1/1')->assertOk();
        $this->get('/map-tiles/2/1/2')->assertOk();

        Storage::disk('local')->assertMissing('map-tiles/2/1/1.png');
        Storage::disk('local')->assertExists('map-tiles/2/1/2.png');
        $this->assertFalse(MapTileCacheEntry::where('path', 'map-tiles/2/1/1.png')->exists());
        $this->assertTrue(MapTileCacheEntry::where('path', 'map-tiles/2/1/2.png')->exists());
    }
}
