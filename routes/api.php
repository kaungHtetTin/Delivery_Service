<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\DeliveryOrderController;
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

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

Route::apiResource('delivery-orders', DeliveryOrderController::class)
    ->only(['index', 'store', 'show']);
Route::post('delivery-orders/{deliveryOrder}/assign', [DeliveryOrderController::class, 'assign']);
Route::patch('delivery-orders/{deliveryOrder}/status', [DeliveryOrderController::class, 'updateStatus']);

Route::get('riders', [RiderController::class, 'index']);
Route::get('riders/{rider}/assignments', [RiderController::class, 'assignments']);
Route::post('riders/{rider}/locations', [RiderController::class, 'storeLocation']);
