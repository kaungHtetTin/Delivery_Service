<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', fn () => redirect()->route('client'));
Route::view('/client', 'app', ['portal' => 'client'])->name('client');
Route::view('/rider', 'app', ['portal' => 'rider'])->name('rider');
Route::view('/office', 'app', ['portal' => 'admin'])->name('office');
