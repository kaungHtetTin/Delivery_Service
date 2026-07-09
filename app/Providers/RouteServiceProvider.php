<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to the "home" route for your application.
     *
     * This is used by Laravel authentication to redirect users after login.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * The controller namespace for the application.
     *
     * When present, controller route declarations will automatically be prefixed with this namespace.
     *
     * @var string|null
     */
    // protected $namespace = 'App\\Http\\Controllers';

    /**
     * Define your route model bindings, pattern filters, etc.
     *
     * @return void
     */
    public function boot()
    {
        $this->configureRateLimiting();

        $this->routes(function () {
            Route::prefix('api')
                ->middleware('api')
                ->namespace($this->namespace)
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->namespace($this->namespace)
                ->group(base_path('routes/web.php'));
        });
    }

    /**
     * Configure the rate limiters for the application.
     *
     * @return void
     */
    protected function configureRateLimiting()
    {
        RateLimiter::for('api', function (Request $request) {
            $limit = $request->user() || $request->bearerToken()
                ? (int) config('rate_limits.api_authenticated_per_minute', 600)
                : (int) config('rate_limits.api_guest_per_minute', 180);

            return Limit::perMinute(max(1, $limit))->by($this->rateLimitKey($request, 'api'));
        });

        RateLimiter::for('rider-locations', function (Request $request) {
            $routeRider = $request->route('rider');
            $riderId = is_object($routeRider) && method_exists($routeRider, 'getKey')
                ? $routeRider->getKey()
                : (string) $routeRider;
            $limit = (int) config('rate_limits.rider_locations_per_minute', 240);

            return Limit::perMinute(max(1, $limit))->by("rider-location:{$riderId}:{$this->rateLimitKey($request, 'rider')}");
        });
    }

    private function rateLimitKey(Request $request, string $scope): string
    {
        if ($userId = $request->user()?->getAuthIdentifier()) {
            return "{$scope}:user:{$userId}";
        }

        if ($token = $request->bearerToken()) {
            return "{$scope}:token:" . hash('sha256', $token);
        }

        return "{$scope}:guest:" . $request->ip() . ':' . substr(hash('sha256', (string) $request->userAgent()), 0, 16);
    }
}
