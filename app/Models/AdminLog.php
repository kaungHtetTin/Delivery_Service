<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AdminLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'action',
        'subject_type',
        'subject_id',
        'actor_type',
        'actor_id',
        'metadata',
        'note',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];
}
