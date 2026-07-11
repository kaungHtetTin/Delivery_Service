<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AdminLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientAddressController;
use App\Http\Controllers\Api\ClientProfileController;
use App\Http\Controllers\Api\ClientShopController;
use App\Http\Controllers\Api\CommissionRuleController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\DeliveryOrderController;
use App\Http\Controllers\Api\FinanceCategoryController;
use App\Http\Controllers\Api\FinanceTransactionController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\RealtimeTokenController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RiderController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\ShippingAddressController;
use App\Http\Controllers\Api\SystemHealthController;
use App\Http\Controllers\Api\SystemSettingController;
use App\Http\Controllers\Api\UserManagementController;
use App\Http\Controllers\Api\UserProfileController;

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
Route::get('settings/public', [SystemSettingController::class, 'publicIndex']);
Route::post('notifications/push-worker-trace', [NotificationController::class, 'pushWorkerTrace'])
    ->middleware('throttle:60,1');

Route::middleware('auth:sanctum')->get('user', function (Request $request) {
    return $request->user();
});
Route::middleware('auth:sanctum')->patch('user', [UserProfileController::class, 'update']);
Route::middleware('auth:sanctum')->post('user/profile', [UserProfileController::class, 'update']);
Route::middleware('auth:sanctum')->post('auth/logout', [AuthController::class, 'logout']);
Route::middleware('auth:sanctum')->get('notifications', [NotificationController::class, 'index']);
Route::middleware('auth:sanctum')->patch('notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
Route::middleware('auth:sanctum')->post('notifications/push-subscriptions', [NotificationController::class, 'storePushSubscription']);
Route::middleware('auth:sanctum')->delete('notifications/push-subscriptions', [NotificationController::class, 'destroyPushSubscription']);
Route::middleware('auth:sanctum')->get('realtime/token', [RealtimeTokenController::class, 'show']);

Route::middleware(['auth:sanctum', 'role:client'])->group(function () {
    Route::get('client/profile', [ClientProfileController::class, 'show']);
    Route::patch('client/profile', [ClientProfileController::class, 'update']);
    Route::get('client/addresses', [ClientAddressController::class, 'index']);
    Route::post('client/addresses', [ClientAddressController::class, 'store']);
    Route::patch('client/addresses/{address}', [ClientAddressController::class, 'update']);
    Route::delete('client/addresses/{address}', [ClientAddressController::class, 'destroy']);
    Route::patch('client/addresses/{address}/default', [ClientAddressController::class, 'makeDefault']);
    Route::get('client/shops', [ClientShopController::class, 'index']);
    Route::post('client/shops', [ClientShopController::class, 'store']);
    Route::patch('client/shops/{shop}', [ClientShopController::class, 'update']);
    Route::delete('client/shops/{shop}', [ClientShopController::class, 'destroy']);
    Route::patch('client/shops/{shop}/default', [ClientShopController::class, 'makeDefault']);
});

Route::apiResource('delivery-orders', DeliveryOrderController::class)
    ->only(['store', 'show']);

Route::middleware(['auth:sanctum', 'role:client,rider,office_admin,super_admin'])->group(function () {
    Route::get('delivery-orders', [DeliveryOrderController::class, 'index'])
        ->name('delivery-orders.index');
});

Route::middleware(['auth:sanctum', 'role:client,office_admin,super_admin'])->group(function () {
    Route::patch('delivery-orders/{deliveryOrder}', [DeliveryOrderController::class, 'update']);
    Route::delete('delivery-orders/{deliveryOrder}', [DeliveryOrderController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'role:office_admin,super_admin'])->group(function () {
    Route::post('notifications/broadcast', [NotificationController::class, 'broadcast']);
    Route::get('notifications/push-logs', [NotificationController::class, 'pushLogs']);
    Route::post('delivery-orders/{deliveryOrder}/assign', [DeliveryOrderController::class, 'assign']);
    Route::get('finance/transactions/summary', [FinanceTransactionController::class, 'summary']);
    Route::apiResource('finance/categories', FinanceCategoryController::class)
        ->parameters(['categories' => 'category'])
        ->except(['show']);
    Route::apiResource('finance/transactions', FinanceTransactionController::class)
        ->parameters(['transactions' => 'transaction'])
        ->except(['show']);
    Route::apiResource('commission-rules', CommissionRuleController::class)
        ->parameters(['commission-rules' => 'commissionRule'])
        ->except(['show']);
    Route::get('payments', [PaymentController::class, 'index']);
    Route::post('payments', [PaymentController::class, 'store']);
    Route::get('payments/{payment}', [PaymentController::class, 'show']);
    Route::patch('payments/{payment}', [PaymentController::class, 'update']);
    Route::delete('payments/{payment}', [PaymentController::class, 'destroy']);
    Route::patch('payments/{payment}/review', [PaymentController::class, 'review']);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('shops', ShopController::class);
    Route::get('shipping-addresses', [ShippingAddressController::class, 'index']);
    Route::post('settings/assets', [SystemSettingController::class, 'uploadAsset']);
    Route::apiResource('settings', SystemSettingController::class)->parameters(['settings' => 'systemSetting']);
    Route::apiResource('users', UserManagementController::class);
    Route::get('reports/summary', [ReportController::class, 'summary']);
    Route::get('system/health', [SystemHealthController::class, 'show']);
    Route::get('admin-logs', [AdminLogController::class, 'index']);
    Route::post('riders', [RiderController::class, 'store']);
    Route::post('riders/{rider}/settlements', [RiderController::class, 'collectHeldFees']);
    Route::patch('riders/{rider}', [RiderController::class, 'update']);
    Route::delete('riders/{rider}', [RiderController::class, 'destroy']);
});

Route::middleware(['auth:sanctum', 'role:rider,office_admin,super_admin'])->group(function () {
    Route::patch('delivery-orders/{deliveryOrder}/status', [DeliveryOrderController::class, 'updateStatus']);
    Route::get('riders', [RiderController::class, 'index']);
    Route::get('riders/{rider}/assignments', [RiderController::class, 'assignments']);
    Route::post('riders/{rider}/start-active', [RiderController::class, 'startActive']);
    Route::post('riders/{rider}/stop-active', [RiderController::class, 'stopActive']);
    Route::post('riders/{rider}/gps-events', [RiderController::class, 'reportGpsEvent']);
    Route::post('riders/{rider}/locations', [RiderController::class, 'storeLocation'])
        ->middleware('throttle:rider-locations');
});

Route::post('payments/{payment}/screenshot', [PaymentController::class, 'uploadScreenshot']);
