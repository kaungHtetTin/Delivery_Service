<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MapTileCacheEntry extends Model
{
    protected $fillable = [
        'provider',
        'z',
        'x',
        'y',
        'path',
        'size_bytes',
        'hit_count',
        'cached_at',
        'last_accessed_at',
    ];

    protected $casts = [
        'cached_at' => 'datetime',
        'last_accessed_at' => 'datetime',
    ];
}
