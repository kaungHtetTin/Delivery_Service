<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DeliveryOrderController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RiderController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::post('auth/token', [AuthController::class, 'token']);
Route::post('auth/register', [AuthController::class, 'register']);

Route::middleware('auth:sanctum')->get('user', function (Request $request) {
    return $request->user();
});
Route::middleware('auth:sanctum')->post('auth/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->get('notifications', [NotificationController::class, 'index']);
Route::middleware('auth:sanctum')->patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);

Route::apiResource('delivery-orders', DeliveryOrderController::class)
    ->only(['store', 'show']);

Route::middleware(['auth:sanctum', 'role:client,rider,office_admin,super_admin'])->group(function () {
    Route::get('delivery-orders', [DeliveryOrderController::class, 'index'])
        ->name('delivery-orders.index');
});

Route::middleware(['auth:sanctum', 'role:office_admin,super_admin'])->group(function () {
    Route::post('delivery-orders/{deliveryOrder}/assign', [DeliveryOrderController::class, 'assign']);
    Route::get('payments', [PaymentController::class, 'index']);
    Route::patch('payments/{payment}/review', [PaymentController::class, 'review']);
    Route::get('reports/summary', [ReportController::class, 'summary']);
    Route::get('admin-logs', [AdminLogController::class, 'index']);
});

Route::middleware(['auth:sanctum', 'role:rider,office_admin,super_admin'])->group(function () {
    Route::patch('delivery-orders/{deliveryOrder}/status', [DeliveryOrderController::class, 'updateStatus']);
    Route::get('riders', [RiderController::class, 'index']);
    Route::get('riders/{rider}/assignments', [RiderController::class, 'assignments']);
    Route::post('riders/{rider}/locations', [RiderController::class, 'storeLocation']);
});

Route::post('payments/{payment}/screenshot', [PaymentController::class, 'uploadScreenshot']);
