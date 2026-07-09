<?php

namespace App\Console\Commands;

use App\Models\RiderLocation;
use Illuminate\Console\Command;

class PruneRiderLocations extends Command
{
    protected $signature = 'rider-locations:prune
        {--days= : Override the configured retention window in days}
        {--dry-run : Count matching rows without deleting them}';

    protected $description = 'Prune detailed rider GPS location rows older than the configured retention window.';

    public function handle(): int
    {
        $days = (int) ($this->option('days') ?: config('services.live_tracking.location_retention_days', 14));

        if ($days < 1) {
            $this->error('Retention days must be at least 1.');

            return self::FAILURE;
        }

        $cutoff = now()->subDays($days);
        $query = RiderLocation::query()->where('recorded_at', '<', $cutoff);
        $count = (clone $query)->count();

        if ($this->option('dry-run')) {
            $this->info("{$count} rider location record(s) older than {$days} day(s) would be pruned.");

            return self::SUCCESS;
        }

        $deleted = 0;

        (clone $query)
            ->select('id')
            ->orderBy('id')
            ->chunkById(1000, function ($locations) use (&$deleted) {
                $ids = $locations->pluck('id');

                $deleted += RiderLocation::query()
                    ->whereIn('id', $ids)
                    ->delete();
            });

        $this->info("Pruned {$deleted} rider location record(s) older than {$days} day(s).");

        return self::SUCCESS;
    }
}
