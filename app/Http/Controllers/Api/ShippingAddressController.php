<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientAddress;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShippingAddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $addresses = ClientAddress::query()
            ->with('user:id,name,phone')
            ->when($request->integer('customer_id'), function ($query, $customerId) {
                $userId = Customer::whereKey($customerId)->value('user_id');

                if ($userId) {
                    $query->where('user_id', $userId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->when($request->string('search')->toString(), function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('label', 'like', "%{$search}%")
                        ->orWhere('recipient_name', 'like', "%{$search}%")
                        ->orWhere('phone', 'like', "%{$search}%")
                        ->orWhere('address', 'like', "%{$search}%");
                });
            })
            ->orderByDesc('is_default')
            ->orderBy('label')
            ->paginate($request->integer('per_page', 20));

        return response()->json($addresses);
    }
}
